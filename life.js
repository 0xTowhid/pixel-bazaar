// Pixel Bazaar life sim: farm plots, mining, fishing, Mochi the cat, the seed hotbar,
// and the action queue that sends many small moves to NEAR as one `act` transaction.
'use strict';

const CROPS = Rules.CROPS, EN = Rules.ENERGY;
const popups = []; // floating "+1 JADE" texts in world coordinates
function popup(x, y, text, color = '#ffd86b') { popups.push({ x, y, text, color, t: 0 }); }

// ---------- action queue ----------
// Moves are applied to the screen right away, then sent together a moment later (or right away for mining/fishing).
const Q = { list: [], timer: null, sending: false, labels: [] };
function queue(action, label, now) {
  Q.list.push(action); Q.labels.push(label);
  clearTimeout(Q.timer);
  Q.timer = setTimeout(flush, now ? 0 : 1500);
}
async function flush() {
  clearTimeout(Q.timer);
  if (Q.sending || !Q.list.length) return;
  const batch = Q.list.splice(0, 60), labels = Q.labels.splice(0, batch.length);
  const counts = {}; labels.forEach(l => counts[l] = (counts[l] || 0) + 1);
  const what = 'act · ' + Object.entries(counts).map(([l, n]) => n > 1 ? `${l} x${n}` : l).join(', ');
  Q.sending = true;
  const before = { barn: S.barn ? S.barn.slice() : [], seeds: S.player ? S.player.seeds.slice() : [], coins: S.coins };
  try {
    const tx = await Backend.call('act', { actions: batch });
    chainLog(what, true, tx);
  } catch (e) {
    chainLog(what, false); sfx('alert');
    const m = String(e.message || e).replace(/^.*panicked:\s*/is, '');
    if (/has not started/.test(m)) { toast('Today was not on NEAR yet. Fixing that, try again in a moment.', 3.5); recoverDay(); }
    else toast(m, 3.5);
  }
  Q.sending = false;
  await sync();
  flush.after && flush.after(before);
  flush.after = null;
  if (Q.list.length) flush();
}
const flushNow = () => flush();

// ---------- farm ----------
function plotAt(i) { return S.player && S.player.plots[i]; }
function stageOf(pl) {
  const c = CROPS[pl.crop], days = c.days;
  if (pl.grown >= days) return 3;
  if (pl.grown === 0) return 0;
  return pl.grown / days < .5 ? 1 : 2;
}
const ripeP = pl => pl && pl.crop !== null && pl.grown >= CROPS[pl.crop].days;
const wateredToday = pl => pl.watered_day === S.day;
function farmTarget() {
  if (!S.player) return null;
  const P = World.P;
  let best = null, bd = 30;
  P.plots.forEach((p, i) => {
    const d = Math.hypot(player.x - (p.x + .5) * TW, player.y - (p.y + .6) * TW);
    if (d < bd) { bd = d; best = i; }
  });
  if (best === null) return null;
  const owned = S.player.plots.length, pl = plotAt(best);
  if (best >= owned) return best === owned ? { kind: 'plot', i: best, label: 'BUY THIS PLOT (' + Rules.ITEMS.plot + ')' } : { kind: 'plot', i: best, label: 'NOT YOUR LAND YET', none: true };
  if (pl.crop === null) {
    const c = CROPS[S.seedSel], n = S.player.seeds[S.seedSel] || 0;
    return n > 0 ? { kind: 'plant', i: best, label: `PLANT ${c.name.toUpperCase()} (${n} left)` } : { kind: 'plant', i: best, label: 'NO ' + c.name.toUpperCase() + ' SEEDS. BUY AT TOMO\'S', none: true };
  }
  const c = CROPS[pl.crop];
  if (ripeP(pl)) return { kind: 'harvest', i: best, label: 'HARVEST ' + c.name.toUpperCase() };
  if (!c.noWater && !wateredToday(pl)) return { kind: 'water', i: best, label: `WATER ${c.name.toUpperCase()} · day ${pl.grown}/${c.days}` };
  return { kind: 'info', i: best, label: `${c.name.toUpperCase()} · ${pl.grown}/${c.days} DAYS${c.noWater ? '' : ' · WATERED'}`, none: true };
}
function energyOk(n) { if (S.player.energy >= n) return true; toast("You're too tired. Sleep restores your energy.", 2.5); sfx('alert'); return false; }
function farmAct(t) {
  const P = World.P, pl = plotAt(t.i), at = P.plots[t.i], wx = (at.x + .5) * TW, wy = at.y * TW;
  if (t.kind === 'plot') {
    if (S.coins < Rules.ITEMS.plot) { toast('A plot costs ' + Rules.ITEMS.plot + ' coins.', 2); sfx('alert'); return; }
    const now = performance.now(), c = farmAct.confirm;
    if (!c || c.i !== t.i || now - c.at > 3000) { farmAct.confirm = { i: t.i, at: now }; toast('Press again to buy this plot for ' + Rules.ITEMS.plot + ' coins.', 2.5); sfx('menu'); return; }
    farmAct.confirm = null;
    S.coins -= Rules.ITEMS.plot; S.player.plots.push({ crop: null, grown: 0, watered_day: 0 });
    queue({ t: 'BuyPlot' }, 'buy plot'); sfx('coin'); popup(wx, wy, 'NEW PLOT'); return;
  }
  if (t.kind === 'plant') {
    if (!energyOk(EN.plant)) return;
    S.player.energy -= EN.plant; S.player.seeds[S.seedSel]--;
    S.player.plots[t.i] = { crop: S.seedSel, grown: 0, watered_day: 0 };
    queue({ t: 'Plant', plot: t.i, crop: S.seedSel }, 'plant'); sfx('ok'); renderHotbar(); return;
  }
  if (t.kind === 'water') {
    if (!energyOk(EN.water)) return;
    S.player.energy -= EN.water; pl.watered_day = S.day;
    queue({ t: 'Water', plot: t.i }, 'water'); sfx('menu'); popup(wx, wy, '💧', '#8fe0ff'); return;
  }
  if (t.kind === 'harvest') {
    if (!energyOk(EN.harvest)) return;
    const c = CROPS[pl.crop], total = (S.barn || []).reduce((a, b) => a + b, 0);
    if (total + c.yield > 40) { toast('Your barn is full (40). Sell something at Tomo\'s first.', 3); sfx('alert'); return; }
    S.player.energy -= EN.harvest;
    S.barn[c.good] += c.yield;
    S.player.plots[t.i] = c.regrow ? { crop: pl.crop, grown: c.days - c.regrow, watered_day: pl.watered_day } : { crop: null, grown: 0, watered_day: 0 };
    queue({ t: 'Harvest', plot: t.i }, 'harvest'); sfx('coin');
    popup(wx, wy, `+${c.yield} ${Rules.GOODS[c.good].name.toUpperCase()}`, '#8ee68a');
  }
}

// ---------- mining ----------
const rockMined = i => S.player && S.player.mined_day === S.day && (S.player.mined & (1 << i));
function rockTarget() {
  let best = null, bd = 50;
  World.P.rocks.forEach((r, i) => { const d = Math.hypot(player.x - (r.x + 1) * TW, player.y - (r.y + 2.1) * TW); if (d < bd) { bd = d; best = i; } });
  if (best === null) return null;
  return rockMined(best) ? { kind: 'rock', i: best, label: 'ALREADY MINED TODAY', none: true } : { kind: 'rock', i: best, label: 'MINE ROCK (' + EN.mine + ' energy)' };
}
function mine(i) {
  if (!energyOk(EN.mine)) return;
  S.player.energy -= EN.mine; if (S.player.mined_day !== S.day) { S.player.mined_day = S.day; S.player.mined = 0; } S.player.mined |= 1 << i;
  const r = World.P.rocks[i], wx = (r.x + 1) * TW, wy = r.y * TW;
  sfx('ok'); popup(wx, wy, '*clink*', '#ffffff');
  flush.after = before => reportFinds(before, wx, wy);
  queue({ t: 'Mine', rock: i }, 'mine', true);
}
function reportFinds(before, wx, wy) {
  const out = [];
  Rules.GOODS.forEach((g, i) => { const d = (S.barn[i] || 0) - (before.barn[i] || 0); if (d > 0 && (i === 11 || i === 12 || i === 1)) out.push(`+${d} ${g.name.toUpperCase()}`); });
  CROPS.forEach((c, i) => { const d = (S.player.seeds[i] || 0) - (before.seeds[i] || 0); if (d > 0) out.push(`+${d} ${c.name.toUpperCase()} SEED`); });
  const dc = Math.round(S.coins - before.coins); if (dc > 0) out.push(`+${dc} COINS`);
  out.forEach((t, k) => popup(wx, wy - k * 18, t, t.includes('JADE') ? '#7df0c0' : '#ffd86b'));
  if (out.some(t => t.includes('JADE'))) sfx('success');
  renderHotbar();
}

// ---------- fishing mini-game ----------
function fishTarget() {
  let best = null, bd = 44;
  World.P.fishSpots.forEach((f, i) => { const d = Math.hypot(player.x - f.x * TW, player.y - f.y * TW); if (d < bd) { bd = d; best = i; } });
  if (best === null) return null;
  const left = 6 - (S.player ? S.player.catches_today || 0 : 0);
  return left > 0 ? { kind: 'fish', i: best, label: `FISH (${EN.fish} energy · ${left} casts left)` } : { kind: 'fish', i: best, label: 'THE FISH STOPPED BITING TODAY', none: true };
}
function startFishing() {
  if (!energyOk(EN.fish)) return;
  const w = .14 + Math.random() * .08;
  S.fishing = { t: 0, zone: .15 + Math.random() * (.7 - w), w, speed: 1.1 + Math.random() * .7, pos: 0, done: false };
  sfx('menu');
}
function stopFishing() {
  const f = S.fishing; if (!f || f.done) return;
  f.done = true;
  const ok = f.pos >= f.zone && f.pos <= f.zone + f.w;
  S.player.energy -= EN.fish; S.player.catches_today = (S.player.catches_today || 0) + 1;
  const wx = player.x, wy = player.y - 70;
  // the catch itself is decided on chain (7 in 10 once you win the mini-game); the popup comes when NEAR answers
  if (ok) {
    sfx('ok'); popup(wx, wy, 'Reeling in...', '#8fe0ff');
    flush.after = before => { reportFinds(before, wx, wy); if ((S.barn[1] || 0) <= (before.barn[1] || 0)) popup(wx, wy, 'It slipped off the hook!', '#ff9a8a'); else sfx('success'); };
  }
  else { sfx('alert'); popup(wx, wy, 'It got away...', '#ff9a8a'); }
  queue({ t: 'Fish', ok }, ok ? 'fish caught' : 'fish missed', true);
  setTimeout(() => { S.fishing = null; }, 500);
}
function drawFishing() {
  const f = S.fishing; if (!f) return;
  if (!f.done) { f.t += 1 / 60; f.pos = (Math.sin(f.t * f.speed * 3) + 1) / 2; }
  const w = 360, h = 26, x = VW / 2 - w / 2, y = VH / 2 + 60;
  ctx.fillStyle = '#1c1630ee'; ctx.fillRect(x - 14, y - 46, w + 28, h + 74);
  ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 3; ctx.strokeRect(x - 14, y - 46, w + 28, h + 74);
  ctx.font = '12px Joy, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd86b';
  ctx.fillText('PRESS E WHEN THE HOOK IS IN THE GREEN', VW / 2, y - 22);
  ctx.fillStyle = '#2b5f86'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#5fd36a'; ctx.fillRect(x + f.zone * w, y, f.w * w, h);
  ctx.fillStyle = '#fff3d6'; ctx.fillRect(x + f.pos * w - 3, y - 6, 6, h + 12);
}

// ---------- Mochi the cat ----------
let cat = null;
function makeCat() { const p = World.P.cat; cat = { x: p.x * TW, y: p.y * TW, frame: 0, t: 0, dir: 1 }; }
function catHasGift() { return S.player && S.player.cat_day !== S.day && S.t > 15; }
function catTarget() {
  if (!cat) return null;
  const d = Math.hypot(player.x - cat.x, player.y - cat.y);
  if (d > 40) return null;
  return catHasGift() ? { kind: 'cat', label: 'PET MOCHI (she found something!)' } : { kind: 'cat', label: 'PET MOCHI', none: false, pet: true };
}
function petCat(t) {
  sfx('voice');
  if (t.pet || !catHasGift()) { popup(cat.x, cat.y - 30, '♥', '#ff9fd0'); return; }
  S.player.cat_day = S.day;
  flush.after = before => reportFinds(before, cat.x, cat.y - 30);
  queue({ t: 'Cat' }, 'cat gift', true);
}
function updateCat(dt) {
  if (!cat || S.inside) return;
  const tx = player.x - 28 * (player.dir === 'right' ? 1 : -1), ty = player.y + 6, d = Math.hypot(tx - cat.x, ty - cat.y);
  if (d > 600) { cat.x = tx; cat.y = ty; }
  const moving = d > 22;
  if (moving) { const s = Math.min(d, (d > 120 ? 200 : 140) * dt); cat.x += (tx - cat.x) / d * s; cat.y += (ty - cat.y) / d * s; cat.dir = tx > cat.x ? 1 : -1; }
  cat.t += dt; cat.frame = moving ? Math.floor(cat.t * 8) % 2 : 0;
}
function drawCat(camX, camY) {
  if (!cat || S.inside) return;
  const x = Math.round(cat.x - camX), y = Math.round(cat.y - camY);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y - 26); if (cat.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(IMG.cat, cat.frame * 16, 0, 16, 16, -14, 0, 28, 28); ctx.restore();
  if (catHasGift()) { ctx.font = '14px Joy, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd86b'; ctx.fillText('!', x, y - 32 + Math.sin(performance.now() / 200) * 2); }
}

// ---------- drawing the farm ----------
function drawFarm(camX, camY) {
  if (!S.player) return;
  const owned = S.player.plots.length;
  World.P.plots.forEach((p, i) => {
    const x = p.x * TW - camX, y = p.y * TW - camY;
    if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) return;
    if (i >= owned) {
      if (i === owned) { ctx.strokeStyle = 'rgba(255,243,214,.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, TW - 6, TW - 6); ctx.setLineDash([]); }
      return;
    }
    const pl = S.player.plots[i];
    ctx.drawImage(IMG.floor, 1 * TS, 8 * TS, TS, TS, x, y, TW, TW);
    if (pl.crop !== null && wateredToday(pl)) { ctx.fillStyle = 'rgba(40,20,10,.35)'; ctx.fillRect(x, y, TW, TW); }
    if (pl.crop === null) return;
    const c = CROPS[pl.crop], st = stageOf(pl);
    if (c.row !== undefined) ctx.drawImage(IMG.crops, st * 16, c.row * 16, 16, 16, x, y, TW, TW);
    else if (c.id === 'apple') { if (st < 2) ctx.drawImage(IMG.crops, (st === 0 ? 0 : 1) * 16, 0, 16, 16, x, y, TW, TW); else ctx.drawImage(IMG.appletree, st === 3 ? 32 : 0, 0, 32, 32, x - 8, y - 18, 48, 48); }
    else if (c.id === 'hive') ctx.drawImage(IMG.element, 1 * TS, 1 * TS, TS, TS, x, y, TW, TW);
    if (st === 3) { const tw = (Math.sin(performance.now() / 250 + i) + 1) / 2; ctx.fillStyle = `rgba(255,240,160,${.4 + .6 * tw})`; ctx.fillRect(x + 24, y + 2, 3, 3); ctx.fillRect(x + 25, y, 1, 7); ctx.fillRect(x + 22, y + 3, 7, 1); }
  });
}
function drawPopups(camX, camY, dt) {
  ctx.font = '12px Joy, monospace'; ctx.textAlign = 'center';
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt; if (p.t > 1.6) { popups.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, 1.6 - p.t);
    ctx.fillStyle = '#000a'; ctx.fillText(p.text, p.x - camX + 1, p.y - camY - p.t * 28 + 1);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x - camX, p.y - camY - p.t * 28);
  }
  ctx.globalAlpha = 1;
}

// ---------- seed hotbar ----------
function renderHotbar() {
  const el = $('hotbar'); if (!el || !S || !S.player) return;
  el.innerHTML = CROPS.map((c, i) => {
    const n = S.player.seeds[i] || 0;
    return `<button class="slot ${i === S.seedSel ? 'sel' : ''} ${n ? '' : 'empty'}" data-i="${i}" title="${c.name}"><img src="${seedIcon(i)}" alt=""><b>${n}</b><i>${i + 1}</i></button>`;
  }).join('');
  el.querySelectorAll('.slot').forEach(b => b.onclick = () => { S.seedSel = +b.dataset.i; sfx('menu'); renderHotbar(); });
}
