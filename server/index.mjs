// Pixel Bazaar operator server.
// - Creates player accounts (`name.<contract>`) with a browser-held function-call key, so nobody needs a wallet.
// - Each morning it commits sha256(event | rumors | salt) to the contract BEFORE the player trades.
// - Each night it reveals the event, rumors and salt; the contract checks the hash and settles positions.
// It keeps no database: every day's plan is rebuilt from SECRET with an HMAC.
//
// Run:  node server/index.mjs            (real NEAR, needs the env vars below)
//       MOCK=1 node server/index.mjs     (offline: a JavaScript copy of the contract, for local testing)
import http from 'node:http';
import { createHmac, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Rules = require('../shared/rules.js');
const { Engine } = require('../shared/engine.js');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const env = process.env;
const MOCK = env.MOCK === '1';
const PORT = +(env.PORT || 8080);
const NETWORK = env.NEAR_NETWORK || 'testnet';
const NODE_URL = env.NEAR_NODE_URL || (NETWORK === 'mainnet' ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com');
const CONTRACT = env.CONTRACT_ID || (MOCK ? 'bazaar.mock.testnet' : '');
const OPERATOR = env.OPERATOR_ID || (MOCK ? 'operator.mock.testnet' : '');
const OPERATOR_KEY = env.OPERATOR_KEY || '';
const SECRET = env.GAME_SECRET || (MOCK ? 'mock-secret' : '');
const PLAYER_FUNDING = env.PLAYER_FUNDING || '0.05'; // NEAR given to each new player account for gas
const TOPUP = env.PLAYER_TOPUP || '0.03';               // sent when a player's account runs low on gas money
const TOPUP_BELOW = +(env.PLAYER_TOPUP_BELOW || 0.01);  // NEAR
const MIN_RESERVE = +(env.OPERATOR_MIN_NEAR || 2);       // keep this much on the operator (and contract) for storage; refuse sign-ups below it
const ALLOW_ORIGIN = env.ALLOW_ORIGIN || '*';
if (!MOCK && (!CONTRACT || !OPERATOR || !OPERATOR_KEY || !SECRET)) {
  console.error('Missing env. Set CONTRACT_ID, OPERATOR_ID, OPERATOR_KEY and GAME_SECRET (or run with MOCK=1).');
  process.exit(1);
}
const sha = s => createHash('sha256').update(s).digest('hex');
const hmac = s => createHmac('sha256', SECRET).update(s).digest();

// ---------- contract access ----------
let view, operatorCall, hasKey, balanceOf, sendNear;
const mockKeys = new Map();
let mock;
if (MOCK) {
  mock = new Engine(OPERATOR, CONTRACT, sha);
  mock.create_npc(OPERATOR, 'rita'); mock.create_npc(OPERATOR, 'kaito');
  view = async (method, args) => { const fn = mock[method]; if (!fn) throw new Error('no view ' + method); return method === 'get_player' ? fn.call(mock, args.account_id) : method === 'mt_balance_of' ? fn.call(mock, args.account_id, args.token_id) : fn.call(mock); };
  hasKey = async (account, pk) => mockKeys.get(account) === pk;
  balanceOf = async () => 100; sendNear = async () => null;
  operatorCall = async (method, args) => {
    if (method === 'register_player') { const id = mock.register_player(OPERATOR, args.name); mockKeys.set(id, args.public_key); return id; }
    return mock[method](OPERATOR, args);
  };
} else {
  const { Account, JsonRpcProvider, teraToGas, nearToYocto } = await import('near-api-js');
  const provider = new JsonRpcProvider({ url: NODE_URL });
  const operator = new Account(OPERATOR, provider, OPERATOR_KEY);
  view = (method, args = {}) => provider.callFunction({ contractId: CONTRACT, method, args });
  hasKey = async (account, pk) => { try { await provider.viewAccessKey({ accountId: account, publicKey: pk }); return true; } catch { return false; } };
  // free NEAR on an account (balance minus what its storage locks), in NEAR
  balanceOf = async accountId => {
    const a = await provider.viewAccount({ accountId });
    const free = BigInt(a.amount) - BigInt(a.storage_usage) * 10n ** 19n;
    return Number(free / 10n ** 18n) / 1e6;
  };
  sendNear = (receiverId, near) => queued(() => operator.transfer({ receiverId, amount: nearToYocto(near) }));
  const raw = (method, args, deposit) => withTimeout(operator.callFunction({ contractId: CONTRACT, methodName: method, args, gas: teraToGas('100'), deposit: nearToYocto(deposit) }), 45000);
  // One operator key signs everything, so calls go out one at a time (no nonce clashes) and retry on network trouble.
  let chain = Promise.resolve();
  const queued = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  operatorCall = (method, args, deposit = '0') => {
    const run = async () => {
      for (let i = 0; ; i++) {
        try { return await raw(method, args, deposit); }
        catch (e) {
          const m = String(e && (e.message || e)) + ' ' + (e && e.type || '');
          if (i >= 2 || /panicked|Smart contract|ExecutionError|FunctionCallError|ActionError/i.test(m)) throw e;
          console.warn('retrying', method, m.slice(0, 200)); await new Promise(r => setTimeout(r, 800 * (i + 1)));
        }
      }
    };
    return queued(run);
  };
}
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error('NEAR took too long to answer')), ms))]); }
// One request at a time per player, so a double tap cannot commit or settle twice.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const p = prev.then(fn, fn); const tail = p.catch(() => {}); locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return p;
}

// ---------- the daily plan ----------
function plan(account, season, day) {
  const seedBytes = hmac(`${account}|${season}|${day}`), accBytes = hmac(`${account}|${season}|acc`);
  const rng = Rules.mulberry32(seedBytes.readUInt32LE(0));
  const acc = Rules.seasonAccuracy(Rules.mulberry32(accBytes.readUInt32LE(0)));
  const { truth, rumors, kaito } = Rules.planDay(rng, acc);
  const rumorText = Rules.encodeRumors(rumors);
  const salt = hmac(`${account}|${season}|${day}|salt`).toString('hex');
  const commitment = sha(`${account}|${season}|${day}|${truth}|${rumorText}|${salt}`);
  const weather = Rules.EVENTS[truth].weather || null;
  const r = rumors.rita;
  const npc_moves = [{ npc: `kaito.${CONTRACT}`, good: kaito.good, long: kaito.long }];
  if (r.lying) npc_moves.push({ npc: `rita.${CONTRACT}`, good: Rules.EVENTS[r.ev].fx[0][0], long: false });
  return { truth, rumors, rumorText, salt, commitment, weather, npc_moves, kaito };
}

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.json': 'application/json', '.css': 'text/css' };
const recent = new Map(); // ip -> registrations in the last hour
// Behind a local reverse proxy (Caddy) every request comes from 127.0.0.1, so use the address it forwards.
function clientIp(req) {
  const a = req.socket.remoteAddress || '';
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (/^(::1|127\.|::ffff:127\.)/.test(a) && fwd) ? fwd : a;
}
function limited(ip) { const now = Date.now(), list = (recent.get(ip) || []).filter(t => now - t < 3600e3); recent.set(ip, list); if (list.length >= 10) return true; list.push(now); return false; }
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': ALLOW_ORIGIN, 'access-control-allow-headers': 'content-type' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((ok, bad) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } }); });
const errText = e => String(e && (e.message || e)).replace(/^.*Smart contract panicked: /s, '').slice(0, 300);

const routes = {
  'POST /api/register': async (body, req) => {
    const name = String(body.name || '').toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9_-]{1,30})$/.test(name)) throw new Error('Names use 2-31 lowercase letters, numbers, - or _.');
    if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(body.publicKey || '')) throw new Error('bad public key');
    if (!MOCK && limited(clientIp(req))) throw new Error('Too many new players from your network. Try again in an hour.');
    const accountId = `${name}.${CONTRACT}`;
    if (await view('get_player', { account_id: accountId })) throw new Error('That name is taken.');
    if (!MOCK && (await balanceOf(OPERATOR)) < MIN_RESERVE + +PLAYER_FUNDING) { console.error('operator balance low: sign-ups paused'); throw new Error('New sign-ups are paused for a moment. Please try again later.'); }
    await operatorCall('register_player', { name, public_key: body.publicKey }, PLAYER_FUNDING);
    if (!(await view('get_player', { account_id: accountId }))) throw new Error('Account creation failed. Try another name.');
    return { accountId };
  },
  // Log in on a new device: is this the right key for this account?
  'POST /api/check-key': async body => {
    if (!(await view('get_player', { account_id: body.accountId }))) throw new Error('No trader with that name.');
    if (!(await hasKey(body.accountId, body.publicKey))) throw new Error('Wrong password or recovery code.');
    return { ok: true };
  },
  // Start (or resume) the player's current day: commit it on chain, return the rumors.
  'POST /api/day': body => withLock(body.accountId, async () => {
    let p = await view('get_player', { account_id: body.accountId });
    if (!p) throw new Error('not a player');
    if (p.finished) return { finished: true };
    const d = plan(body.accountId, p.season, p.day);
    let tx = null;
    if (!p.commitment) {
      try { tx = await operatorCall('commit_day', { player: body.accountId, day: p.day, commitment: d.commitment, weather: d.weather, npc_moves: d.npc_moves }); }
      catch (e) { p = await view('get_player', { account_id: body.accountId }); if (p.commitment !== d.commitment) throw e; }
    } else if (p.commitment !== d.commitment) throw new Error('commitment mismatch');
    // keep the player's account able to pay gas (at most once a day, since this runs with the commit)
    if (tx && !MOCK) { try { if ((await balanceOf(body.accountId)) < TOPUP_BELOW && (await balanceOf(OPERATOR)) > MIN_RESERVE) await sendNear(body.accountId, TOPUP); } catch (e) { console.error('top-up', errText(e)); } }
    // the restored lighthouse tells the truth about storms
    const stormWarning = p.projects && p.projects[1] ? d.truth === 0 : null;
    return { season: p.season, day: p.day, asleep: !!p.asleep, rumors: d.rumors, weather: d.weather, kaito: d.kaito, stormWarning, commitment: d.commitment, tx: txHash(tx) };
  }),
  // Reveal the event after the player has gone to sleep.
  'POST /api/settle': body => withLock(body.accountId, async () => {
    const p = await view('get_player', { account_id: body.accountId });
    if (!p) throw new Error('not a player');
    const already = () => body.day && (p.history || []).find(h => h.day === body.day && p.season === (body.season || p.season));
    // this night was already settled (a retry after a dropped connection): hand back its log
    if (!p.asleep && body.day && p.day !== body.day && already()) return { log: already(), tx: null };
    if (!p.asleep) throw new Error('The player is not asleep yet.');
    const d = plan(body.accountId, p.season, p.day);
    let res = null;
    try { res = await operatorCall('settle_day', { player: body.accountId, day: p.day, event: d.truth, rumors: d.rumorText, salt: d.salt }); }
    catch (e) { const q = await view('get_player', { account_id: body.accountId }); if (q.asleep || q.day === p.day && !q.finished) throw e; }
    const after = await view('get_player', { account_id: body.accountId });
    return { log: after.history.find(h => h.day === p.day) || after.history[after.history.length - 1], salt: d.salt, tx: txHash(res) };
  }),
};
function txHash(r) { return r && typeof r === 'object' ? (r.transaction?.hash || r.transaction_outcome?.id || null) : null; }
if (MOCK) {
  routes['POST /mock/call'] = async b => { mock[b.method](b.accountId, b.args || {}); return { ok: true }; };
  routes['POST /mock/view'] = async b => b.method === 'get_inventory' ? mock.get_inventory(b.args.account_id) : view(b.method, b.args || {});
}

process.on('unhandledRejection', e => console.error('unhandled', e && e.message || e));
process.on('uncaughtException', e => console.error('uncaught', e && e.message || e));
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const route = routes[req.method + ' ' + url.pathname];
  if (route) {
    try { json(res, 200, await route(await readBody(req), req)); }
    catch (e) { console.error(url.pathname, errText(e)); json(res, 400, { error: errText(e) }); }
    return;
  }
  if (url.pathname === '/config.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(`window.PB_CONFIG=${JSON.stringify({ mode: MOCK ? 'mock' : 'chain', api: '', network: NETWORK, nodeUrl: NODE_URL, contractId: CONTRACT,
      explorer: NETWORK === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io' })};`);
  }
  // static files: only the game itself
  let decoded; try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('bad request'); }
  let path = normalize(decoded).replace(/^([/\\])+/, '') || 'index.html';
  if (!/^(index\.html|[a-z]+\.js|shared\/[a-z]+\.js|vendor\/[a-z-]+\.mjs|assets\/.+)$/.test(path.replace(/\\/g, '/'))) { res.writeHead(404); return res.end('not found'); }
  try { const data = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end('not found'); }
}
http.createServer(async (req, res) => {
  try { await handle(req, res); }
  catch (e) { console.error('request failed', req.url, e && e.message); if (!res.headersSent) { res.writeHead(400); res.end('bad request'); } }
}).listen(PORT, () => console.log(`Pixel Bazaar ${MOCK ? 'MOCK' : NETWORK} server on http://localhost:${PORT}  contract=${CONTRACT}`));
