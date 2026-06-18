/**
 * Helpers for the on-chain `pingou::profile` module: build the transactions that
 * create/update a Profile and grant access, and read a Profile object back.
 *
 * These transactions are signed by the user's zkLogin key but PAID by the
 * sponsorship backend (Enoki), so users never need SUI. The builders here return
 * a `Transaction`; the sponsor/sign/execute handoff lives in the auth layer.
 */
import { Transaction } from '@mysten/sui/transactions';
import { suiClient } from './suiClient';
import { PINGOU_PACKAGE_ID } from './config';

const target = (fn: string) => `${PINGOU_PACKAGE_ID}::profile::${fn}` as const;

/** Create a Profile pointing at `blobId`, keeping the OwnerCap. `shareHash` is
 *  sha256 of the QR share-code (enables one-scan exchange via `add_self`). */
export function buildCreateProfileTx(blobId: string, shareHash: Uint8Array): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('create_and_keep'),
    arguments: [tx.pure.string(blobId), tx.pure.vector('u8', Array.from(shareHash))],
  });
  return tx;
}

/** Repoint a Profile at a new Walrus blob after editing (re-encrypting). */
export function buildSetBlobTx(
  profileObjectId: string,
  ownerCapId: string,
  blobId: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('set_blob'),
    arguments: [tx.object(profileObjectId), tx.object(ownerCapId), tx.pure.string(blobId)],
  });
  return tx;
}

/** Grant `account` permission to decrypt this profile (run when you share via QR). */
export function buildAddAccessTx(
  profileObjectId: string,
  ownerCapId: string,
  account: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('add'),
    arguments: [tx.object(profileObjectId), tx.object(ownerCapId), tx.pure.address(account)],
  });
  return tx;
}

/** Revoke `account`'s access — used to delete a connection (drops them from my list
 *  and stops them decrypting my card). */
export function buildRemoveAccessTx(
  profileObjectId: string,
  ownerCapId: string,
  account: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('remove'),
    arguments: [tx.object(profileObjectId), tx.object(ownerCapId), tx.pure.address(account)],
  });
  return tx;
}

/**
 * One sponsored tx that performs a full two-way exchange when I scan a peer:
 *   - `add_self(peer, peerCode)` — grants ME access to the peer's profile.
 *   - `add(my profile, my cap, peer)` — grants the PEER access to mine.
 * So a single scan connects both directions.
 */
export function buildExchangeTx(args: {
  peerProfileId: string;
  peerCodeBytes: Uint8Array;
  myProfileId: string;
  myCapId: string;
  peerAddress: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('add_self'),
    arguments: [
      tx.object(args.peerProfileId),
      tx.pure.vector('u8', Array.from(args.peerCodeBytes)),
    ],
  });
  tx.moveCall({
    target: target('add'),
    arguments: [
      tx.object(args.myProfileId),
      tx.object(args.myCapId),
      tx.pure.address(args.peerAddress),
    ],
  });
  return tx;
}

/** Grant the caller access by presenting the profile's share-code (the QR secret). */
export function buildAddSelfTx(profileObjectId: string, codeBytes: Uint8Array): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('add_self'),
    arguments: [tx.object(profileObjectId), tx.pure.vector('u8', Array.from(codeBytes))],
  });
  return tx;
}

/**
 * Pull the created Profile + OwnerCap ids straight from a create transaction's
 * effects (via waitForTransaction) — faster and deterministic vs. polling
 * getOwnedObjects for the indexer to catch up.
 */
export async function getCreatedProfileRef(
  digest: string
): Promise<{ profileObjectId: string; ownerCapId: string } | null> {
  const res = await suiClient.waitForTransaction({ digest, options: { showObjectChanges: true } });
  let profileObjectId: string | undefined;
  let ownerCapId: string | undefined;
  for (const c of res.objectChanges ?? []) {
    if (c.type === 'created') {
      if (c.objectType.endsWith('::profile::Profile')) profileObjectId = c.objectId;
      else if (c.objectType.endsWith('::profile::OwnerCap')) ownerCapId = c.objectId;
    }
  }
  return profileObjectId && ownerCapId ? { profileObjectId, ownerCapId } : null;
}

export interface OnChainProfile {
  objectId: string;
  owner: string;
  blobId: string;
  /** Object id of the `allow` Table — query its dynamic fields for connections. */
  allowTableId: string;
}

/** Read a Profile object's fields by id. */
export async function getProfile(profileObjectId: string): Promise<OnChainProfile | null> {
  const res = await suiClient.getObject({
    id: profileObjectId,
    options: { showContent: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') return null;
  const f = content.fields as Record<string, any>;
  return {
    objectId: profileObjectId,
    owner: f.owner,
    blobId: f.blob_id,
    allowTableId: f.allow?.fields?.id?.id,
  };
}

/**
 * Addresses in a profile's `allow` table = its connections (in a two-way scan each
 * party lands in the other's allow table). Read via the table's dynamic fields.
 */
export async function getConnectionAddresses(allowTableId: string): Promise<string[]> {
  if (!allowTableId) return [];
  const out: string[] = [];
  let cursor: string | null | undefined = undefined;
  do {
    const page = await suiClient.getDynamicFields({ parentId: allowTableId, cursor });
    for (const f of page.data) {
      // Table<address, bool>: the dynamic field name value IS the address key.
      const addr = typeof f.name?.value === 'string' ? f.name.value : undefined;
      if (addr) out.push(addr);
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return out;
}

/** Find the Profile + OwnerCap owned by an address (zkLogin returns no object ids). */
export async function findOwnedProfile(
  address: string
): Promise<{ profileObjectId: string; ownerCapId: string } | null> {
  const caps = await suiClient.getOwnedObjects({
    owner: address,
    filter: { StructType: `${PINGOU_PACKAGE_ID}::profile::OwnerCap` },
    options: { showContent: true },
  });
  const cap = caps.data[0];
  if (!cap?.data?.content || cap.data.content.dataType !== 'moveObject') return null;
  const fields = cap.data.content.fields as Record<string, any>;
  return { profileObjectId: fields.profile_id, ownerCapId: cap.data.objectId };
}
