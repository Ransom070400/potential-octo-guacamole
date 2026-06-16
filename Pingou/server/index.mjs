/**
 * Pingou sponsorship backend.
 *
 * Holds the Enoki PRIVATE key and sponsors a tightly-scoped set of transactions
 * (only our `profile` module's calls) so zkLogin users never need SUI for gas.
 * Two endpoints, mirroring Enoki's sponsor/execute split:
 *
 *   POST /sponsor  { sender, transactionKindBytes (base64) } -> { bytes, digest }
 *   POST /execute  { digest, signature }                     -> { digest }
 *
 * The app builds a tx kind, we wrap+sponsor it, the user signs the returned bytes
 * with their zkLogin signer, then we execute. We restrict `allowedMoveCallTargets`
 * server-side so a stolen client can't make us pay for arbitrary transactions.
 *
 * Run:  cp .env.example .env  (fill ENOKI_PRIVATE_KEY + PINGOU_PACKAGE_ID), then
 *       npm install && npm run dev
 */
import { createServer } from 'node:http';
import { EnokiClient } from '@mysten/enoki';

const PORT = Number(process.env.PORT ?? 8787);
const NETWORK = process.env.SUI_NETWORK ?? 'testnet';
const ENOKI_PRIVATE_KEY = process.env.ENOKI_PRIVATE_KEY;
const PACKAGE_ID = process.env.PINGOU_PACKAGE_ID;

if (!ENOKI_PRIVATE_KEY || !PACKAGE_ID) {
  console.error('Missing ENOKI_PRIVATE_KEY or PINGOU_PACKAGE_ID in env (.env).');
  process.exit(1);
}

const enoki = new EnokiClient({ apiKey: ENOKI_PRIVATE_KEY });

// Only these calls may be sponsored. Keep in sync with the Move module.
const ALLOWED_TARGETS = [
  `${PACKAGE_ID}::profile::create_and_keep`,
  `${PACKAGE_ID}::profile::set_blob`,
  `${PACKAGE_ID}::profile::add`,
  `${PACKAGE_ID}::profile::add_self`,
  `${PACKAGE_ID}::profile::remove`,
];

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/sponsor') {
      const { sender, transactionKindBytes } = await readJson(req);
      if (!sender || !transactionKindBytes) {
        return send(res, 400, { error: 'sender and transactionKindBytes required' });
      }
      const sponsored = await enoki.createSponsoredTransaction({
        network: NETWORK,
        sender,
        transactionKindBytes,
        allowedAddresses: [sender],
        allowedMoveCallTargets: ALLOWED_TARGETS,
      });
      return send(res, 200, { bytes: sponsored.bytes, digest: sponsored.digest });
    }

    if (req.method === 'POST' && req.url === '/execute') {
      const { digest, signature } = await readJson(req);
      if (!digest || !signature) {
        return send(res, 400, { error: 'digest and signature required' });
      }
      const result = await enoki.executeSponsoredTransaction({ digest, signature });
      return send(res, 200, { digest: result.digest });
    }

    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, network: NETWORK });
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err?.message ?? err) });
  }
});

server.listen(PORT, () => console.log(`pingou-sponsor listening on :${PORT} (${NETWORK})`));
