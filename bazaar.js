// ---------- The Bazaar: baron stalls in town, the Bazaar Board (sealed calls, barons, their activity), the night crew ----------
// The rules live on chain (contract/src/lib.rs) and in shared/engine.js; this file only shows them.

// ---- the market row: one stall per baron, on the grass south of the market road ----
const STALL_Y = 41.9, STALL_ROW = [41.5, 44.5, 47.5, 50.5, 53.5]; // left tile of each stall, by agent index (Kaito, Rita, Pell, Bolt, Luna)
const STALL_COL = ['#7fbf5a', '#e8b84a', '#e8884a', '#5aa8e8', '#4ac0a0'];
const stallIcon = {};
let stallsPlaced = false;
const stallGood = k => GOODS[Rules.AGENTS[k].stall];
const heldStall = k => (S.stalls || []).find(s => s[0] === k);
function placeStalls() { // the counters block movement, like any other prop
  if (stallsPlaced || !MAP || WD.id !== 'town') return; stallsPlaced = true;
  for (const x0 of STALL_ROW) for (let x = Math.floor(x0); x < Math.ceil(x0 + 2); x++) for (const y of [42, 43]) if (MAP.solid[y]) MAP.solid[y][x] = true;
}
const KEEPERS = Rules.AGENTS.map((a, k) => ({ sheet: a.sheet, x: (STALL_ROW[k] + 1) * TW, y: (STALL_Y + 1.55) * TW, dir: 'down', moving: false, anim: 0 }));
function stallDrawables(camX, camY) {
  if (WD.id !== 'town') return [];
  placeStalls();
  const out = [];
  STALL_ROW.forEach((x0, k) => {
    const sx = x0 * TW, sy = STALL_Y * TW;
    if (sx + 2 * TW < camX - 64 || sx > camX + VW + 64 || sy > camY + VH + 96 || sy + 3 * TW < camY - 64) return;
    // Kaito and Rita walk the town themselves (Rita stands at her stall on the days she lies); the others mind theirs, and a stall you hold gets your clerk
    const keeper = heldStall(k) ? { ...KEEPERS[k], sheet: 'player' } : k >= 2 ? KEEPERS[k] : null;
    if (keeper) out.push({ base: (STALL_Y + 2) * TW - 1, draw: () => drawChar(ctx, keeper, camX, camY) });
    out.push({ base: (STALL_Y + 2) * TW, draw: () => drawStall(k, sx - camX, sy - camY) });
  });
  return out;
}
function drawStall(k, x, y) {
  const w = 2 * TW, g = stallGood(k), mine = heldStall(k), col = STALL_COL[k];
  if (!stallIcon[g.id]) { stallIcon[g.id] = new Image(); stallIcon[g.id].src = goodIcon(goodIdx(g.id)); }
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(x + 2, y + 18, 4, 46); ctx.fillRect(x + w - 6, y + 18, 4, 46);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff3d6' : col; ctx.fillRect(x - 4 + i * (w + 8) / 8, y + 10, (w + 8) / 8, 16); }
  ctx.fillStyle = '#00000044'; ctx.fillRect(x - 4, y + 26, w + 8, 4);
  ctx.fillStyle = '#8a5a32'; ctx.fillRect(x - 2, y + 46, w + 4, 18); ctx.fillStyle = '#6a4224'; ctx.fillRect(x - 2, y + 60, w + 4, 4);
  if (stallIcon[g.id].complete) for (let i = 0; i < 3; i++) ctx.drawImage(stallIcon[g.id], x + 4 + i * 18, y + 32, 16, 16);
  ctx.save(); ctx.font = '10px Joy, monospace'; ctx.textAlign = 'center';
  const t1 = g.name.toUpperCase(), t2 = mine ? 'YOU · LV' + mine[2] : ['KAITO', 'RITA', 'PELL', 'BOLT-9', 'LUNA'][k]; // short: five plates share one row
  const ww = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + 12;
  ctx.fillStyle = mine ? 'rgba(80,60,10,.92)' : 'rgba(28,22,48,.9)'; ctx.fillRect(x + w / 2 - ww / 2, y - 26, ww, 30);
  ctx.strokeStyle = mine ? '#ffd86b' : col; ctx.lineWidth = 2; ctx.strokeRect(x + w / 2 - ww / 2, y - 26, ww, 30);
  ctx.fillStyle = '#fff3d6'; ctx.fillText(t1, x + w / 2, y - 13); ctx.fillStyle = mine ? '#ffd86b' : '#ff9a8a'; ctx.fillText(t2, x + w / 2, y);
  if (mine) { ctx.font = '15px monospace'; ctx.fillText('👑', x + w / 2, y - 30); }
  ctx.restore();
}
function stallTarget() {
  if (WD.id !== 'town') return null;
  for (let k = 0; k < 5; k++) {
    const cx = (STALL_ROW[k] + 1) * TW, cy = (STALL_Y - .3) * TW; // in front of the counter, on the road
    if (Math.hypot(player.x - cx, player.y - cy) < 46) return { kind: 'stall', k, label: `${stallGood(k).name.toUpperCase()} STALL: THE BARON RACE` };
  }
  return null;
}

// ---- today's sealed calls ----
function applyCalls(d) {
  S.calls = d.calls || []; S.kaito = d.kaito || null; S.agents = d.agents || {};
  if (NPCS && NPCS.kaito) NPCS.kaito.selling = S.kaito ? `${S.kaito.long ? 'LONG' : 'SHORT'} ${GOODS[S.kaito.good].name.toUpperCase()} x5` : null;
}
async function refreshCalls() { try { applyCalls(await Backend.calls()); } catch (e) { console.warn('calls', e); } }
const recText = k => { const p = S.player, t = (p.npc_total || [])[k] || 0; return t ? `${(p.npc_right || [])[k] || 0}/${t} right` : 'no record yet'; };
const CALLABLE = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11];
function callsHTML() {
  const p = S.player, calls = S.calls || [];
  const rows = Rules.AGENTS.map((a, k) => {
    const c = calls[k] || { has: false };
    const status = !c.has ? '<span class="sub">no call today</span>'
      : c.open ? `<span class="${c.long ? 'up' : 'dn'}">${c.long ? '▲ LONG' : '▼ SHORT'} ${GOODS[c.good].name.toUpperCase()} ×5</span>`
      : '<span class="sub">🔒 sealed on NEAR until night</span>';
    return `<div class="bCall">${`<canvas class="bFace" data-face="${a.sheet}" width="48" height="48"></canvas>`}<div style="flex:1"><b>${a.name}</b> <span class="sub">${recText(k)}</span><br>${status}</div>
      ${c.has && !c.open ? `<button class="btn" data-peek="${k}">PEEK ${a.peek}</button>` : ''}</div>`;
  }).join('');
  const mine = p.call ? `<div class="nMine">You called <b class="${p.call.long ? 'up' : 'dn'}">${p.call.long ? 'LONG' : 'SHORT'} ${GOODS[p.call.good].name.toUpperCase()}</b> today. NEAR reveals it tonight with the event.</div>`
    : `<div class="sub" style="margin:.2em 0 .4em">Will a price rise or fall tonight? A right call pays ${Rules.CREW.CALL_REWARD} coins and builds your record.</div>
      <div class="cGoods">${CALLABLE.map(g => `<button class="chipBtn ${ISL.callGood === g ? 'on' : ''}" data-cg="${g}"><img src="${goodIcon(g)}" alt=""> ${GOODS[g].name}</button>`).join('')}</div>
      <div style="display:flex;gap:.5em;margin-top:.5em"><button class="btn gold" data-cl="1">▲ CALL LONG</button><button class="btn" data-cl="0">▼ CALL SHORT</button></div>`;
  const posts = (ISL.posts || []).slice().reverse().slice(0, 8).map(c => `<div class="nRow"><span><b class="${c.who === Backend.accountId ? 'gold' : 'cy'}">${c.who === Backend.accountId ? 'You' : shortName(c.who)}</b> · ${c.long ? '▲ LONG' : '▼ SHORT'} ${GOODS[c.good].name}<br><span class="sub">day ${c.day} · ${ago(c.at)}</span></span>
    <span>${c.right === true ? '<b class="up">✓ RIGHT</b>' : c.right === false ? '<b class="dn">✗ WRONG</b>' : '<span class="sub">tonight</span>'}</span></div>`).join('') || '<div class="sub">No calls yet.</div>';
  return `<div class="bCols2"><div><div class="gold bH">TODAY'S AGENT CALLS</div>${rows}
      <div class="sub" style="margin-top:.4em">Their calls go into today's sealed commitment and are revealed tonight. Peeking pays the agent, on chain.</div></div>
    <div><div class="gold bH">YOUR CALL · ${p.call_right || 0}/${p.call_total || 0} RIGHT</div>${mine}
      <div class="gold bH" style="margin-top:.8em">LATEST CALLS</div>${posts}</div></div>`;
}
function bindCalls(el) {
  el.querySelectorAll('[data-peek]').forEach(b => b.onclick = () => {
    const k = +b.dataset.peek, a = Rules.AGENTS[k];
    if (S.coins < a.peek) { toast(`Peeking at ${a.name} costs ${a.peek} coins.`, 3); return; }
    queue({ t: 'Peek', agent: k }, 'peek at ' + a.id, true); sfx('coin');
    flush.after = async () => { await refreshCalls(); const c = (S.calls || [])[k]; if (c && c.open) toast(`${a.name}: ${c.long ? 'LONG' : 'SHORT'} ${GOODS[c.good].name.toUpperCase()}. Follow or fade?`, 5); openIsland('calls'); };
  });
  el.querySelectorAll('[data-cg]').forEach(b => b.onclick = () => { ISL.callGood = +b.dataset.cg; openIsland('calls'); });
  el.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => {
    const g = ISL.callGood ?? 0, long = b.dataset.cl === '1';
    queue({ t: 'PostCall', good: g, long }, 'call', true); sfx('ok');
    flush.after = () => { toast(`You called ${long ? 'LONG' : 'SHORT'} ${GOODS[g].name.toUpperCase()}. Sealed until tonight.`, 4); openIsland('calls'); };
  });
}

// ---- talking to one stall: a small dialog, not the whole board ----
function stallTalk(k) {
  const a = Rules.AGENTS[k], g = stallGood(k), p = S.player, h = heldStall(k);
  const mine = (p.stall_score || [])[k] / 100 || 0, bar = Rules.baronBar(p, k) / 100;
  const line = h
    ? `Your ${g.name} stall (level ${h[2]}). ${a.name} wants it back: keep your ${g.name.toLowerCase()} score above ${fmt(bar)} this season. You have ${fmt(mine)}.`
    : `${a.name}'s ${g.name} stall. Out-trade the baron on ${g.name.toLowerCase()}: you have ${fmt(mine)} of ${fmt(bar)}. Beat it by season's end (and pay your debt) and the stall NFT is yours, with rent every night.`;
  say({ name: h ? `Your ${g.name} stall` : `${a.name} · ${g.name} stall`, sheet: h ? null : a.sheet, color: '#ffd86b' }, line, [
    { t: `TRADE ${g.name.toUpperCase()}`, fn: () => { closeDlg(); S.sel = GOODS.indexOf(g); openTrade(); } },
    { t: 'ALL STALLS', fn: () => { closeDlg(); openIsland('barons'); } },
    { t: 'BYE', fn: closeDlg }]);
}

// ---- the barons: who holds which stall, and how close you are ----
function baronsHTML() {
  const p = S.player, held = (S.stalls || []).length;
  const last = { 1: '<b class="up">WON LAST SEASON</b>', 2: '<b class="up">DEFENDED LAST SEASON</b>', '-1': '<b class="dn">LOST LAST SEASON</b>' };
  const rows = Rules.AGENTS.map((a, k) => {
    const g = stallGood(k), mine = (p.stall_score || [])[k] / 100 || 0, bar = Rules.baronBar(p, k) / 100, h = heldStall(k);
    const pct = Math.max(0, Math.min(100, bar > 0 ? mine / bar * 100 : 100));
    return `<div class="bBaron"><canvas class="bFace" data-face="${h ? 'player' : a.sheet}" width="48" height="48"></canvas><div style="flex:1">
      <b>${g.name.toUpperCase()} STALL</b> <span class="sub">· ${h ? `<b class="gold">YOURS · LV ${h[2]}</b> · ${a.name} wants it back` : 'held by ' + a.name}</span> ${last[(p.stall_last || [])[k]] || ''}
      <div class="bVs"><i style="width:${pct}%"></i></div>
      <span class="sub">You ${fmt(mine)} · ${h ? 'keep at least' : 'beat'} ${fmt(bar)} by season's end. Trade or sell ${g.name.toLowerCase()} to score.</span></div></div>`;
  }).join('');
  return `<div class="sub" style="margin-bottom:.5em;line-height:1.6">Every stall is held by a baron. Out-trade one on their own good by the end of the season (and pay your debt) and the stall NFT is yours: it pays rent every night and sells that good 10% higher. Next season the baron fights back with a higher bar; fall short and the NFT goes back to them on chain.</div>
    ${rows}<div class="nMine" style="margin-top:.6em">STALLS ${held} / 5 · STORY ${Math.min(5, S.player.chapter > 5 ? 5 : S.player.chapter - 1)} / 5 CHAPTERS<br><span class="sub">Hold all five stalls and finish the story to become</span> <b class="gold">LANTERN KEEPER</b>.</div>`;
}

// ---- what the barons did lately (from your own revealed nights) ----
function baronActivity() {
  const hist = (S.player.history || []).slice(-3).reverse(), names = Rules.AGENTS.map(a => a.name);
  const out = [];
  for (const h of hist) {
    for (const n of h.npc || []) out.push(`<div class="fRowI"><span class="sub">day ${h.day}</span> <b class="cy">${names[n.agent]}</b> went ${n.long ? 'LONG' : 'SHORT'} ${GOODS[n.good].name} <b class="${n.pnl >= 0 ? 'up' : 'dn'}">${n.pnl >= 0 ? '+' : ''}${fmt(n.pnl / 100)}</b></div>`);
    if (h.grudge) { const k = Rules.agentOf(h.grudge.from); out.push(`<div class="fRowI"><span class="sub">day ${h.day}</span> <b class="dn">${k >= 0 ? names[k] : 'A baron'}</b> cursed you with ${Rules.ISLAND.CURSES[h.grudge.kind].name} for fading them${h.grudge.blocked ? ' <b class="up">(your charm blocked it)</b>' : ''}</div>`); }
  }
  return out.length ? `<div class="gold bH">THE BARONS, LAST NIGHTS</div>${out.join('')}<div class="gold bH" style="margin-top:.7em">THE ISLAND</div>` : '';
}

// ---- the night crew tab (in the Spirits menu) ----
const EV_WARN = { 1: { storm: 'halved', catch: 'doubled' }, 4: { blight: 'halved', cold: 'halved', fair: 'doubled', cooks: 'doubled' }, 2: { fest: 'doubled' } };
function crewRange(s) { // what this spirit usually brings, on a quiet night
  const sp = Rules.SPECIES[s.species], lv = s.level, el = sp.el, got = {}; let cmin = 1e9, cmax = 0, shard = false, charm = false;
  for (let r = 0; r < 20; r++) for (const r2 of [0, 255]) {
    const [goods, coins, sh, ch] = Rules.crewWork(el, lv, sp.rar, s.shiny, 2, r, r2, S.player.charms || 0);
    for (const [g, q] of goods) { got[g] = got[g] || [1e9, 0]; got[g][0] = Math.min(got[g][0], q); got[g][1] = Math.max(got[g][1], q); }
    cmin = Math.min(cmin, coins); cmax = Math.max(cmax, coins); shard = shard || sh; charm = charm || ch;
  }
  const range = ([a, b]) => a === b ? a : a + '–' + b;
  const parts = el === 4 ? ['1–' + Math.max(...Object.values(got).map(v => v[1])) + ' vegetables']
    : Object.entries(got).filter(([g]) => +g !== 11).map(([g, r]) => `${range(r)} ${GOODS[g].name.toLowerCase()}`);
  if (got[11]) parts.push('maybe 1 jade');
  if (cmax > 0) parts.push(`${cmin}–${cmax} coins`); if (charm) parts.push('a charm'); if (shard) parts.push('maybe a lantern shard');
  return parts.join(', ');
}
function crewWarnings(el) {
  const heard = Object.keys(S.heard || {}).map(k => S.rumors && S.rumors[k]).filter(r => r && !r.quiet && r.ev);
  const w = EV_WARN[el] || {};
  return heard.filter(r => w[r.ev.id]).map(r => `${r.ev.title} rumor: ${w[r.ev.id]} if it's true`);
}
function crewHTML(sps) {
  const p = S.player, crew = (p.crew || []).filter(t => sps.some(s => s.token_id === t)), fed = new Set(p.fed || []);
  const slot = i => {
    const t = crew[i], s = t && sps.find(x => x.token_id === t);
    if (!s) return `<div class="cSlot empty"><div style="flex:1"><b>EMPTY SLOT</b><br><span class="sub">Pick a spirit to work tonight.</span></div><button class="btn gold" data-cpick="${i}">ADD</button></div>`;
    const sp = Rules.SPECIES[s.species], e = Rules.ELEMENTS[sp.el], job = Rules.CREW.JOBS[sp.el], warn = crewWarnings(sp.el);
    return `<div class="cSlot" style="border-color:${e.color}"><img src="${spiritFace(s.species)}" alt=""><div style="flex:1;min-width:0"><b>${s.shiny ? '✦ ' : ''}${s.name.toUpperCase()}</b> <span class="sub">LV ${s.level}</span><br>
      <span style="color:${e.color}">${e.name}</span> · <b class="gold">${job.job}</b> <span class="sub">${job.verb}</span><br><span class="sub">Tonight: ${crewRange(s)}</span>
      ${warn.map(x => `<br><span class="dn">⚠ ${x}</span>`).join('')}</div>
      <div style="text-align:right;flex:none">${fed.has(t) ? '<span class="up">✓ FED</span>' : `<button class="btn gold" data-feed="${t}">FEED</button>`}<br>
      <button class="btn" data-cpick="${i}" style="margin-top:.3em">SWAP</button><br><button class="btn" data-cdrop="${i}" style="margin-top:.3em">✕</button></div></div>`;
  };
  return `<div class="sub" style="margin:.4em 0;line-height:1.6">Up to ${Rules.CREW.MAX} spirits work while you sleep, each by its element. <b>A spirit only works if you fed it today.</b> The haul is rolled on NEAR from the sealed day, so tonight's event changes it: read the rumors. Each worker also gains ${Rules.CREW.XP} XP.</div>
    <div class="cGrid">${[0, 1, 2].map(slot).join('')}</div>
    ${ISL.crewPick !== undefined ? crewPicker(sps, crew) : ''}`;
}
function crewPicker(sps, crew) {
  const free = sps.filter(s => !crew.includes(s.token_id));
  return `<div class="cRumor"><b class="gold">PICK A SPIRIT FOR SLOT ${ISL.crewPick + 1}</b><div class="cPick">${free.map(s => { const sp = Rules.SPECIES[s.species], e = Rules.ELEMENTS[sp.el];
    return `<button class="chipBtn" data-cset="${s.token_id}" style="border-color:${e.color}"><img src="${spiritFace(s.species)}" alt=""> ${s.name} · <span style="color:${e.color}">${Rules.CREW.JOBS[sp.el].job}</span></button>`; }).join('') || '<span class="sub">All your spirits are already on the crew.</span>'}</div></div>`;
}
function bindCrew(el) {
  const crew = () => (S.player.crew || []).filter(t => (S.spirits || []).some(s => s.token_id === t));
  const save = tokens => { queue({ t: 'SetCrew', tokens }, 'night crew', true); flush.after = () => { delete ISL.crewPick; openBook('crew'); }; };
  el.querySelectorAll('[data-cpick]').forEach(b => b.onclick = () => { ISL.crewPick = +b.dataset.cpick; openBook('crew'); });
  el.querySelectorAll('[data-cdrop]').forEach(b => b.onclick = () => { const c = crew(); c.splice(+b.dataset.cdrop, 1); save(c); });
  el.querySelectorAll('[data-cset]').forEach(b => b.onclick = () => { const c = crew(); c[Math.min(ISL.crewPick, c.length)] = b.dataset.cset; save(c.filter(Boolean)); sfx('ok'); });
}

// ---- dawn: what the crew brought, your call, rent, grudges ----
function showHaul(log, then) {
  if (!log) return then();
  const crew = log.crew || [], ev = EVENTS[log.event];
  if (!crew.length && log.call == null && !log.rent && !log.grudge) return then();
  const NOTE = { 1: `${ev.title}: halved`, 2: `${ev.title}: doubled!`, 3: 'Hungry: you did not feed it, so it stayed home', 4: 'Barn full: some was left behind', 5: 'No longer with you' };
  const row = h => {
    const s = (S.spirits || []).find(x => x.token_id === h.token), name = s ? s.name : Rules.SPECIES[h.species].name, worked = h.note !== 3 && h.note !== 5;
    const items = h.goods.map(g => `<span><img src="${goodIcon(g.good)}" alt=""> ×${g.qty}</span>`).join('') + (h.coins ? `<span class="gold">+${h.coins} coins</span>` : '') + (h.shard ? '<span class="gold">✦ shard</span>' : '') + (h.charm ? '<span class="cy">+1 charm</span>' : '');
    return `<div class="hRow"><img src="${spiritFace(h.species)}" alt=""><div style="flex:1"><b>${name.toUpperCase()}</b> <span class="sub">· ${Rules.CREW.JOBS[h.job].job}</span>${NOTE[h.note] ? `<br><span class="${h.note >= 3 ? 'dn' : h.note === 2 ? 'up' : 'sub'}">${NOTE[h.note]}</span>` : ''}</div>
      <div class="hItems">${items || (worked ? '<span class="sub">nothing this time</span>' : '')}${worked ? `<span class="up">+${Rules.CREW.XP} XP</span>` : ''}</div></div>`;
  };
  const extra = [];
  if (log.call != null) extra.push(log.call ? `<b class="up">Your call was right: +${Rules.CREW.CALL_REWARD} coins.</b>` : '<b class="dn">Your call was wrong this time.</b>');
  if (log.rent) extra.push(`<span class="gold">Your stalls paid ${fmt(log.rent / 100)} coins of rent.</span>`);
  if (log.grudge) { const k = Rules.agentOf(log.grudge.from); extra.push(`<span class="dn">${k >= 0 ? Rules.AGENTS[k].name : 'A baron'} is furious you faded them and cursed you with ${Rules.ISLAND.CURSES[log.grudge.kind].name}${log.grudge.blocked ? '. Your charm blocked it!' : '.'}</span>`); }
  sfx('coin');
  openCard(`<div class="sub" style="text-align:center">DAWN · DAY ${log.day + 1}</div><div class="ntitle">${crew.length ? 'YOUR NIGHT CREW CAME HOME' : 'WHILE YOU SLEPT'}</div>
    ${crew.map(row).join('')}
    ${extra.length ? `<div class="sub" style="text-align:center;margin:.6em 0;line-height:1.7">${extra.join('<br>')}</div>` : ''}
    <div class="sub" style="text-align:center;margin:.4em 0">Rolled on NEAR from yesterday's sealed day · barn ${S.barn.reduce((a, b) => a + b, 0)} / 40</div>
    <div style="text-align:center"><button class="btn big gold" id="cardBtn">TO THE MORNING PAPER</button></div>`, then);
}
// the season-end card lists what happened to the stalls
function stallResultsHTML() {
  const last = S.player.stall_last || [], parts = [];
  last.forEach((v, k) => { const g = stallGood(k).name.toUpperCase(), a = Rules.AGENTS[k].name;
    if (v === 1) parts.push(`<b class="up">You took the ${g} stall from ${a}!</b>`);
    if (v === 2) parts.push(`<b class="up">You defended the ${g} stall.</b>`);
    if (v === -1) parts.push(`<b class="dn">${a} took the ${g} stall back.</b>`); });
  return parts.length ? `<div style="margin:.5em 0;line-height:1.7">${parts.join('<br>')}</div>` : '';
}
