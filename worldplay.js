// Moving between the town and the other worlds, their gates, puzzles and moods.

const isNight = () => S && S.t / DAY_SECONDS >= 12 / 18; // 18:00
const ownsElement = el => (S.spirits || []).some(s => Rules.SPECIES[s.species].el === el);

// ---------- gates in town ----------
const GATE_NAME = { woods: 'WHISPERING WOODS', moon: 'MOON MARKET', shrine: 'SUNKEN SHRINE', sky: 'CLOCKWORK SKY' };
function gateStatus(g) {
  if (g.night && !isNight()) return { open: false, why: 'opens at 18:00' };
  const spec = Worlds.SPECS[g.to];
  if (spec.needs !== undefined && !ownsElement(spec.needs)) return { open: false, why: `needs a ${Rules.ELEMENTS[spec.needs].name.toLowerCase()} spirit` };
  return { open: true, why: 'open' };
}
// floating signs over the town gates, and dots on the minimap, so you always know where the worlds are
function drawGateSigns(camX, camY) {
  if (WD.id !== 'town') return;
  ctx.save(); ctx.font = '11px Joy, monospace'; ctx.textAlign = 'center';
  for (const g of World.P.gates) {
    const x = g.x * TW - camX; let y = g.y * TW - camY - 34; if (y < 34) y = g.y * TW - camY + 70; // too close to the top: sign below
    if (x < -120 || x > VW + 120 || y < -40 || y > VH + 40) continue;
    const st = gateStatus(g), t1 = GATE_NAME[g.to], t2 = st.open ? '▸ OPEN' : '🔒 ' + st.why.toUpperCase();
    const w = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + 14;
    ctx.fillStyle = 'rgba(28,22,48,.85)'; ctx.fillRect(x - w / 2, y - 26, w, 30); ctx.strokeStyle = st.open ? '#8ee68a' : '#ff9a8a'; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - 26, w, 30);
    ctx.fillStyle = '#ffd86b'; ctx.fillText(t1, x, y - 13); ctx.fillStyle = st.open ? '#8ee68a' : '#ff9a8a'; ctx.fillText(t2, x, y);
  }
  ctx.restore();
}
function drawMiniMarks(mx, my, sx, sy) {
  ctx.save(); ctx.font = '9px Joy, monospace'; ctx.textAlign = 'center';
  const marks = WD.id === 'town' ? World.P.gates.map(g => ({ x: g.x, y: g.y, c: gateStatus(g).open ? '#8ee68a' : '#ff9a8a', l: GATE_NAME[g.to][0] }))
    : WD.w.objects.filter(o => ['tablet', 'gate', 'merchant'].includes(o.kind)).map(o => ({ x: o.x, y: o.y, c: o.kind === 'tablet' ? '#fff3d6' : '#b9a8e8', l: o.kind === 'tablet' ? 'T' : o.kind === 'gate' ? 'G' : 'R' }))
      .concat([{ x: WD.w.P.exit.x, y: WD.w.P.exit.y, c: '#6bc8ff', l: '⌂' }]);
  for (const m of marks) {
    const x = mx + m.x * TW * sx, y = my + m.y * TW * sy;
    ctx.fillStyle = '#1c1630'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = m.c; ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = '#1c1630'; ctx.fillText(m.l, x, y + 3);
  }
  ctx.restore();
}
function gateTarget() {
  for (const g of World.P.gates) {
    if (Math.hypot(player.x - g.x * TW, player.y - g.y * TW) > 52) continue;
    if (g.night && !isNight()) return { kind: 'gate', none: true, label: 'THE MOON GATE OPENS AT 18:00' };
    const spec = Worlds.SPECS[g.to];
    if (spec.needs !== undefined && !ownsElement(spec.needs)) return { kind: 'gate', none: true, label: `YOU NEED A ${Rules.ELEMENTS[spec.needs].name} SPIRIT TO GO HERE` };
    return { kind: 'enter', to: g.to, label: g.label };
  }
  return null;
}
function enterWorld(id) {
  sfx('success'); fadeTo(() => {
    switchWorld(id);
    const w = Worlds.get(id, IMG);
    toast(w.name.toUpperCase() + (id === 'woods' && !hasFireLead() ? ' · it is dark: a fire spirit as your companion lights the way' : ''), 4);
    worldCard(id, false);
  });
}
// ---------- "what is here" card, shown on your first visit to a world each day ----------
const WORLD_INFO = {
  woods: { story: 'Dark woods north of town. Something carried the Lantern this way.', todo: [
    ['person', 'Talk to <b>Hiro the Woodcutter</b> near the entrance and <b>Pip</b> in the clearing'],
    ['puzzle', 'Solve the <b>4 braziers</b> in the clearing up the path (read the stone tablet first): +1 lantern shard and a story clue'],
    ['chest', 'Open the <b>daily chest</b> by the west pond'],
    ['spirits', 'Catch an <b>owl or moth</b>: a WIND spirit opens the Clockwork Sky'],
    ['tip', 'Too dark? Make a <b>FIRE</b> spirit your companion and the woods light up'] ] },
  moon: { story: 'A night market, open from 18:00.', todo: [
    ['person', 'Duel <b>Rita</b> at the duel table: 3 of your spirits against hers, the winner takes coins'],
    ['person', 'Buy <b>charms</b> from Noor: each blocks one curse another player throws at you'],
    ['chest', 'Open the <b>daily chest</b> east of the pond'],
    ['spirits', 'Catch night spirits you will not find in town'] ] },
  shrine: { story: 'A drowned temple. Only water spirits can bring you here.', todo: [
    ['person', 'Talk to <b>Sora the Diver</b> and the <b>Kappa Sage</b>'],
    ['puzzle', 'Ring the <b>3 bells</b> in the order the stone tablet gives: +1 lantern shard and a story clue'],
    ['chest', 'Open the <b>daily chest</b> on the east side'],
    ['spirits', 'Catch rare water spirits'] ] },
  sky: { story: 'Floating islands joined by bridges. Wind spirits carried you up.', todo: [
    ['person', 'Talk to <b>Ivo the Clockmaker</b> and <b>Lin</b>'],
    ['puzzle', 'Wind the <b>4 gears</b> in the order the stone tablet gives: +1 lantern shard and a story clue'],
    ['chest', 'Open the <b>daily chest</b> on the west island'],
    ['spirits', 'Catch sky spirits found nowhere else'] ] },
};
function worldCard(id, force) {
  const info = WORLD_INFO[id]; if (!info) return;
  const key = 'pb_wcard|' + id + '|' + S.day;
  if (!force) { try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {} }
  const w = WD.w, k = Worlds.PUZZLE_OF[id], solved = k !== undefined && S.player.solved_day && S.player.solved_day[k] === S.day;
  const chest = w.objects.find(o => o.kind === 'wchest'), chestDone = chest && (S.player.forage_day || [])[chest.world] === S.day;
  const els = [...new Set((Rules.SPAWN[w.spec.zone] || []).map(([sp]) => Rules.SPECIES[sp].el))].map(e => `<span style="color:${Rules.ELEMENTS[e].color}">${Rules.ELEMENTS[e].name}</span>`).join(' · ');
  const icon = { person: '💬', puzzle: '✦', chest: '🎁', spirits: '👻', tip: '🔥' };
  const done = t => (t === 'puzzle' && solved) || (t === 'chest' && chestDone);
  openCard(`<div class="sub" style="text-align:center">YOU ARRIVED IN</div><div class="ntitle">${w.spec.name.toUpperCase()}</div>
    <div class="sub" style="text-align:center;margin-bottom:.8em">${info.story}</div>
    <div class="wTodo">${info.todo.map(([t, h]) => `<div class="${done(t) ? 'wDone' : ''}"><span>${done(t) ? '✓' : icon[t]}</span><div>${h}${done(t) ? ' <b class="up">done today</b>' : ''}</div></div>`).join('')}</div>
    <div class="sub" style="margin-top:.7em">Spirits here: ${els}</div>
    <div style="text-align:center;margin-top:1em"><button class="btn big gold" id="cardBtn">LET'S GO</button></div>`, null, true);
}
function leaveWorld() {
  const from = WD.id, g = World.P.gates.find(x => x.to === from);
  sfx('ok'); fadeTo(() => switchWorld('town', g ? { x: g.x, y: g.y + 1.4 } : null));
}
function switchWorld(id, at) {
  if (id === 'town') {
    MAP = MAP_TOWN; MINI = MINI_TOWN; WD = { id: 'town', W: World.W, H: World.H };
    const p = at || World.P.start; player.x = p.x * TW; player.y = p.y * TW; playMusic('village');
  } else {
    const w = Worlds.get(id, IMG);
    MAP = w.map; MINI = w.mini; WD = { id, W: w.W, H: w.H, w };
    player.x = w.P.spawn.x * TW; player.y = w.P.spawn.y * TW; playMusic(w.spec.music);
    preparePuzzle(id);
  }
  S.world = id; wilds = []; comp.x = 0; if (cat) { cat.x = player.x; cat.y = player.y; }
}
function fadeTo(fn) {
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 120); }, 380);
}
const hasFireLead = () => { const L = leadSpirit(); return !!L && Rules.SPECIES[L.species].el === 0; };

// ---------- inside a world ----------
function worldNearest() {
  const w = WD.w, d = (x, y) => Math.hypot(player.x - x * TW, player.y - y * TW);
  if (d(w.P.exit.x, w.P.exit.y) < 50) return { kind: 'exit', label: w.P.exit.label };
  let best = null, bd = 56;
  for (const o of w.objects) {
    if (o.kind === 'lantern' || (o.kind === 'lamp' && !o.text)) continue; // just lights
    const dd = d(o.x, o.y); if (dd >= bd) continue; bd = dd;
    if (['brazier', 'bell', 'gear'].includes(o.kind)) {
      const k = Worlds.PUZZLE_OF[WD.id], done = S.player.solved_day && S.player.solved_day[k] === S.day;
      best = done ? { kind: 'piece', none: true, label: 'SOLVED TODAY · COME BACK TOMORROW' } : { kind: 'piece', o, label: { brazier: 'LIGHT THE BRAZIER', bell: 'RING THE BELL', gear: 'WIND THE GEAR' }[o.kind] };
    } else if (o.kind === 'person' || o.kind === 'spiritnpc') best = { kind: 'person', o, label: 'TALK TO ' + o.name.toUpperCase() };
    else if (o.kind === 'wchest') best = (S.player.forage_day || [])[o.world] === S.day ? { kind: 'wchest', none: true, label: 'EMPTY TODAY · IT REFILLS TOMORROW' } : { kind: 'wchest', o, label: 'OPEN THE CHEST' };
    else if (o.text || ['merchant', 'gate'].includes(o.kind)) best = { kind: 'read', o, label: o.kind === 'merchant' ? 'DUEL TABLE · TALK TO RITA' : o.kind === 'gate' && WD.id === 'woods' && S.player.chapter >= 5 ? 'THE SPIRIT GATE' : 'READ' };
  }
  if (best) return best;
  return wildTarget();
}

// ---------- puzzles: the order is fixed by today's commitment, so the contract can check it ----------
const PZ = { order: null, step: 0, lit: [], world: null };
async function preparePuzzle(id) {
  const k = Worlds.PUZZLE_OF[id]; PZ.world = id; PZ.order = null; PZ.step = 0; PZ.lit = [];
  if (k === undefined || !S.player.commitment) return;
  PZ.order = await puzzleOrder(S.player.commitment, Backend.accountId, k);
}
async function puzzleOrder(commit, who, k) {
  const n = [4, 3, 4][k], v = [...Array(n).keys()];
  const eng = Backend.mode === 'local' && Backend.localEngine();
  for (let i = n - 1; i >= 1; i--) {
    const s = `${commit}|${who}|puzzle${k}|${i}`;
    const r = eng ? eng._roll(commit, who, 'puzzle' + k, i) : new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))[0];
    const j = r % (i + 1); [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}
// the tablet tells you where to start; a right piece stays lit, a wrong one resets them all
function puzzleHint() {
  const k = Worlds.PUZZLE_OF[WD.id]; if (k === undefined) return '';
  if (S.player.solved_day && S.player.solved_day[k] === S.day) return ' (Solved today. It changes tomorrow.)';
  if (!PZ.order) return ' (The day has not started on NEAR yet.)';
  const pieces = WD.w.objects.filter(o => ['brazier', 'bell', 'gear'].includes(o.kind));
  const cx = pieces.reduce((a, o) => a + o.x, 0) / pieces.length, cy = pieces.reduce((a, o) => a + o.y, 0) / pieces.length;
  const first = pieces.find(o => o.i === PZ.order[0]), dx = first.x - cx, dy = first.y - cy;
  const dir = (Math.abs(dy) > 1.5 ? (dy < 0 ? 'NORTH' : 'SOUTH') : '') + (Math.abs(dx) > 1.5 ? (dx < 0 ? 'WEST' : 'EAST') : '') || 'MIDDLE';
  const what = { brazier: 'flame', bell: 'bell', gear: 'gear' }[first.kind];
  return `  ·  Today it begins with the ${dir} ${what}. Then try the others: a right one stays lit, a wrong one resets them all.`;
}
function touchPiece(o) {
  const k = Worlds.PUZZLE_OF[WD.id];
  if (!PZ.order) { toast('The air is still... (the day has not started on NEAR yet)', 2.5); return; }
  if (PZ.lit.includes(o.i)) return;
  if (o.i === PZ.order[PZ.step]) {
    PZ.lit.push(o.i); PZ.step++; sfx('coin');
    popup(o.x * TW, o.y * TW - 40, ['✦', '✦✦', '✦✦✦', '✦✦✦✦'][PZ.step - 1], '#ffd86b');
    if (PZ.step === PZ.order.length) {
      sfx('success');
      queue({ t: 'Solve', puzzle: k, answer: PZ.order }, 'world puzzle', true);
      flush.after = () => {
        if (S.player.solved_day[k] === S.day) {
          const clues = ['the woods', 'the shrine', 'the sky'][k];
          openCard(`<div class="ntitle">THE PUZZLE IS SOLVED!</div>
            <div style="text-align:center;line-height:1.8">+1 LANTERN SHARD (you have ${S.player.shards})<br>A clue about the stolen flame, found in ${clues}.<br><span class="sub">Shards let your spirits reach their last form. The order changes tomorrow.</span></div>
            <div style="text-align:center;margin-top:1em"><button class="btn big gold" id="cardBtn">WONDERFUL</button></div>`, null, true);
        }
      };
    }
  } else {
    PZ.lit = []; PZ.step = 0; sfx('alert');
    toast({ woods: 'A cold wind. All the flames go out.', shrine: 'The bells fall silent.', sky: 'The gears jam and spin back.' }[WD.id], 2.5);
  }
}

// ---------- drawing ----------
function worldDrawables(camX, camY) {
  const out = [], t = performance.now() / 1000;
  if (WD.id === 'town') {
    for (const g of World.P.gates) {
      const open = !g.night || isNight();
      out.push({ base: g.y * TW - 20, draw: () => {
        const x = g.x * TW - camX, y = g.y * TW - camY - 18, col = { woods: '120,255,160', moon: '200,160,255', shrine: '110,210,255', sky: '230,245,255' }[g.to];
        const r = 18 + Math.sin(t * 3) * 3, gr = ctx.createRadialGradient(x, y, 2, x, y, r * 2);
        gr.addColorStop(0, `rgba(${col},${open ? .8 : .25})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(${col},${open ? .9 : .35})`; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y, 8 + k * 6, t * (2 + k) + k, t * (2 + k) + k + 3.6); ctx.stroke(); }
      } });
    }
    return out;
  }
  for (const o of WD.w.objects) out.push({ base: o.y * TW, draw: () => drawObject(o, o.x * TW - camX, o.y * TW - camY, t) });
  const ex = WD.w.P.exit; out.push({ base: ex.y * TW, draw: () => { const x = ex.x * TW - camX, y = ex.y * TW - camY; ctx.fillStyle = `rgba(255,216,107,${.35 + Math.sin(t * 4) * .15})`; ctx.beginPath(); ctx.ellipse(x, y, 26, 9, 0, 0, 7); ctx.fill(); } });
  return out;
}
function drawObject(o, x, y, t) {
  const lit = PZ.lit.includes(o.i) || (o.i !== undefined && S.player.solved_day && S.player.solved_day[Worlds.PUZZLE_OF[WD.id]] === S.day);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 14, 5, 0, 0, 7); ctx.fill();
  if (o.kind === 'brazier') {
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 12, y - 18, 24, 18); ctx.fillStyle = '#6b5440'; ctx.fillRect(x - 15, y - 22, 30, 6);
    if (lit) drawSpiritAt(0, x, y - 20, 'down', t, 1.6, '#ffb86b');
    else { ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 10, y - 24, 20, 3); }
  } else if (o.kind === 'bell') {
    ctx.fillStyle = '#5e6b5e'; ctx.fillRect(x - 3, y - 44, 6, 44); ctx.fillRect(x - 16, y - 46, 32, 5);
    ctx.fillStyle = lit ? '#ffd86b' : '#8a7a4a'; const sw = lit ? Math.sin(t * 8) * 4 : 0;
    ctx.beginPath(); ctx.moveTo(x - 10 + sw, y - 14); ctx.quadraticCurveTo(x + sw, y - 44, x + 10 + sw, y - 14); ctx.fill();
    if (lit) { ctx.strokeStyle = 'rgba(255,216,107,.5)'; for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y - 24, 14 + k * 8 + (t * 20 % 8), 0, 7); ctx.stroke(); } }
  } else if (o.kind === 'gear') {
    const a = lit ? t * 2 : 0; ctx.save(); ctx.translate(x, y - 22); ctx.rotate(a);
    ctx.fillStyle = lit ? '#ffd86b' : '#9aa4ad';
    for (let k = 0; k < 8; k++) { ctx.save(); ctx.rotate(k * Math.PI / 4); ctx.fillRect(-4, -20, 8, 8); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#5e6870'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.restore();
  } else if (o.kind === 'tablet') {
    ctx.fillStyle = '#7d7a8a'; ctx.fillRect(x - 12, y - 30, 24, 30); ctx.fillStyle = '#5e5b6a'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 8, y - 25 + k * 6, 16, 2);
  } else if (o.kind === 'gate') {
    const gr = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 40); gr.addColorStop(0, 'rgba(185,168,232,.6)'); gr.addColorStop(1, 'rgba(185,168,232,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 30, 40, 0, 7); ctx.fill();
    if (WD.id === 'woods' && S.player.chapter >= 5) drawSpiritAt(11, x, y - 4, 'down', t, 3.2, S.player.boss_wins & 1 ? '#ffe9a0' : '#b9a8e8'); // the Great Spirit wakes
  } else if (o.kind === 'merchant') {
    ctx.drawImage(IMG.rita, 0, DIR.down * 64, 64, 64, Math.round(x - 32), Math.round(y - 60), 64, 64); // Rita runs the night duel table
    ctx.fillStyle = '#4a2f5e'; ctx.fillRect(x - 26, y - 4, 52, 14); drawSpiritAt(16, x + 34, y, 'left', t, 1.6, '#b6ff9e');
  } else if (o.kind === 'person') {
    ctx.drawImage(IMG[o.sheet], 0, DIR.down * 64, 64, 64, Math.round(x - 32), Math.round(y - 60), 64, 64);
    nameTag(o.name, x, y - 64);
  } else if (o.kind === 'spiritnpc') {
    drawSpiritAt(o.species, x, y, 'down', t, 2.6, '#9fe3ff'); nameTag(o.name, x, y - 64);
  } else if (o.kind === 'wchest') {
    const done = (S.player.forage_day || [])[o.world] === S.day;
    ctx.drawImage(IMG.element, (done ? 9 : 8) * 16, 16, 16, 16, x - 16, y - 28, 32, 32);
    if (!done) { ctx.fillStyle = `rgba(255,216,107,${.5 + Math.sin(t * 4) * .3})`; ctx.fillRect(x - 2, y - 40 + Math.sin(t * 3) * 3, 4, 4); }
  } else if (o.kind === 'sign') {
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(x - 2, y - 26, 4, 26); ctx.fillStyle = '#9b7148'; ctx.fillRect(x - 14, y - 34, 28, 14);
    ctx.fillStyle = '#6b4a2c'; ctx.fillRect(x - 10, y - 30, 20, 2); ctx.fillRect(x - 10, y - 25, 14, 2);
  } else if (o.kind === 'lantern') {
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 2, y - 30, 4, 30); ctx.fillStyle = `rgba(255,${200 + Math.sin(t * 6 + x) * 25},120,1)`; ctx.fillRect(x - 5, y - 40, 10, 10);
  } else if (o.kind === 'lamp') {
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(x - 2, y - 36, 4, 36); ctx.fillStyle = `rgba(255,${190 + Math.sin(t * 5) * 30},120,1)`; ctx.fillRect(x - 6, y - 46, 12, 12);
  }
}
function nameTag(name, x, y) {
  ctx.save(); ctx.font = '10px Joy, monospace'; ctx.textAlign = 'center'; const w = ctx.measureText(name.toUpperCase()).width + 8;
  ctx.fillStyle = 'rgba(28,22,48,.8)'; ctx.fillRect(x - w / 2, y - 10, w, 13); ctx.fillStyle = '#9fe3ff'; ctx.fillText(name.toUpperCase(), x, y); ctx.restore();
}
// talk to the people of the worlds; open the daily chests
function talkWorld(o) {
  o._n = ((o._n === undefined ? (S.day - 1) : o._n + 1)) % o.lines.length;
  const who = { name: o.name, sheet: o.sheet || null, color: '#9fe3ff' };
  const more = o.lines.length > 1 ? [{ t: 'TELL ME MORE', fn: () => { closeDlg(); talkWorld(o); } }] : [];
  const charm = o.charm ? [{ t: `BUY A CHARM (${Rules.ISLAND.CHARM_COST})`, fn: () => { closeDlg(); queue({ t: 'BuyCharm' }, 'charm', true); flush.after = () => toast(`You carry ${S.player.charms} charm${S.player.charms === 1 ? '' : 's'}. Each blocks one curse.`, 3.5); } }] : [];
  say(who, '"' + o.lines[o._n] + '"', [...charm, ...more, { t: 'BYE', fn: closeDlg }]);
}
function openWorldChest(o) {
  const coins = S.coins, shards = S.player.shards;
  queue({ t: 'Forage', world: o.world }, 'world chest', true); sfx('ok');
  flush.after = () => {
    const dc = S.coins - coins, ds = S.player.shards - shards;
    if (ds > 0) { sfx('success'); popup(o.x * TW, o.y * TW - 50, '+1 LANTERN SHARD!', '#ffd86b'); }
    else if (dc > 0) { sfx('coin'); popup(o.x * TW, o.y * TW - 50, `+${fmt(dc)} coins`, '#ffd86b'); }
  };
}
// names over people and things nearby, so a world never looks empty
const LABEL_OF = { wchest: 'DAILY CHEST', tablet: 'STONE TABLET (READ ME)', gate: 'SPIRIT GATE', merchant: 'DUEL TABLE', brazier: 'BRAZIER', bell: 'BELL', gear: 'GEAR', sign: 'SIGN' };
function drawWorldLabels(camX, camY) {
  const shown = new Set();
  ctx.save(); ctx.font = '10px Joy, monospace'; ctx.textAlign = 'center';
  for (const o of WD.w.objects) {
    const name = o.name ? o.name.toUpperCase() : LABEL_OF[o.kind]; if (!name) continue;
    const ox = o.x * TW, oy = o.y * TW, d = Math.hypot(player.x - ox, player.y - oy);
    if (d > 420) continue;
    if (['brazier', 'bell', 'gear'].includes(o.kind)) { if (shown.has(o.kind) && d > 90) continue; shown.add(o.kind); } // one label for a set of puzzle pieces unless you are next to one
    const x = ox - camX, y = oy - camY - 52, w = ctx.measureText(name).width + 10;
    ctx.globalAlpha = Math.min(1, (440 - d) / 120);
    ctx.fillStyle = 'rgba(28,22,48,.8)'; ctx.fillRect(x - w / 2, y - 11, w, 15);
    ctx.fillStyle = o.kind === 'person' || o.kind === 'spiritnpc' ? '#ffd86b' : o.kind === 'wchest' ? '#8ee68a' : '#fff3d6'; ctx.fillText(name, x, y);
  }
  ctx.restore();
}
// tint, fog and darkness per world
function drawWorldMood(camX, camY) {
  if (WD.id === 'town') return;
  const spec = WD.w.spec;
  if (spec.tint) { ctx.fillStyle = spec.tint; ctx.fillRect(0, 0, VW, VH); }
  if (spec.dark) {
    // a darkness layer with holes: you, your fire companion, lanterns, people, chests and wisps
    const D = drawWorldMood.dk || (drawWorldMood.dk = document.createElement('canvas'));
    if (D.width !== VW || D.height !== VH) { D.width = VW; D.height = VH; }
    const d = D.getContext('2d'); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH);
    const fire = hasFireLead();
    d.fillStyle = fire ? 'rgba(4,10,8,.82)' : 'rgba(4,10,8,.66)'; d.fillRect(0, 0, VW, VH); d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { const g = d.createRadialGradient(x, y, r * .3, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill(); };
    hole(player.x - camX, player.y - camY - 20, fire ? 330 : 230);
    for (const o of WD.w.objects) {
      const r = { lantern: 110, person: 90, wchest: 60, tablet: 70, gate: 90, brazier: PZ.lit.includes(o.i) ? 120 : 60, sign: 50 }[o.kind];
      if (r) hole(o.x * TW - camX, o.y * TW - camY - 24, r);
    }
    for (const w of wilds) hole(w.x - camX, w.y - camY - 14, 40);
    ctx.drawImage(D, 0, 0);
    // wisps still glow through the dark
    for (const w of wilds) { const x = w.x - camX, y = w.y - camY - 14; const gg = ctx.createRadialGradient(x, y, 1, x, y, 16); gg.addColorStop(0, 'rgba(220,250,255,.9)'); gg.addColorStop(1, 'rgba(160,230,255,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); }
  }
  drawWorldLabels(camX, camY);
  if (spec.islands) { // drifting clouds below the islands
    const t = performance.now() / 1000; ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 6; k++) { const x = ((k * 397 + t * 18) % (VW + 300)) - 150, y = (k * 151) % VH; ctx.beginPath(); ctx.ellipse(x, y, 90, 22, 0, 0, 7); ctx.fill(); }
  }
}
