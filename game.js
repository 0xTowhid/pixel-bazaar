// Pixel Bazaar — explore a pixel town, gather rumors, trade them with leverage, pay off your debt.
// Game state lives in the contract (or its local copy); see backend.js for the three modes.
'use strict';

const { TS, TW } = World;
let VW = 960; const VH = 540; // logical canvas size; width follows the screen shape
const SEASON_DAYS = 10, DAY_SECONDS = 240, START_COINS = 300, DEBT = 5000;
const STAKE_STEP = 50;

const { GOODS, EVENTS, SOURCES } = Rules;
const GOOD = id => GOODS.find(g => g.id === id);
const goodIdx = id => GOODS.findIndex(g => g.id === id);
const LICENSES = [{ lev: 5, cost: 250 }, { lev: 10, cost: 900 }];
const BRIDGE_COST = 600, BOAT_COST = 300, CHEST_COINS = 400, FISH_GIFT = 30;
const DAILY_TIPS = {
  2: 'Tip: the Old Sailor on the harbor docks knows everything about the sea.',
  3: 'Tip: the farms behind the broken bridge have their own expert. The bridge costs 600 to repair.',
  4: 'Tip: a hermit lives in the Frost Camp, north-east past the woods.',
  5: 'Tip: Madame Vey in the Whispering Woods sells visions. 40 coins, mostly true.',
  6: 'Tip: sailors talk about a chest on the island east of the harbor.',
};

// ---------- assets ----------
const IMG = {};
const IMG_SRC = {
  floor: 'assets/tiles/TilesetFloor.png', house: 'assets/tiles/TilesetHouse.png', nature: 'assets/tiles/TilesetNature.png',
  water: 'assets/tiles/TilesetWater.png', element: 'assets/tiles/TilesetElement.png', detail: 'assets/tiles/TilesetFloorDetail.png',
  coin: 'assets/items/GoldCoin.png',
};
for (const n of ['player', 'mei', 'bram', 'rita', 'tomo', 'v1', 'v2', 'sailor', 'farmer', 'hermit', 'seer', 'master']) IMG_SRC[n] = 'assets/chars/' + n + '.png';
GOODS.forEach(g => IMG_SRC[g.id] = 'assets/items/' + g.icon + '.png');
const SND = {}, SND_SRC = { coin: 'Coin', ok: 'Accept', menu: 'Menu1', success: 'Success1', alert: 'Alert', voice: 'Voice1' };
let music, musicOn = true, audioReady = false;
function loadAll() {
  return Promise.all(Object.entries(IMG_SRC).map(([k, src]) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => rej(new Error('missing ' + src)); im.src = src;
  })));
}
function initAudio() {
  if (audioReady) return; audioReady = true;
  for (const [k, f] of Object.entries(SND_SRC)) SND[k] = new Audio('assets/audio/' + f + '.wav');
  music = new Audio('assets/audio/village.ogg'); music.loop = true; music.volume = .3;
  if (musicOn) music.play().catch(() => {});
}
function sfx(k) { if (!audioReady || !SND[k]) return; const a = SND[k].cloneNode(); a.volume = .4; a.play().catch(() => {}); }
const pick = a => a[Math.floor(Math.random() * a.length)];
function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---------- characters ----------
const DIR = { up: 0, left: 1, down: 2, right: 3 };
const at = p => ({ x: p.x * TW, y: p.y * TW });
function makeChar(sheet, p, o = {}) { const q = at(p); return Object.assign({ sheet, x: q.x, y: q.y, dir: 'down', moving: false, anim: 0, home: { ...q }, wander: 0, target: null, pause: 0 }, o); }
let MAP;
function blockedAt(x, y) {
  for (const [dx, dy] of [[-9, -6], [9, -6], [-9, 2], [9, 2]]) {
    const tx = Math.floor((x + dx) / TW), ty = Math.floor((y + dy) / TW);
    if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H || MAP.solid[ty][tx]) return true;
  }
  return false;
}
function moveChar(c, dx, dy) { if (dx && !blockedAt(c.x + dx, c.y)) c.x += dx; if (dy && !blockedAt(c.x, c.y + dy)) c.y += dy; }
function drawChar(ctx, c, cx, cy) {
  const frame = c.moving ? 1 + (Math.floor(c.anim) % 8) : 0;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(c.x - cx, c.y - cy + 1, 12, 5, 0, 0, 7); ctx.fill();
  ctx.drawImage(IMG[c.sheet], frame * 64, DIR[c.dir] * 64, 64, 64, Math.round(c.x - cx - 32), Math.round(c.y - cy - 60), 64, 64);
}

let player, NPCS;
function makeCast() {
  const P = World.P;
  player = makeChar('player', P.start);
  NPCS = {
    mei: makeChar('mei', P.mei, { src: 'mei', wander: 1.5 }),
    bram: makeChar('bram', P.bram, { src: 'bram', wander: 2 }),
    rita: makeChar('rita', P.ritaHome, { src: 'rita', wander: 1 }),
    sailor: makeChar('sailor', P.sailor, { src: 'sailor', wander: 0 }),
    farmer: makeChar('farmer', P.farmer, { src: 'farmer', wander: 2 }),
    hermit: makeChar('hermit', P.hermit, { src: 'hermit', wander: 1 }),
    seer: makeChar('seer', P.seer, { src: 'seer', wander: 0 }),
    tomo: makeChar('tomo', P.tomo, { name: 'Tomo', color: '#ffd86b', wander: 0 }),
    master: makeChar('master', P.master, { name: 'Harbor Master', color: '#ffd86b', wander: 0 }),
    fisher: makeChar('v2', P.fisher, { name: 'Fisherman', color: '#ffffff', wander: 0, dir: 'up' }),
    v1: makeChar('v1', P.v1, { name: 'Villager', wander: 5 }),
  };
  for (const n of Object.values(NPCS)) if (n.src) { n.name = SOURCES[n.src].name; n.color = SOURCES[n.src].color; }
}

// ---------- state ----------
// The contract (or its local copy) owns coins, prices, positions and items. S mirrors it for drawing.
let S;
const EVN = id => EVENTS.find(e => e.id === id);
async function boot() {
  await Backend.ensurePlayer(askName);
  const p = await Backend.player();
  S = freshState(p);
  makeCast();
  if (p.finished || p.day === 1 && !p.commitment && !p.history.length) await guarded('Starting a new season', () => Backend.call('start_season'), 'start_season');
  await beginDay(true);
  toast('You owe the Harbor Master 5,000 coins. You have ' + fmt(S.coins) + ' and ' + (SEASON_DAYS - S.day + 1) + ' days.', 6);
}
function freshState(p) {
  return {
    day: p.day, t: 0, coins: 0, positions: [], lev: 2, bridge: false, boat: false, chest: false, fishDay: 0,
    price: Object.fromEntries(GOODS.map(g => [g.id, g.base])), closes: Object.fromEntries(GOODS.map(g => [g.id, [g.base]])),
    rec: Object.fromEntries(Object.keys(SOURCES).map(k => [k, { ok: 0, tot: 0 }])), notes: [], step: 0, over: false, history: [],
    best: +(safeGet('pb2_best') || 0), sel: 1, dir: 1, mult: 2, stake: 100, warned: false, rumors: {}, heard: {}, weather: null,
  };
}
async function newSeason() {
  await guarded('Starting a new season', () => Backend.call('start_season'), 'start_season');
  const p = await Backend.player();
  S = freshState(p); makeCast();
  await beginDay(true);
  toast('New season. You owe 5,000 again. Who will lie to you this time?', 5);
}
async function sync() {
  const p = await Backend.player();
  const [x5, x10, bridge, boat] = await Backend.balances(['license_x5', 'license_x10', 'bridge', 'boat']);
  S.day = p.day; S.coins = p.coins / 100; S.chest = p.chest; S.fishDay = p.fish_day; S.seerDay = p.seer_day;
  GOODS.forEach((g, i) => S.price[g.id] = p.prices[i] / 1000);
  S.positions = p.positions.map(q => ({ good: GOODS[q.good].id, dir: q.long ? 1 : -1, lev: q.lev, stake: q.stake / 100, entry: q.entry / 1000 }));
  S.lev = x10 ? 10 : x5 ? 5 : 2;
  if (bridge && !S.bridge) { World.repairBridge(); MINI = World.minimap(176, 102); }
  S.bridge = !!bridge; S.boat = !!boat;
  if (S.chest) { World.P.chestProp.sx = 9; }
  S.player = p;
  return p;
}
async function beginDay(first) {
  const d = await guarded('Committing today to NEAR', () => Backend.beginDay(), 'commit_day');
  if (!d) return;
  if (d.finished) { await sync(); endSeason(S.player.won); return; }
  S.t = 0; S.warned = false; S.heard = {}; S.weather = d.weather;
  S.rumors = {};
  for (const [k, r] of Object.entries(d.rumors)) S.rumors[k] = r.quiet ? { quiet: true } : { ev: EVENTS[r.ev], evIdx: r.ev, lying: !!r.lying };
  const r = NPCS.rita, spot = S.rumors.rita.lying ? World.P.ritaMarket : World.P.ritaHome;
  r.x = r.home.x = spot.x * TW; r.y = r.home.y = spot.y * TW;
  r.selling = S.rumors.rita.lying ? GOOD(S.rumors.rita.ev.good).name : null;
  await sync();
  if (!first) { player.x = World.P.homeDoor.x * TW; player.y = (World.P.homeDoor.y + .6) * TW; player.dir = 'down'; }
}
const worth = () => S.coins + S.positions.reduce((a, p) => a + p.stake, 0);

// Run a contract call with a busy overlay, an on-screen chain log entry and error handling.
let busyN = 0, quietBusy = false;
const wait = ms => new Promise(r => setTimeout(r, ms));
function walkTo(x, y, dir) { return new Promise(done => { player.auto = { x, y, dir, done }; }); }
async function guarded(label, fn, tag) {
  busyN++; $('busy').textContent = label + '...'; if (!quietBusy) $('busy').style.display = 'block';
  try {
    const r = await fn();
    const tx = typeof r === 'string' ? r : r && r.tx;
    chainLog(tag || label, true, tx);
    return r;
  } catch (e) {
    chainLog(tag || label, false); sfx('alert'); toast(e.message || String(e), 3.5);
    return null;
  } finally { if (--busyN === 0) $('busy').style.display = 'none'; }
}
const txHistory = [];
function chainLog(what, ok, tx) {
  if (Backend.mode === 'local') return;
  const el = $('chainlog'), url = Backend.explorerTx(tx);
  const row = document.createElement('div');
  const html = `<span class="${ok ? 'up' : 'dn'}">${ok ? '✓' : '✗'}</span> ${what}${url ? ` <a href="${url}" target="_blank" rel="noopener">tx ↗</a>` : ''}`;
  row.innerHTML = html;
  el.prepend(row); while (el.children.length > 4) el.lastChild.remove();
  setTimeout(() => { row.classList.add('gone'); setTimeout(() => row.remove(), 600); }, 7000);
  txHistory.unshift(html); txHistory.length = Math.min(txHistory.length, 12);
}
function askName() {
  return new Promise(res => {
    openCard(`<div class="ntitle">WELCOME TO PIXEL BAZAAR</div>
      <div class="sub" style="text-align:center;margin-bottom:.8em">Pick a trader name. We create a NEAR ${Backend.cfg.network || ''} account for you, no wallet needed.<br>Your game key stays in this browser and can only play this game.</div>
      ${askName.error ? `<div class="dn" style="text-align:center">${askName.error}</div>` : ''}
      <div style="display:flex;gap:.6em;justify-content:center;align-items:center;flex-wrap:wrap"><input id="nameIn" maxlength="31" autocomplete="off" placeholder="your-name" value="${(askName.last || '')}">
      <span class="sub">.${Backend.cfg.contractId}</span></div>
      <div style="text-align:center"><button class="btn big gold" id="cardBtn">CREATE MY ACCOUNT</button></div>`, () => {});
    const go = () => { const v = $('nameIn').value.trim().toLowerCase(); askName.last = v; $('card').classList.remove('on'); res(v); };
    $('cardBtn').onclick = go; $('nameIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; $('nameIn').focus();
  });
}

// ---------- trading ----------
function previewOutcome(stake, lev) {
  const win = Math.round(stake * lev * 0.5), lossPct = 0.38 * lev;
  return { win, lose: lossPct >= 1 ? null : -Math.round(stake * lossPct) };
}
async function openPosition() {
  const g = GOODS[S.sel];
  if (S.mult > S.lev) { sfx('alert'); toast('You need a license for x' + S.mult + '.', 2); return; }
  if (S.stake > S.coins || S.stake <= 0) { sfx('alert'); toast('Not enough coins.', 2); return; }
  const ok = await guarded(`Opening ${S.dir > 0 ? 'long' : 'short'} ${g.name} x${S.mult}`, () => Backend.call('open_position', { good: S.sel, long: S.dir > 0, lev: S.mult, stake: Math.round(S.stake * 100) }), `open_position · ${S.dir > 0 ? 'LONG' : 'SHORT'} ${g.name.toUpperCase()} x${S.mult}`);
  if (ok === null && Backend.mode === 'chain') return;
  await sync(); sfx('coin');
  if (S.step === 1) advance();
  S.stake = Math.min(S.stake, Math.max(STAKE_STEP, Math.floor(S.coins / STAKE_STEP) * STAKE_STEP));
  renderTrade();
}
async function buyItem(token, label) {
  const cost = Rules.ITEMS[token];
  if (S.coins < cost) { sfx('alert'); toast(label + ' costs ' + cost + ' coins.', 2); return false; }
  const r = await guarded('Buying ' + label, () => Backend.call('buy_item', { token_id: token }), 'buy_item · ' + token + ' (NEP-245)');
  if (r === null && Backend.mode === 'chain') return false;
  await sync(); sfx('success'); toast(label + ' is yours.', 2.5); return true;
}
async function buyLicense(l) { if (S.lev >= l.lev) return; if (await buyItem('license_x' + l.lev, 'Leverage License x' + l.lev)) renderTrade(); }
async function claim(kind, label) {
  const r = await guarded(label, () => Backend.call('claim', { kind }), 'claim · ' + kind);
  if (r === null && Backend.mode === 'chain') return false;
  await sync(); return true;
}

// ---------- night ----------
async function sleep(passedOut) {
  if (S.over || S.sleeping) return;
  S.sleeping = true;
  let ok = false;
  try {
    closeTrade(); $('journal').classList.remove('on');
    if (!passedOut) { await walkTo(World.P.homeDoor.x * TW, (World.P.homeDoor.y - .25) * TW, 'up'); S.inside = true; sfx('ok'); }
    S.night = { start: performance.now(), dawn: 0, out: !!passedOut };
    quietBusy = true;
    const minNight = wait(2800);
    const before = worth(), prev = { ...S.price };
    const a = await guarded('Going to sleep', () => Backend.call('sleep', { passed_out: !!passedOut }), 'sleep');
    if (a === null && Backend.mode === 'chain') return;
    const r = await guarded('Revealing the night', () => Backend.settle(), 'settle_day · reveal checked against commitment');
    if (!r) return;
    await minNight;
    S.night.dawn = performance.now(); quietBusy = false;
    await wait(1800);
    ok = true;
    const log = r.log, ev = EVENTS[log.event];
    await sync();
    for (const g of GOODS) S.closes[g.id].push(S.price[g.id]);
    const results = log.results.map(x => ({ good: GOODS[x.good].id, dir: x.long ? 1 : -1, lev: x.lev, stake: x.stake / 100, pnl: x.pnl / 100, liq: x.liquidated }));
    const truths = Object.keys(S.heard).map(k => {
      const right = Rules.rumorRight(k, S.rumors[k].quiet ? { quiet: true } : { ev: S.rumors[k].evIdx }, log.event);
      S.rec[k].tot++; if (right) S.rec[k].ok++; return { k, right };
    });
    const notes = [];
    if (S.heard.rita && S.rumors.rita.lying && !S.notes.includes('rita')) { S.notes.push('rita'); notes.push('Rita lies on days she is selling at the market.'); }
    for (const k of ['sailor', 'farmer', 'hermit']) if (S.heard[k] && !S.notes.includes(k)) { S.notes.push(k); notes.push(noteFor(k)); }
    S.history.push({ day: log.day, ev: ev.id });
    showNight(ev, prev, results, truths, notes, before, worth(), log.passed_out_loss / 100, S.player.finished, S.player.won);
  } finally {
    S.sleeping = false; quietBusy = false;
    if (!ok) { S.night = null; S.inside = false; }
  }
}
const noteFor = k => SOURCES[k].name + ' only knows ' + SOURCES[k].domain.map(d => EVN(d).title.toLowerCase()).join(', ') + '.';
function showNight(ev, prev, results, truths, notes, before, after, lost, finished, won) {
  const g = GOOD(ev.good), cl = S.closes[g.id].slice(-6);
  const lo = Math.min(...cl) * .9, hi = Math.max(...cl) * 1.05;
  const bars = cl.map((v, i) => {
    const pv = i ? cl[i - 1] : v, top = Math.max(v, pv), bot = Math.min(v, pv);
    const y = h => 100 - (h - lo) / (hi - lo) * 100;
    return `<div class="cnd ${v >= pv ? 'g' : 'r'}" style="top:${y(top)}%;height:${Math.max(2, y(bot) - y(top))}%;left:${i * 16 + 4}%"></div>`;
  }).join('');
  const chg = Math.round((S.price[g.id] / prev[g.id] - 1) * 100);
  const diff = Math.round(after - before);
  sfx(diff >= 0 ? 'success' : 'alert');
  const pos = results.length ? results.map(r => `<div class="pos ${r.liq ? 'liq' : r.pnl >= 0 ? 'win' : 'loss'}">
      <span>${r.dir > 0 ? 'LONG' : 'SHORT'} ${GOOD(r.good).name.toUpperCase()} x${r.lev} · ${fmt(r.stake)}</span>
      <b>${r.liq ? '-' + fmt(r.stake) : (r.pnl >= 0 ? '+' : '') + fmt(r.pnl)}</b>${r.liq ? '<i class="stamp">LIQUIDATED</i>' : ''}</div>`).join('')
    : '<div class="sub">No positions tonight.</div>';
  const who = truths.length ? truths.map(t => `<span style="color:${SOURCES[t.k].color}">${SOURCES[t.k].name}</span> <span class="${t.right ? 'up' : 'dn'}">${t.right ? 'right' : 'wrong'}</span>`).join(' &nbsp; ') : 'You heard no rumors today.';
  openCard(`<div class="night">
    <div class="ntitle">NIGHT ${S.history.length} · ${ev.title.toUpperCase()}</div>
    <div class="ngrid">
      <div class="nbox"><div class="nh"><img src="assets/items/${g.icon}.png"> ${g.name.toUpperCase()} ${fmt(prev[g.id])} → ${fmt(S.price[g.id])} <span class="${chg >= 0 ? 'up' : 'dn'}">${chg >= 0 ? '+' : ''}${chg}%</span></div><div class="chart">${bars}</div>
        ${Backend.mode !== 'local' ? '<div class="sub" style="margin-top:.5em">Event was committed this morning and checked on reveal.</div>' : ''}</div>
      <div class="nbox">${lost ? `<div class="dn" style="margin-bottom:.5em">You passed out in the street. Pickpockets took ${fmt(lost)}.</div>` : ''}
        ${pos}
        <div class="who">${who}</div>
        ${notes.map(n => `<div class="note">Journal: ${n}</div>`).join('')}
        <div class="debt"><span>DEBT ${fmt(Math.min(S.coins, DEBT))} / ${fmt(DEBT)}</span><span>${finished ? 'season over' : (SEASON_DAYS - S.day + 1) + ' days left'}</span></div>
        <div class="bar"><div style="width:${Math.min(100, (finished && won ? DEBT : S.coins) / DEBT * 100)}%"></div></div>
      </div>
    </div>
    <button class="btn big gold" id="cardBtn">${finished ? 'FACE THE HARBOR MASTER' : 'WAKE UP · DAY ' + S.day}</button></div>`,
    async () => {
      S.night = null;
      if (finished) { S.inside = false; endSeason(won); return; }
      await beginDay(false);
      S.inside = false; player.x = World.P.homeDoor.x * TW; player.y = (World.P.homeDoor.y - .25) * TW;
      walkTo(player.x, player.y + 26, 'down');
      if (S.step === 2) advance();
      if (DAILY_TIPS[S.day]) toast(DAILY_TIPS[S.day], 6);
    });
}
async function endSeason(won, early) {
  S.over = true;
  const score = Math.round(won ? S.coins + DEBT : S.coins);
  if (won && score > S.best) { S.best = score; safeSet('pb2_best', score); }
  const share = won ? `I paid off a 5,000 coin debt in Pixel Bazaar on day ${S.day}, trading rumors with leverage on NEAR. Rita lied to me ${S.rec.rita.tot - S.rec.rita.ok} times. #NEARHackathon`
    : `The Harbor Master took my stall in Pixel Bazaar. I got to ${fmt(score)} of 5,000. #NEARHackathon`;
  let board = [];
  try { board = (await Backend.leaderboard()).slice(0, 5); } catch (e) {}
  const acct = Backend.accountId, link = Backend.explorerAccount(acct);
  openCard(`<div class="ntitle">${won ? 'DEBT PAID · THE STALL IS YOURS' : 'THE HARBOR MASTER TOOK YOUR STALL'}</div>
    <div class="sub" style="margin:.6em 0">${won ? `You cleared 5,000 coins ${early ? 'early, on day ' + S.day : 'by the last day'}. Coins left over: ${fmt(Math.max(0, S.coins))}.` : `You reached ${fmt(score)} of 5,000 coins.`}
    ${Backend.mode !== 'local' ? `<br>Season result recorded for ${link ? `<a href="${link}" target="_blank" rel="noopener">${acct}</a>` : acct}.` : ''}</div>
    ${board.length ? '<div class="gname" style="font-size:1em;margin-top:.4em">LEADERBOARD</div>' + board.map((e, i) => `<div class="tr"><span>${i + 1}. ${e.account}</span><span class="${e.won ? 'up' : 'dn'}">${fmt(e.score / 100)}${e.won ? ' · paid day ' + e.day : ''}</span></div>`).join('') : ''}
    <div class="sub" style="margin-top:.8em">${share}</div>
    <button class="btn big" id="copyBtn">COPY SHARE TEXT</button> <button class="btn big gold" id="cardBtn">NEW SEASON</button>`, () => newSeason());
  $('copyBtn').onclick = e => { e.stopPropagation(); const ok = () => toast('Copied.', 1.5), fail = () => toast('Copy failed. Select the text instead.', 2.5); try { navigator.clipboard.writeText(share).then(ok, fail); } catch (er) { fail(); } };
  sfx(won ? 'success' : 'alert');
}

// ---------- tutorial / objectives ----------
const STEPS = [
  { text: 'Talk to Mei by the market', target: () => NPCS.mei },
  { text: "Open a trade at Tomo's stall", target: () => NPCS.tomo },
  { text: 'Go home and sleep', target: () => at(World.P.homeDoor) },
  { text: 'Reach 5,000 coins, then see the Harbor Master', target: () => S.coins >= DEBT ? NPCS.master : null },
];
function advance() { S.step = Math.min(S.step + 1, STEPS.length - 1); sfx('ok'); }

// ---------- UI ----------
let dlg = null, cardCb = null;
const uiOpen = () => !!dlg || ['trade', 'card', 'journal'].some(id => $(id).classList.contains('on'));
function toast(t, sec = 2.5) { const el = $('toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => el.style.display = 'none', sec * 1000); }
function hideToast() { $('toast').style.display = 'none'; }
function openCard(html, cb) { hideToast(); $('card').innerHTML = html; $('card').classList.add('on'); cardCb = cb; $('cardBtn').onclick = closeCard; }
function closeCard() { $('card').classList.remove('on'); sfx('ok'); const cb = cardCb; cardCb = null; cb && cb(); }
function portrait(sheet, canvas) {
  const p = canvas.getContext('2d'); p.imageSmoothingEnabled = false; p.clearRect(0, 0, canvas.width, canvas.height);
  if (sheet) p.drawImage(IMG[sheet], 16, 2 * 64 + 8, 32, 32, 0, 0, canvas.width, canvas.height);
}
function say(who, text, choices) {
  portrait(who.sheet, $('portrait'));
  const rec = who.src && S.rec[who.src].tot ? `  ·  right ${S.rec[who.src].ok} of ${S.rec[who.src].tot}` : '';
  $('dlgName').textContent = who.name + rec; $('dlgName').style.color = who.color || '#fff';
  $('dlgText').textContent = text;
  dlg = { choices: choices || [{ t: 'OK', fn: closeDlg }], sel: 0 };
  renderChoices(); $('dialog').classList.add('on'); sfx('voice');
}
function renderChoices() {
  $('dlgChoices').innerHTML = dlg.choices.map((c, i) => `<span class="choice ${i === dlg.sel ? 'sel' : ''}" data-i="${i}">${c.t}</span>`).join('');
  $('dlgChoices').querySelectorAll('.choice').forEach(el => el.onclick = () => { dlg.sel = +el.dataset.i; chooseDlg(); });
}
function chooseDlg() { const c = dlg.choices[dlg.sel]; sfx('ok'); c.fn(); }
function closeDlg() { dlg = null; $('dialog').classList.remove('on'); }

function rumorText(k) {
  const r = S.rumors[k], s = SOURCES[k];
  if (r.quiet) return s.quiet;
  return (s.voice ? pick(s.voice) + ' ' : '') + r.ev.rumor;
}
function hear(k) {
  const first = !S.heard[k]; S.heard[k] = true;
  say(NPCS[k], '"' + rumorText(k) + '"');
  if (k === 'mei' && S.step === 0) advance();
}
function talkTo(n) {
  n.dir = faceToward(n, player);
  if (n.src === 'seer') {
    if (S.heard.seer || S.seerDay === S.day) { S.heard.seer = true; hear('seer'); return; }
    say(n, 'Cross my palm with 40 coins and I will tell you what tomorrow brings. Mostly.', [
      { t: 'PAY 40', fn: async () => { closeDlg(); if (S.coins < 40) { toast('Not enough coins.', 2); return; } if (await claim('seer', 'Paying Madame Vey')) hear('seer'); } },
      { t: 'NO THANKS', fn: closeDlg }]);
    return;
  }
  if (n.src) { hear(n.src); return; }
  if (n === NPCS.tomo) { say(n, 'Welcome to the trading post. Bet on tomorrow. Positions settle overnight.', [{ t: 'TRADE', fn: () => { closeDlg(); openTrade(); } }, { t: 'LEAVE', fn: closeDlg }]); return; }
  if (n === NPCS.master) {
    if (S.coins >= DEBT) { say(n, `${fmt(S.coins)} coins? Well, well. Pay the 5,000 and the stall is yours for good.`, [{ t: 'PAY 5,000', fn: async () => { closeDlg(); const r = await guarded('Paying the Harbor Master', () => Backend.call('pay_debt'), 'pay_debt'); if (r === null && Backend.mode === 'chain') return; await sync(); endSeason(true, true); } }, { t: 'NOT YET', fn: closeDlg }]); return; }
    say(n, `You owe me 5,000 by the end of day ${SEASON_DAYS}. You have ${fmt(S.coins)}. Tick tock.`);
    return;
  }
  if (n === NPCS.fisher) {
    if (S.fishDay === S.day) { say(n, 'That was the morning catch. Come back tomorrow before ten.'); return; }
    if (S.t / DAY_SECONDS > (10 - 6) / 18) { say(n, 'Too late, the catch is gone. Come before ten in the morning.'); return; }
    claim('fish', 'Taking the morning catch').then(ok => { if (ok) { sfx('coin'); say(n, `Early bird! Take a share of the morning catch. (+${FISH_GIFT} coins)`); } }); return;
  }
  say(n, pick(['Have you met Madame Vey in the woods? Spooky lady.', "The Old Sailor is never wrong about the sea.", 'Rita always seems to know which way prices go. Funny that.', 'Get home before midnight. Pickpockets love sleepy traders.']));
}

// ---------- trading screen ----------
function openTrade() { hideToast(); renderTrade(); $('trade').classList.add('on'); sfx('menu'); }
function closeTrade() { $('trade').classList.remove('on'); }
function renderTrade() {
  const g = GOODS[S.sel], price = S.price[g.id];
  const chips = Object.keys(S.heard).map(k => {
    const r = S.rumors[k]; if (r.quiet || r.ev.good !== g.id) return '';
    return `<span class="chip"><canvas data-face="${SOURCES[k].sheet}" width="40" height="40"></canvas><span class="${r.ev.up ? 'up' : 'dn'}">${r.ev.up ? '▲ UP' : '▼ DOWN'}</span></span>`;
  }).join('');
  const o = previewOutcome(S.stake, S.mult);
  const open = S.positions.map(p => `${p.dir > 0 ? '▲' : '▼'} ${GOOD(p.good).name} x${p.lev} · ${p.stake}`).join('   ');
  $('trade').innerHTML = `
    <div class="tg"><button class="arrow" id="tPrev">◀</button><img src="assets/items/${g.icon}.png"><div><div class="gname">${g.name.toUpperCase()}</div><div class="gprice">${fmt(price)}</div></div><button class="arrow" id="tNext">▶</button></div>
    <div class="chips">${chips || '<span class="sub">No rumors about ' + g.name.toLowerCase() + ' yet</span>'}</div>
    <div class="ls"><button class="dirb ${S.dir > 0 ? 'on long' : ''}" id="tLong">LONG</button><button class="dirb ${S.dir < 0 ? 'on short' : ''}" id="tShort">SHORT</button></div>
    <div class="mults">${[1, 2, 5, 10].map(m => `<button class="pill ${S.mult === m ? 'on' : ''} ${m > S.lev ? 'lock' : ''}" data-m="${m}">x${m}</button>`).join('')}</div>
    <div class="stake"><button class="arrow" id="tMinus">−</button><span>${S.stake}</span><img src="assets/items/GoldCoin.png"><button class="arrow" id="tPlus">+</button></div>
    <div class="out"><span class="up">▲ +${fmt(o.win)}</span><span class="dn">▼ ${o.lose === null ? 'REKT' : fmt(o.lose)}</span></div>
    <button class="btn big gold wide" id="tOpen">OPEN</button>
    <div class="tfoot"><span>${open || 'Coins ' + fmt(S.coins)}</span><span><button class="link" id="tLic">LICENSES</button> · <button class="link" id="tClose">CLOSE</button></span></div>`;
  $('trade').querySelectorAll('canvas[data-face]').forEach(c => portrait(c.dataset.face, c));
  $('tPrev').onclick = () => { S.sel = (S.sel + 3) % 4; sfx('menu'); renderTrade(); };
  $('tNext').onclick = () => { S.sel = (S.sel + 1) % 4; sfx('menu'); renderTrade(); };
  $('tLong').onclick = () => { S.dir = 1; renderTrade(); }; $('tShort').onclick = () => { S.dir = -1; renderTrade(); };
  $('trade').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const m = +b.dataset.m; if (m > S.lev) { toast('x' + m + ' needs a Leverage License (see LICENSES).', 2.5); sfx('alert'); return; } S.mult = m; renderTrade(); });
  $('tMinus').onclick = () => { S.stake = Math.max(STAKE_STEP, S.stake - STAKE_STEP); renderTrade(); };
  $('tPlus').onclick = () => { S.stake = Math.min(Math.max(STAKE_STEP, Math.floor(S.coins / STAKE_STEP) * STAKE_STEP), S.stake + STAKE_STEP); renderTrade(); };
  $('tOpen').onclick = openPosition; $('tClose').onclick = closeTrade;
  $('tLic').onclick = () => {
    $('trade').innerHTML = `<div class="gname" style="margin-bottom:.6em">LEVERAGE LICENSES</div>
      ${LICENSES.map(l => `<div class="tr"><span>x${l.lev} license</span><span>${S.lev >= l.lev ? '<span class="up">OWNED</span>' : `<button class="btn" data-l="${l.lev}">${l.cost} coins</button>`}</span></div>`).join('')}
      <div class="sub" style="margin-top:.6em">Licenses are items you keep. Higher leverage, faster liquidation.</div>
      <button class="btn big" id="tBack">BACK</button>`;
    $('trade').querySelectorAll('[data-l]').forEach(b => b.onclick = () => buyLicense(LICENSES.find(l => l.lev === +b.dataset.l)));
    $('tBack').onclick = renderTrade;
  };
  hud();
}
function openJournal() { hideToast();
  const rows = Object.keys(SOURCES).map(k => {
    const s = SOURCES[k], r = S.rec[k];
    return `<div class="tr"><span style="color:${s.color}">${s.name}</span><span>${r.tot ? `right ${r.ok} of ${r.tot}` : '<span class="sub">not met</span>'}</span></div>`;
  }).join('');
  const notes = S.notes.map(n => n === 'rita' ? 'Rita lies on days she is selling at the market.' : noteFor(n));
  const today = Object.keys(S.heard).map(k => {
    const r = S.rumors[k], s = SOURCES[k];
    if (r.quiet) return `<div class="tr"><span style="color:${s.color}">${s.name}</span><span class="sub">nothing in their area</span></div>`;
    const g = GOOD(r.ev.good);
    return `<div class="tr"><span style="color:${s.color}">${s.name}</span><span>${r.ev.title} · <span class="${r.ev.up ? 'up' : 'dn'}">${g.name.toUpperCase()} ${r.ev.up ? '▲' : '▼'}</span></span></div>`;
  }).join('') || '<div class="sub">Nobody has told you anything today.</div>';
  $('journal').innerHTML = `<div class="gname">JOURNAL · DAY ${S.day}</div>
    <div class="jh">TODAY'S RUMORS</div>${today}
    <div class="jh">TRACK RECORDS</div>${rows}
    <div style="margin-top:.7em">${notes.length ? notes.map(n => `<div class="note">${n}</div>`).join('') : '<div class="sub">Catch someone in a lie and it goes here.</div>'}</div>
    <div class="tr" style="margin-top:.6em"><span>Items</span><span>x${S.lev} license${S.bridge ? ' · bridge' : ''}${S.boat ? ' · boat pass' : ''}</span></div>
    ${txHistory.length ? '<div class="jh">ON NEAR</div><div class="txh">' + txHistory.map(h => '<div>' + h + '</div>').join('') + '</div>' : ''}
    <button class="btn big" id="jClose">CLOSE (J)</button>`;
  $('journal').classList.add('on'); $('jClose').onclick = () => $('journal').classList.remove('on'); sfx('menu');
}
function clockText() { const m = 6 * 60 + Math.floor(S.t / DAY_SECONDS * 18 * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function hud() {
  $('coins').textContent = fmt(S.coins);
  $('day').textContent = 'DAY ' + S.day + '/' + SEASON_DAYS;
  const mins = 6 * 60 + Math.floor(S.t / DAY_SECONDS * 18 * 60);
  $('clock').textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  $('clock').style.color = mins >= 22 * 60 ? 'var(--bad)' : 'var(--gold)';
  $('debtFill').style.width = Math.min(100, worth() / DEBT * 100) + '%';
  $('obj').textContent = STEPS[S.step].text;
  const z = World.zone(Math.floor(player.x / TW), Math.floor(player.y / TW));
  $('zone').textContent = World.ZONE_NAME[z] || '';
}

// ---------- interaction ----------
function faceToward(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
function nearest() {
  const P = World.P, d2 = p => Math.hypot(player.x - p.x * TW, player.y - p.y * TW);
  let best = null, bd = 58;
  for (const n of Object.values(NPCS)) { const d = Math.hypot(n.x - player.x, n.y - player.y); if (d < bd) { bd = d; best = { kind: 'npc', n, label: 'TALK TO ' + n.name.toUpperCase() }; } }
  if (d2(P.board) < 44) best = { kind: 'board', label: 'READ NOTICE BOARD' };
  if (d2(P.homeDoor) < 44) best = { kind: 'home', label: 'SLEEP (END DAY)' };
  if (!S.bridge && d2(P.bridge) < 56) best = { kind: 'bridge', label: 'REPAIR BRIDGE (' + BRIDGE_COST + ')' };
  if (d2(P.boatDock) < 50) best = { kind: 'boat', label: S.boat ? 'SAIL TO THE ISLAND' : 'RENT A BOAT (' + BOAT_COST + ')' };
  if (d2(P.boatIsland) < 50) best = { kind: 'boatBack', label: 'SAIL BACK' };
  if (!S.chest && d2(P.chest) < 46) best = { kind: 'chest', label: 'OPEN CHEST' };
  return best;
}
function interact() {
  initAudio();
  if ($('card').classList.contains('on')) { closeCard(); return; }
  if (dlg) { chooseDlg(); return; }
  if ($('trade').classList.contains('on') || $('journal').classList.contains('on') || S.over) return;
  const t = nearest(); if (!t) return;
  const P = World.P, me = { name: 'You', sheet: 'player', color: '#ffd86b' };
  if (busyN) return;
  if (t.kind === 'npc') talkTo(t.n);
  else if (t.kind === 'board') {
    const rows = Object.keys(SOURCES).filter(k => S.rec[k].tot).map(k => `${SOURCES[k].name} ${S.rec[k].ok}/${S.rec[k].tot}`).join(' · ') || 'No records yet.';
    say({ name: 'Notice board', color: '#ffd86b' }, 'Rumor records: ' + rows + '  Recent: ' + (S.history.slice(-3).map(h => EVN(h.ev).title).join(', ') || 'nothing yet.'));
  } else if (t.kind === 'home') {
    const hour = 6 + S.t / DAY_SECONDS * 18;
    if (hour < 18) {
      say(me, `It's only ${clockText()}. The market is open until evening. You can sleep after 18:00.`, [
        { t: 'REST UNTIL 18:00', fn: () => { closeDlg(); S.t = DAY_SECONDS * 12 / 18; toast('You rest at home. The sun is setting.', 2.5); } },
        { t: 'GO BACK OUT', fn: closeDlg }]);
      return;
    }
    const open = S.positions.length;
    say(me, open ? `Sleep now? ${open} position${open > 1 ? 's' : ''} will settle overnight.` : 'Sleep now? You have no open positions.', [{ t: 'SLEEP', fn: () => { closeDlg(); sleep(false); } }, { t: 'NOT YET', fn: closeDlg }]);
  } else if (t.kind === 'bridge') {
    say(me, 'The bridge to the Hill Farms is broken. Repair it for ' + BRIDGE_COST + ' coins?', [{ t: 'REPAIR', fn: () => {
      closeDlg(); buyItem('bridge', 'The bridge repair').then(ok => ok && toast('The bridge is fixed. The farms are open.', 3));
    } }, { t: 'LATER', fn: closeDlg }]);
  } else if (t.kind === 'boat') {
    if (S.boat) { sail(P.boatIsland); return; }
    say(me, 'Rent a boat to the island for ' + BOAT_COST + ' coins? The pass is yours to keep.', [{ t: 'RENT', fn: () => {
      closeDlg(); buyItem('boat', 'The boat pass').then(ok => ok && sail(P.boatIsland));
    } }, { t: 'LATER', fn: closeDlg }]);
  } else if (t.kind === 'boatBack') sail(P.boatDock);
  else if (t.kind === 'chest') {
    claim('chest', 'Opening the chest').then(ok => { if (ok) { sfx('success'); P.chestProp.sx = 9; say(me, `An old merchant's chest. ${CHEST_COINS} coins inside!`); } });
  }
}
function sail(p) { player.x = p.x * TW; player.y = p.y * TW; S.t += DAY_SECONDS * .03; sfx('ok'); }

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => {
  initAudio();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (k === 'e' || k === ' ' || k === 'Enter') interact();
  if (k === 'Escape') { closeTrade(); $('journal').classList.remove('on'); if (dlg) closeDlg(); }
  if (k === 'j' && !dlg && !$('card').classList.contains('on')) $('journal').classList.contains('on') ? $('journal').classList.remove('on') : openJournal();
  if (k === 'm') toggleMusic();
  if (dlg && ['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(k)) { dlg.sel = (dlg.sel + (k === 'ArrowRight' || k === 'd' ? 1 : dlg.choices.length - 1)) % dlg.choices.length; renderChoices(); sfx('menu'); }
});
addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
document.querySelectorAll('#pad button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); if (k === 'e') interact(); else if (k === 'j') openJournal(); else keys[k] = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys[k] = false);
});
$('mute').onclick = toggleMusic; $('jBtn').onclick = () => { initAudio(); if (S) openJournal(); };
function toggleMusic() { musicOn = !musicOn; $('mute').textContent = musicOn ? '♪ ON' : '♪ OFF'; if (music) musicOn ? music.play().catch(() => {}) : music.pause(); }

// ---------- loop ----------
const cv = $('cv'), ctx = cv.getContext('2d');
function fit() {
  const r = cv.getBoundingClientRect(); const aspect = r.width && r.height ? r.width / r.height : 16 / 9;
  VW = Math.round(Math.max(600, Math.min(1500, VH * aspect)));
  if (cv.width !== VW) cv.width = VW;
  cv.height = VH; ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', fit); fit();
let MINI, last = performance.now(), wx = [];
for (let i = 0; i < 160; i++) wx.push({ x: Math.random() * VW, y: Math.random() * VH, s: .6 + Math.random() * .8 });
function update(dt) {
  if (!S) return;
  const busy = uiOpen() || S.over || busyN > 0 || S.sleeping;
  let dx = 0, dy = 0; const sp = 170 * dt;
  if (!busy) {
    if (keys.ArrowLeft || keys.a) dx -= sp; if (keys.ArrowRight || keys.d) dx += sp;
    if (keys.ArrowUp || keys.w) dy -= sp; if (keys.ArrowDown || keys.s) dy += sp;
    if (dx && dy) { dx *= .707; dy *= .707; }
  }
  if (player.auto) {
    const a = player.auto, vx = a.x - player.x, vy = a.y - player.y, d = Math.hypot(vx, vy), st = 120 * dt;
    if (d <= st) { player.x = a.x; player.y = a.y; player.moving = false; player.auto = null; a.done(); }
    else { player.x += vx / d * st; player.y += vy / d * st; player.moving = true; player.dir = a.dir; player.anim += dt * 10; }
    dx = dy = 0;
  } else player.moving = !!(dx || dy);
  if (player.moving && !player.auto) { player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); moveChar(player, dx, dy); player.anim += dt * 12; }
  for (const n of Object.values(NPCS)) {
    if (busy || !n.wander) { n.moving = false; if (Math.hypot(n.x - player.x, n.y - player.y) < 70) n.dir = faceToward(n, player); continue; }
    if (Math.hypot(n.x - player.x, n.y - player.y) < 70) { n.moving = false; n.dir = faceToward(n, player); continue; }
    if (n.pause > 0) { n.pause -= dt; n.moving = false; continue; }
    if (!n.target) n.target = { x: n.home.x + (Math.random() * 2 - 1) * n.wander * TW, y: n.home.y + (Math.random() * 2 - 1) * n.wander * TW * .5 };
    const vx = n.target.x - n.x, vy = n.target.y - n.y, d = Math.hypot(vx, vy);
    if (d < 4) { n.target = null; n.pause = 1 + Math.random() * 3; n.moving = false; continue; }
    const s = 55 * dt, ox = n.x, oy = n.y; moveChar(n, vx / d * s, vy / d * s);
    if (n.x === ox && n.y === oy) { n.target = null; n.pause = 1; }
    n.moving = true; n.anim += dt * 9; n.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
  }
  if (!busy) {
    S.t += dt;
    if (S.t > DAY_SECONDS * (16 / 18) && !S.warned) { S.warned = true; toast("It's 22:00. Head home before midnight.", 3); sfx('alert'); }
    if (S.t >= DAY_SECONDS && !S.sleeping) { S.t = DAY_SECONDS; sleep(true); }
  }
  hud();
}
function draw() {
  if (!S) return;
  const MWp = World.W * TW, MHp = World.H * TW;
  const camX = Math.max(0, Math.min(MWp - VW, player.x - VW / 2)), camY = Math.max(0, Math.min(MHp - VH, player.y - VH / 2));
  ctx.fillStyle = '#5ec6e6'; ctx.fillRect(0, 0, VW, VH);
  ctx.drawImage(MAP.ground, camX, camY, VW, VH, 0, 0, VW, VH);
  const vis = (x, y, w, h) => x + w > camX - 64 && x < camX + VW + 64 && y + h > camY - 64 && y < camY + VH + 96;
  const list = [];
  for (const p of MAP.props) { const x = p.x * TW, y = p.y * TW; if (vis(x, y, p.w * TW, p.h * TW)) list.push({ base: p.flat ? -1 : (p.y + p.h) * TW, p }); }
  for (const c of Object.values(NPCS).concat(S.inside ? [] : player)) if (vis(c.x - 32, c.y - 60, 64, 64)) list.push({ base: c.y, c });
  list.sort((a, b) => a.base - b.base);
  for (const o of list) {
    if (o.p) { const p = o.p; ctx.drawImage(IMG[p.img], p.sx * TS, p.sy * TS, p.w * TS, p.h * TS, p.x * TW - camX, p.y * TW - camY, p.w * TW, p.h * TW); }
    else drawChar(ctx, o.c, camX, camY);
  }
  ctx.font = '10px Joy, monospace'; ctx.textAlign = 'center';
  for (const n of Object.values(NPCS)) {
    if (!n.color || !vis(n.x - 32, n.y - 60, 64, 64)) continue;
    const w = ctx.measureText(n.name).width + 8; ctx.fillStyle = '#000a'; ctx.fillRect(n.x - camX - w / 2, n.y - camY - 74, w, 13);
    ctx.fillStyle = n.color; ctx.fillText(n.name, n.x - camX, n.y - camY - 64);
    if (n.selling) { const t = 'SELLING ' + n.selling.toUpperCase() + '!'; const w2 = ctx.measureText(t).width + 10; ctx.fillStyle = '#fff3d6'; ctx.fillRect(n.x - camX - w2 / 2, n.y - camY - 92, w2, 15); ctx.fillStyle = '#1c1630'; ctx.fillText(t, n.x - camX, n.y - camY - 81); }
  }
  // evening, night and the weather clue
  const f = S.t / DAY_SECONDS;
  if (f > .6) { ctx.fillStyle = `rgba(25,18,80,${(f - .6) / .4 * .5})`; ctx.fillRect(0, 0, VW, VH); }
  if (f > .55 && S.weather) {
    const snow = S.weather === 'snow', a = Math.min(1, (f - .55) / .1);
    ctx.strokeStyle = `rgba(190,205,255,${.55 * a})`; ctx.fillStyle = `rgba(255,255,255,${.8 * a})`; ctx.lineWidth = 2;
    for (const d of wx) {
      if (snow) { d.y += d.s * 1.2; d.x += Math.sin(d.y / 30) * .5; ctx.fillRect(d.x, d.y, 3, 3); }
      else { d.y += d.s * 14; d.x -= d.s * 3; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 5, d.y + 16); ctx.stroke(); }
      if (d.y > VH) { d.y = -20; d.x = Math.random() * (VW + 100); }
    }
  }
  drawNight(camX, camY);
  // objective marker / edge arrow
  const tgt = STEPS[S.step].target();
  if (tgt && !uiOpen() && !S.night) {
    const tx = tgt.x - camX, ty = tgt.y - camY - 70;
    ctx.fillStyle = '#ffd86b';
    if (tx > 20 && tx < VW - 20 && ty > 20 && ty < VH - 20) {
      const b = Math.sin(performance.now() / 180) * 4; ctx.beginPath(); ctx.moveTo(tx - 9, ty - 18 + b); ctx.lineTo(tx + 9, ty - 18 + b); ctx.lineTo(tx, ty - 6 + b); ctx.fill();
    } else {
      const ang = Math.atan2(ty - VH / 2, tx - VW / 2), ex = VW / 2 + Math.cos(ang) * (VW / 2 - 30), ey = VH / 2 + Math.sin(ang) * (VH / 2 - 30);
      ctx.save(); ctx.translate(Math.max(30, Math.min(VW - 30, ex)), Math.max(30, Math.min(VH - 30, ey))); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.fill(); ctx.restore();
    }
  }
  // minimap
  const mw = 176, mh = 102, mx = VW - mw - 12, my = 56;
  ctx.globalAlpha = .92; ctx.drawImage(MINI, mx, my); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  const sx = mw / MWp, sy = mh / MHp;
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1; ctx.strokeRect(mx + camX * sx, my + camY * sy, VW * sx, VH * sy);
  if (tgt) { ctx.fillStyle = '#ffd86b'; ctx.fillRect(mx + tgt.x * sx - 2, my + tgt.y * sy - 2, 5, 5); }
  ctx.fillStyle = '#ff4d6d'; ctx.fillRect(mx + player.x * sx - 2, my + player.y * sy - 3, 5, 5);
  const t = !uiOpen() && !S.over && !S.night && nearest();
  $('hint').style.display = t ? 'block' : 'none'; if (t) $('hint').textContent = (matchMedia('(pointer:coarse)').matches ? 'A: ' : 'E: ') + t.label;
}
const STARS = Array.from({ length: 90 }, () => [Math.random(), Math.random() * .55, Math.random()]);
function drawNight(camX, camY) {
  const n = S.night; if (!n) return;
  const now = performance.now(), k = Math.min(1, (now - n.start) / 1500);
  let dark = .78 * k, warm = 0;
  if (n.dawn) { const d = Math.min(1, (now - n.dawn) / 1800); dark = .78 * (1 - d); warm = Math.sin(Math.PI * d) * .32; }
  ctx.fillStyle = `rgba(10,8,40,${dark})`; ctx.fillRect(0, 0, VW, VH);
  if (warm) { ctx.fillStyle = `rgba(255,150,70,${warm})`; ctx.fillRect(0, 0, VW, VH); }
  // stars and moon
  ctx.fillStyle = `rgba(255,255,230,${dark})`;
  for (const [x, y, t] of STARS) { const tw = .5 + .5 * Math.sin(now / 400 + t * 9); ctx.globalAlpha = dark * tw; ctx.fillRect(x * VW, y * VH, 2, 2); }
  if (dark > .05) {
    const mg = ctx.createRadialGradient(VW - 240, 70, 10, VW - 240, 70, 60);
    mg.addColorStop(0, `rgba(255,246,200,${.35 * dark})`); mg.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = mg; ctx.fillRect(VW - 300, 10, 120, 120);
    ctx.globalAlpha = dark; ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(VW - 240, 70, 18, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (!n.out) {
    // warm light from the doorway and sleepy z's over the house
    const hx = World.P.homeDoor.x * TW - camX, hy = (World.P.homeDoor.y - .7) * TW - camY;
    const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 70);
    g.addColorStop(0, `rgba(255,210,120,${.75 * dark})`); g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.fillRect(hx - 80, hy - 80, 160, 160);
    ctx.font = '16px Joy, monospace'; ctx.textAlign = 'left';
    for (let i = 0; i < 3; i++) {
      const p = ((now / 1400) + i / 3) % 1;
      ctx.fillStyle = `rgba(255,255,255,${dark * (1 - p)})`;
      ctx.fillText('z', hx + 20 + p * 30 + Math.sin(p * 6) * 6, hy - 60 - p * 60);
    }
  }
  ctx.font = '13px Joy, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,243,214,${Math.max(dark, .0)})`;
  ctx.fillText(n.dawn ? 'Morning comes...' : n.out ? 'You collapse in the street...' : (Backend.mode === 'local' ? 'The night passes...' : 'The night passes... settling on NEAR'), VW / 2, VH - 40);
}
function loop(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }

loadAll().then(async () => { MAP = World.build(IMG); MINI = World.minimap(176, 102); requestAnimationFrame(loop); await boot(); })
  .catch(err => { document.body.innerHTML = '<p style="padding:2em;font-family:monospace;color:#fff">Could not load game files: ' + err.message + '</p>'; });

window.PB = { get S() { return S; }, get NPCS() { return NPCS; }, get player() { return player; }, sleep, interact, openTrade, openPosition, talkTo, sync, Backend, World };
