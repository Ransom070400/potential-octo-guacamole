/**
 * Orchestrates a user's encrypted profile + the one-scan two-way exchange.
 *
 * Profile create/edit:  Seal-encrypt → Walrus → on-chain Profile (sponsored).
 * Exchange (one scan):  a single sponsored tx grants BOTH directions, then we read
 *                       the peer's card. Connections are derived from the on-chain
 *                       allow table (in a two-way scan each party lands in the
 *                       other's allow table).
 */
import { makeProfileSealId } from './seal';
import { saveProfile, loadProfile, type PingouProfileData } from './profileStore';
import {
  buildCreateProfileTx,
  buildSetBlobTx,
  buildExchangeTx,
  buildRemoveAccessTx,
  getProfile,
  getCreatedProfileRef,
  findOwnedProfile,
  getConnectionAddresses,
} from './profile';
import {
  getCachedCard,
  setCachedCard,
  getCachedProfile,
  setCachedProfile,
  type CachedCard,
} from './profileCache';
import { generateShareCode, shareCodeBytes, type ConnectPayload } from './share';
import { sponsorAndExecute } from './sponsor';
import type { ZkLoginSigner } from './zkLogin';

export interface OwnedProfileRef {
  profileObjectId: string;
  ownerCapId: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findOwnedWithRetry(address: string, tries = 6): Promise<OwnedProfileRef | null> {
  for (let i = 0; i < tries; i++) {
    const found = await findOwnedProfile(address);
    if (found) return found;
    await sleep(800);
  }
  return null;
}

/**
 * Encrypt + upload `data`, creating the on-chain Profile (sponsored) if needed.
 * On first create we mint a share-code and commit its hash on-chain; on edits the
 * existing share-code (carried in `data.shareCode`) is preserved.
 */
export async function saveOwnProfile(
  address: string,
  signer: ZkLoginSigner,
  data: PingouProfileData
): Promise<OwnedProfileRef> {
  let ref = await findOwnedProfile(address);
  let shareCode = data.shareCode;

  if (!ref) {
    // New profile: the share-code's hash must be set at creation (immutable after).
    // Lazy import keeps expo-crypto out of the Node-importable module graph.
    const { shareCodeHash } = await import('./shareHash');
    shareCode = generateShareCode();
    const shareHash = await shareCodeHash(shareCode);
    const digest = await sponsorAndExecute(buildCreateProfileTx('', shareHash), signer, address);
    // Read the new object ids from the tx effects (fast) instead of polling.
    ref = (await getCreatedProfileRef(digest)) ?? (await findOwnedWithRetry(address));
    if (!ref) throw new Error('Profile created but not yet indexed; try again.');
  }
  if (!shareCode) shareCode = generateShareCode(); // safety net

  const full = { ...data, shareCode };
  const { blobId } = await saveProfile(ref.profileObjectId, full);
  await setCachedProfile(blobId, full); // so the reload after save is instant
  await sponsorAndExecute(
    buildSetBlobTx(ref.profileObjectId, ref.ownerCapId, blobId),
    signer,
    address
  );
  return ref;
}

/** Load + decrypt the caller's own profile (owner always has access). */
export async function loadOwnProfile(
  address: string,
  signer: ZkLoginSigner
): Promise<{ ref: OwnedProfileRef; data: PingouProfileData } | null> {
  const ref = await findOwnedProfile(address);
  if (!ref) return null;
  const onchain = await getProfile(ref.profileObjectId);
  if (!onchain?.blobId) return null;
  // Cache-first: own profile is keyed by the immutable blob id, so once decrypted
  // it loads instantly on next launch (no Walrus/Seal) until the profile changes.
  const cached = await getCachedProfile(onchain.blobId);
  if (cached) return { ref, data: cached };
  const data = await loadProfile({
    profileObjectId: ref.profileObjectId,
    blobId: onchain.blobId,
    sealId: makeProfileSealId(ref.profileObjectId),
    address,
    signer,
  });
  await setCachedProfile(onchain.blobId, data);
  return { ref, data };
}

/** Load + decrypt a peer's profile by id (only works once I have access). */
export async function loadPeerProfile(
  myAddress: string,
  signer: ZkLoginSigner,
  peerProfileObjectId: string
): Promise<PingouProfileData> {
  const onchain = await getProfile(peerProfileObjectId);
  if (!onchain?.blobId) throw new Error('Peer has no profile set up yet');
  return loadProfile({
    profileObjectId: peerProfileObjectId,
    blobId: onchain.blobId,
    sealId: makeProfileSealId(peerProfileObjectId),
    address: myAddress,
    signer,
  });
}

/**
 * Scan-to-exchange: one sponsored tx grants both directions (I read the peer; the
 * peer can read me), then return the peer's decrypted card. `peer` comes from the
 * scanned QR (address + profileId + share-code).
 */
export async function exchange(
  myAddress: string,
  signer: ZkLoginSigner,
  myRef: OwnedProfileRef,
  peer: ConnectPayload
): Promise<PingouProfileData> {
  await sponsorAndExecute(
    buildExchangeTx({
      peerProfileId: peer.profileId,
      peerCodeBytes: shareCodeBytes(peer.code),
      myProfileId: myRef.profileObjectId,
      myCapId: myRef.ownerCapId,
      peerAddress: peer.address,
    }),
    signer,
    myAddress
  );
  return loadPeerProfile(myAddress, signer, peer.profileId);
}

/**
 * Decrypt just the display fields of a connection's card, using the local cache
 * (keyed by the immutable Walrus blob id) so reopens are instant.
 */
export async function loadConnectionCard(
  address: string,
  signer: ZkLoginSigner,
  profileObjectId: string
): Promise<CachedCard> {
  const onchain = await getProfile(profileObjectId);
  if (!onchain?.blobId) throw new Error('Peer has no profile set up yet');
  const cached = await getCachedCard(onchain.blobId);
  if (cached) return cached;
  const data = await loadProfile({
    profileObjectId,
    blobId: onchain.blobId,
    sealId: makeProfileSealId(profileObjectId),
    address,
    signer,
  });
  const card: CachedCard = { fullname: data.fullname, avatar: data.avatar, bio: data.bio };
  await setCachedCard(onchain.blobId, card);
  return card;
}

/**
 * Delete a connection: revoke the peer's access to my card (sponsored on-chain
 * `remove`), which also drops them from my connections list (it's derived from my
 * allow table). Needs my own Profile ref.
 */
export async function removeConnection(
  address: string,
  signer: ZkLoginSigner,
  peerAddress: string
): Promise<void> {
  const ref = await findOwnedProfile(address);
  if (!ref) throw new Error('You have no profile');
  await sponsorAndExecute(
    buildRemoveAccessTx(ref.profileObjectId, ref.ownerCapId, peerAddress),
    signer,
    address
  );
}

export interface Connection {
  address: string;
  profileObjectId: string;
}

/** My connections = addresses in my Profile's allow table, resolved to their profiles. */
export async function getMyConnections(address: string): Promise<Connection[]> {
  const ref = await findOwnedProfile(address);
  if (!ref) return [];
  const onchain = await getProfile(ref.profileObjectId);
  if (!onchain?.allowTableId) return [];
  const addrs = await getConnectionAddresses(onchain.allowTableId);
  const out: Connection[] = [];
  for (const a of addrs) {
    const peerRef = await findOwnedProfile(a);
    if (peerRef) out.push({ address: a, profileObjectId: peerRef.profileObjectId });
  }
  return out;
}
