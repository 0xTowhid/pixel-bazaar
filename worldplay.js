// Moving between the town and the other worlds, their gates, puzzles and moods.

const isNight = () => S && S.t / DAY_SECONDS >= 12 / 18; // 18:00
const ownsElement = el => (S.spirits || []).some(s => Rules.SPECIES[s.species].el === el);

// ---------- gates in town ----------
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
  });
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
    const dd = d(o.x, o.y); if (dd >= bd) continue; bd = dd;
    if (['brazier', 'bell', 'gear'].includes(o.kind)) {
      const k = Worlds.PUZZLE_OF[WD.id], done = S.player.solved_day && S.player.solved_day[k] === S.day;
      best = done ? { kind: 'piece', none: true, label: 'SOLVED TODAY · COME BACK TOMORROW' } : { kind: 'piece', o, label: { brazier: 'LIGHT THE BRAZIER', bell: 'RING THE BELL', gear: 'WIND THE GEAR' }[o.kind] };
    } else best = { kind: 'read', o, label: o.kind === 'merchant' ? 'DUEL TABLE · TALK TO RITA' : o.kind === 'gate' && WD.id === 'woods' && S.player.chapter >= 5 ? 'THE SPIRIT GATE' : 'READ' };
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
            <div style="text-align:center;margin-top:1em"><button class="btn big gold" id="cardBtn">WONDERFUL</button></div>`);
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
  } else if (o.kind === 'lamp') {
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(x - 2, y - 36, 4, 36); ctx.fillStyle = `rgba(255,${190 + Math.sin(t * 5) * 30},120,1)`; ctx.fillRect(x - 6, y - 46, 12, 12);
  }
}
// tint, fog and darkness per world
function drawWorldMood(camX, camY) {
  if (WD.id === 'town') return;
  const spec = WD.w.spec;
  if (spec.tint) { ctx.fillStyle = spec.tint; ctx.fillRect(0, 0, VW, VH); }
  if (spec.dark) {
    const px = player.x - camX, py = player.y - camY - 20, r = hasFireLead() ? 330 : 150;
    const g = ctx.createRadialGradient(px, py, r * .35, px, py, r);
    g.addColorStop(0, 'rgba(4,10,8,0)'); g.addColorStop(1, 'rgba(4,10,8,.86)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // wisps still glow through the dark
    for (const w of wilds) { const x = w.x - camX, y = w.y - camY - 14; const gg = ctx.createRadialGradient(x, y, 1, x, y, 16); gg.addColorStop(0, 'rgba(220,250,255,.9)'); gg.addColorStop(1, 'rgba(160,230,255,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); }
  }
  if (spec.islands) { // drifting clouds below the islands
    const t = performance.now() / 1000; ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 6; k++) { const x = ((k * 397 + t * 18) % (VW + 300)) - 150, y = (k * 151) % VH; ctx.beginPath(); ctx.ellipse(x, y, 90, 22, 0, 0, 7); ctx.fill(); }
  }
}
