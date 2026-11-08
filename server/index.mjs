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
const PLAYER_FUNDING = env.PLAYER_FUNDING || '0.3'; // NEAR given to each new player account for gas
const ALLOW_ORIGIN = env.ALLOW_ORIGIN || '*';
if (!MOCK && (!CONTRACT || !OPERATOR || !OPERATOR_KEY || !SECRET)) {
  console.error('Missing env. Set CONTRACT_ID, OPERATOR_ID, OPERATOR_KEY and GAME_SECRET (or run with MOCK=1).');
  process.exit(1);
}
const sha = s => createHash('sha256').update(s).digest('hex');
const hmac = s => createHmac('sha256', SECRET).update(s).digest();

// ---------- contract access ----------
let view, operatorCall;
let mock;
if (MOCK) {
  mock = new Engine(OPERATOR, CONTRACT, sha);
  mock.create_npc(OPERATOR, 'rita');
  view = async (method, args) => { const fn = mock[method]; if (!fn) throw new Error('no view ' + method); return method === 'get_player' ? fn.call(mock, args.account_id) : method === 'mt_balance_of' ? fn.call(mock, args.account_id, args.token_id) : fn.call(mock); };
  operatorCall = async (method, args) => {
    if (method === 'register_player') return mock.register_player(OPERATOR, args.name);
    return mock[method](OPERATOR, args);
  };
} else {
  const { Account, JsonRpcProvider, teraToGas, nearToYocto } = await import('near-api-js');
  const provider = new JsonRpcProvider({ url: NODE_URL });
  const operator = new Account(OPERATOR, provider, OPERATOR_KEY);
  view = (method, args = {}) => provider.callFunction({ contractId: CONTRACT, method, args });
  operatorCall = (method, args, deposit = '0') => operator.callFunction({ contractId: CONTRACT, methodName: method, args, gas: teraToGas('100'), deposit: nearToYocto(deposit) });
}

// ---------- the daily plan ----------
function plan(account, season, day) {
  const seedBytes = hmac(`${account}|${season}|${day}`), accBytes = hmac(`${account}|${season}|acc`);
  const rng = Rules.mulberry32(seedBytes.readUInt32LE(0));
  const acc = Rules.seasonAccuracy(Rules.mulberry32(accBytes.readUInt32LE(0)));
  const { truth, rumors } = Rules.planDay(rng, acc);
  const rumorText = Rules.encodeRumors(rumors);
  const salt = hmac(`${account}|${season}|${day}|salt`).toString('hex');
  const commitment = sha(`${account}|${season}|${day}|${truth}|${rumorText}|${salt}`);
  const weather = Rules.EVENTS[truth].weather || null;
  const r = rumors.rita;
  const npc_move = r.lying ? { npc: `rita.${CONTRACT}`, good: Rules.GOODS.findIndex(g => g.id === Rules.EVENTS[r.ev].good), long: false } : null;
  return { truth, rumors, rumorText, salt, commitment, weather, npc_move };
}

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.json': 'application/json', '.css': 'text/css' };
const recent = new Map(); // ip -> registrations in the last hour
function limited(ip) { const now = Date.now(), list = (recent.get(ip) || []).filter(t => now - t < 3600e3); recent.set(ip, list); if (list.length >= 5) return true; list.push(now); return false; }
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': ALLOW_ORIGIN, 'access-control-allow-headers': 'content-type' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((ok, bad) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } }); });
const errText = e => String(e && (e.message || e)).replace(/^.*Smart contract panicked: /s, '').slice(0, 300);

const routes = {
  'POST /api/register': async (body, req) => {
    const name = String(body.name || '').toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9_-]{1,30})$/.test(name)) throw new Error('Names use 2-31 lowercase letters, numbers, - or _.');
    if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(body.publicKey || '')) throw new Error('bad public key');
    if (limited(req.socket.remoteAddress)) throw new Error('Too many new players from your network. Try again in an hour.');
    const accountId = `${name}.${CONTRACT}`;
    if (await view('get_player', { account_id: accountId })) throw new Error('That name is taken.');
    if (MOCK) await operatorCall('register_player', { name }); else await operatorCall('register_player', { name, public_key: body.publicKey }, PLAYER_FUNDING);
    if (!(await view('get_player', { account_id: accountId }))) throw new Error('Account creation failed. Try another name.');
    return { accountId };
  },
  // Start (or resume) the player's current day: commit it on chain, return the rumors.
  'POST /api/day': async body => {
    const p = await view('get_player', { account_id: body.accountId });
    if (!p) throw new Error('not a player');
    if (p.finished) return { finished: true };
    const d = plan(body.accountId, p.season, p.day);
    let tx = null;
    if (!p.commitment) tx = await operatorCall('commit_day', { player: body.accountId, day: p.day, commitment: d.commitment, weather: d.weather, npc_move: d.npc_move });
    else if (p.commitment !== d.commitment) throw new Error('commitment mismatch');
    return { season: p.season, day: p.day, rumors: d.rumors, weather: d.weather, commitment: d.commitment, tx: txHash(tx) };
  },
  // Reveal the event after the player has gone to sleep.
  'POST /api/settle': async body => {
    const p = await view('get_player', { account_id: body.accountId });
    if (!p || !p.asleep) throw new Error('The player is not asleep yet.');
    const d = plan(body.accountId, p.season, p.day);
    const res = await operatorCall('settle_day', { player: body.accountId, day: p.day, event: d.truth, rumors: d.rumorText, salt: d.salt });
    const after = await view('get_player', { account_id: body.accountId });
    return { log: after.history[after.history.length - 1], salt: d.salt, tx: txHash(res) };
  },
};
function txHash(r) { return r && typeof r === 'object' ? (r.transaction?.hash || r.transaction_outcome?.id || null) : null; }
if (MOCK) {
  routes['POST /mock/call'] = async b => { mock[b.method](b.accountId, b.args || {}); return { ok: true }; };
  routes['POST /mock/view'] = async b => view(b.method, b.args || {});
}

http.createServer(async (req, res) => {
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
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html';
  if (!/^(index\.html|[a-z]+\.js|shared\/[a-z]+\.js|vendor\/[a-z-]+\.mjs|assets\/.+)$/.test(path.replace(/\\/g, '/'))) { res.writeHead(404); return res.end('not found'); }
  try { const data = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`Pixel Bazaar ${MOCK ? 'MOCK' : NETWORK} server on http://localhost:${PORT}  contract=${CONTRACT}`));
