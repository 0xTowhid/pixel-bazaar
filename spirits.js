// Spirits: wild spirits in the world, the catch mini-game, your companion, the Spirit Book, and your NEAR wallet.
// The contract decides what you meet and whether you catch it; this file only draws and asks.

const SPR = {}; // sprite sheets by name
function sprImg(n) { if (!SPR[n]) { const i = new Image(); i.src = 'assets/spirits/' + n + '.png'; SPR[n] = i; } return SPR[n]; }
const BOSS_FORMS = { GiantFlam: [5, 50], TenguBlue: [6, 68], GiantSpirit: [5, 50] }; // idle strips: frames, size
const spiritFace = sp => 'assets/spirits/f_' + Rules.SPECIES[sp].sprite + '.png';
const elOf = sp => Rules.ELEMENTS[Rules.SPECIES[sp].el];
const DIRI = { down: 0, up: 1, left: 2, right: 3 };

// Which spirit zone the player is standing in (the new worlds come in stage 3).
function spiritZone() {
  if (WD.id !== 'town') return Worlds.SPECS[WD.id].zone;
  const z = World.zone(Math.floor(player.x / TW), Math.floor(player.y / TW));
  if (z === 'woods') return 1;
  if (z === 'farm' || z === 'town' || z === 'harbor') return 0;
  return -1;
}

// ---------- wild spirits: glowing wisps; what they really are is decided on chain when you meet them ----------
let wilds = [], wildT = 0;
function updateSpirits(dt) {
  wildT += dt;
  const zone = spiritZone();
  wilds = wilds.filter(w => w.zone === zone && Math.hypot(w.x - player.x, w.y - player.y) < 900);
  if (zone >= 0 && wilds.length < 4 && Math.random() < dt * 1.5) {
    const a = Math.random() * 6.28, d = 240 + Math.random() * 380, x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d * .7;
    if (!blockedAt(x, y) && !blockedAt(x, y - 8)) wilds.push({ x, y, zone, ph: Math.random() * 6, hx: x, hy: y });
  }
  for (const w of wilds) { w.ph += dt; w.x = w.hx + Math.sin(w.ph * .7) * 18; w.y = w.hy + Math.cos(w.ph * .5) * 10; }
  updateCompanion(dt);
}
function wildTarget() {
  if (!S.player) return null;
  let best = null, bd = 52;
  for (const w of wilds) { const d = Math.hypot(w.x - player.x, w.y - player.y); if (d < bd) { bd = d; best = w; } }
  if (!best) return null;
  const left = Rules.ENCOUNTERS_A_DAY - (S.player.enc_today || 0);
  return left > 0 ? { kind: 'wild', w: best, label: `APPROACH THE SPIRIT (${Rules.ENERGY.encounter} energy · ${left} left today)` } : { kind: 'wild', w: best, label: 'THE SPIRITS ARE HIDING UNTIL TOMORROW', none: true };
}

// ---------- companion ----------
const comp = { x: 0, y: 0, dir: 'down', moving: false, t: 0, on: false };
function leadSpirit() { return S.player && S.player.lead && (S.spirits || []).find(s => s.token_id === S.player.lead); }
function updateCompanion(dt) {
  const L = leadSpirit(); comp.on = !!L && !S.inside; if (!comp.on) return;
  const side = player.dir === 'left' ? 1 : player.dir === 'right' ? -1 : 0;
  const tx = player.x + side * 34 + (side ? 0 : 30), ty = player.y + (player.dir === 'down' ? -22 : player.dir === 'up' ? 22 : 4);
  const d = Math.hypot(tx - comp.x, ty - comp.y);
  if (d > 500 || !comp.x) { comp.x = tx; comp.y = ty; }
  comp.moving = d > 10;
  if (comp.moving) { const s = Math.min(d, (d > 100 ? 220 : 150) * dt); comp.x += (tx - comp.x) / d * s; comp.y += (ty - comp.y) / d * s; comp.dir = Math.abs(tx - comp.x) > Math.abs(ty - comp.y) ? (tx > comp.x ? 'right' : 'left') : (ty > comp.y ? 'down' : 'up'); }
  comp.t += dt;
}
function drawSpiritAt(sp, x, y, dir, t, scale = 2, glow) {
  const name = Rules.SPECIES[sp].sprite, img = sprImg(name); if (!img.complete || !img.naturalWidth) return;
  if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 14; }
  const boss = BOSS_FORMS[name];
  if (boss) { const [n, sz] = boss, f = Math.floor(t * 6) % n, w = sz * scale * .55; ctx.drawImage(img, f * sz, 0, sz, sz, x - w / 2, y - w + 4, w, w); }
  else { const f = Math.floor(t * 6) % 4, w = 16 * scale; ctx.drawImage(img, DIRI[dir] * 16, f * 16, 16, 16, x - w / 2, y - w + 2, w, w); }
  if (glow) ctx.restore();
}
// things to y-sort with the rest of the world
function spiritDrawables(camX, camY) {
  const out = [];
  for (const w of wilds) out.push({ base: w.y, draw: () => {
    const x = w.x - camX, y = w.y - camY, r = 7 + Math.sin(w.ph * 4) * 2;
    const g = ctx.createRadialGradient(x, y - 14, 1, x, y - 14, 26); g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(.35, 'rgba(160,240,255,.6)'); g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 14, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 14, r * .5, 0, 7); ctx.fill();
    for (let k = 0; k < 3; k++) { const a = w.ph * 2 + k * 2.1; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x + Math.cos(a) * 16, y - 14 + Math.sin(a) * 9, 2, 2); }
  } });
  const L = leadSpirit();
  if (comp.on && L) out.push({ base: comp.y, draw: () => {
    const x = Math.round(comp.x - camX), y = Math.round(comp.y - camY + Math.sin(comp.t * 3) * 2);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3, 0, 0, 7); ctx.fill();
    drawSpiritAt(L.species, x, y, comp.moving ? comp.dir : 'down', comp.t, 2, L.shiny ? '#ffe9a0' : null);
    // no floating label: your companion's level is in the spirits screen (B)
  } });
  return out;
}

// ---------- meeting and catching ----------
const CATCH = { on: false };
async function encounterWild(t) {
  if (!energyOk(Rules.ENERGY.encounter)) return;
  const zone = t.w.zone;
  wilds = wilds.filter(w => w !== t.w);
  sfx('menu'); popup(t.w.x, t.w.y - 30, 'The spirit stirs...', '#c9f0ff');
  queue({ t: 'Encounter', zone }, 'spirit encounter', true);
  await new Promise(res => { flush.after = () => res(); });
  const wild = S.player.wild;
  if (!wild) return; // refused (energy, limit, needs a water spirit...), the toast already said why
  openCatch(wild);
}
function openCatch(wild) {
  const sp = Rules.SPECIES[wild.species], el = Rules.ELEMENTS[sp.el];
  const zoneW = [.24, .2, .16, .1][sp.rar], speed = [.9, 1.1, 1.35, 1.7][sp.rar];
  Object.assign(CATCH, { on: true, wild, pos: 0, dir: 1, zone: .25 + Math.random() * (.6 - zoneW), w: zoneW, speed, done: false });
  S.catching = true;
  const el2 = $('catch');
  el2.innerHTML = `<div class="cHead"><img src="${spiritFace(wild.species)}" style="border-color:${el.color};${wild.shiny ? 'filter:drop-shadow(0 0 8px #ffe9a0)' : ''}" alt="">
      <div><div class="cName">${wild.shiny ? '✦ SHINY ' : 'A WILD '}${sp.name.toUpperCase()}!</div>
      <div class="sub"><span style="color:${el.color}">${el.name}</span> · ${Rules.RARITY[sp.rar]} · ${el.power}</div></div></div>
    <div class="cHint">CALM IT: press A / E / tap when the light is inside the ring</div>
    <div class="cBar" id="cBar"><div class="cZone" style="left:${CATCH.zone * 100}%;width:${CATCH.w * 100}%"></div><div class="cMark" id="cMark"></div></div>
    <div class="cFoot"><span>CATCH CHANCE ${Math.round(Rules.CATCH_CHANCE[sp.rar] / 2.56)}% IF YOU CALM IT</span><button class="btn" id="cRun">LEAVE IT</button></div>`;
  el2.classList.add('on'); sfx('alert');
  $('cRun').onclick = e => { e.stopPropagation(); finishCatch(false, true); };
  el2.onclick = () => stopCatch();
  const tick = now => {
    if (!CATCH.on || CATCH.done) return;
    const dt = Math.min(.05, (now - (CATCH.last || now)) / 1000); CATCH.last = now;
    CATCH.pos += CATCH.dir * CATCH.speed * dt; if (CATCH.pos > 1) { CATCH.pos = 1; CATCH.dir = -1; } if (CATCH.pos < 0) { CATCH.pos = 0; CATCH.dir = 1; }
    $('cMark').style.left = (CATCH.pos * 100) + '%';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
window.catchKey = e => {
  if (!CATCH.on) return false;
  if (['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); stopCatch(); }
  if (e.key === 'Escape') finishCatch(false, true);
  return true;
};
function stopCatch() {
  if (!CATCH.on || CATCH.done) return;
  const ok = CATCH.pos >= CATCH.zone && CATCH.pos <= CATCH.zone + CATCH.w;
  finishCatch(ok, false);
}
async function finishCatch(ok, ran) {
  if (CATCH.done) return; CATCH.done = true;
  const wild = CATCH.wild, sp = Rules.SPECIES[wild.species], before = (S.spirits || []).length;
  $('cMark').classList.add(ok ? 'good' : 'bad');
  sfx(ok ? 'ok' : 'alert');
  if (!ran) $('catch').querySelector('.cHint').innerHTML = ok ? 'It calms down... is it coming with you?<span class="dots"></span>' : 'It got spooked!';
  if (ok && !ran) $('catch').querySelector('.cHead img').classList.add('wob'); // it wobbles while NEAR rolls the catch
  queue({ t: 'Catch', ok: ok && !ran }, ok ? 'spirit catch' : 'spirit fled', true);
  await new Promise(res => { flush.after = () => res(); });
  const caught = (S.spirits || []).length > before;
  $('catch').classList.remove('on'); CATCH.on = false; S.catching = false;
  if (caught) {
    sfx('success'); const t = S.spirits[S.spirits.length - 1];
    toast(`${wild.shiny ? 'SHINY ' : ''}${sp.name.toUpperCase()} joined you! It is an NFT you own now (#${t.token_id}). Press B to see your spirits.`, 5);
    popup(player.x, player.y - 70, '+ ' + sp.name.toUpperCase(), Rules.ELEMENTS[sp.el].color);
    if (!S.player.lead) queue({ t: 'SetLead', token: t.token_id }, 'companion', true);
  } else if (!ran) toast(`The ${sp.name} slipped away.`, 2.5);
  else toast('You let it go.', 2);
}

// ---------- the Spirit Book (B) ----------
let bookTab = 'mine';
async function openBook(tab) {
  if (tab) bookTab = tab;
  if (bookTab === 'crew' && !unlocked('crew')) bookTab = 'mine';
  const el = $('book'), sps = S.spirits || [], lead = S.player.lead;
  const card = s => {
    const sp = Rules.SPECIES[s.species], e = Rules.ELEMENTS[sp.el], next = sp.evo >= 0 ? Rules.SPECIES[sp.evo] : null;
    const canEvo = next && s.level >= sp.at && (!sp.shard || S.player.shards > 0);
    return `<div class="sCard ${s.shiny ? 'shiny' : ''}" style="border-color:${e.color}">
      <div class="sTop"><b>${s.shiny ? '✦ ' : ''}${s.name.toUpperCase()}</b><span style="background:${e.color}">${e.name}</span></div>
      <img src="${spiritFace(s.species)}" alt="">
      <div class="sub">${Rules.RARITY[s.rarity]} · LV ${s.level}${s.level < 40 ? ` · ${20 - s.xp % 20} XP TO LV ${s.level + 1}` : ' · MAX'}</div>
      <div class="xpBar"><i style="width:${s.level < 40 ? (s.xp % 20) / 20 * 100 : 100}%"></i></div>
      <div class="sStats"><span>HP <i class="up">${s.hp}</i></span><span>ATK <i class="dn">${s.atk}</i></span><span>SPD <i class="cy">${s.spd}</i></span></div>
      <div class="sub sPow">${e.power}</div>
      ${next ? `<div class="sub">${canEvo ? `<b class="gold">READY TO EVOLVE INTO ${next.name.toUpperCase()}!</b>` : `EVOLVES INTO ${next.name.toUpperCase()} AT LV ${sp.at}${sp.shard ? ' + LANTERN SHARD' : ''} · ${s.level >= sp.at ? 'needs a shard' : `${Math.max(0, (sp.at - 1) * 20 - s.xp)} XP to go`}`}</div>` : '<div class="sub">FINAL FORM</div>'}
      <div class="sBtns">
        ${lead === s.token_id ? '<span class="up">✓ COMPANION</span>' : `<button class="btn" data-lead="${s.token_id}">COMPANION</button>`}
        <button class="btn" data-feed="${s.token_id}">FEED</button>
        ${canEvo ? `<button class="btn gold" data-evo="${s.token_id}">EVOLVE!</button>` : ''}
        <button class="btn" data-send="${s.token_id}">SEND</button>
      </div><div class="sNft">NFT #${s.token_id}</div></div>`;
  };
  const caughtBits = BigInt(S.player.book || 0);
  const book = Rules.SPECIES.map((sp, i) => {
    const got = (caughtBits >> BigInt(i)) & 1n;
    return `<div class="bSlot ${got ? 'got' : ''}">${got ? `<img src="${spiritFace(i)}" alt="">` : '<i>?</i>'}<span>${got ? sp.name.toUpperCase() : '???'}</span></div>`;
  }).join('');
  const count = Rules.SPECIES.filter((_, i) => (caughtBits >> BigInt(i)) & 1n).length;
  el.innerHTML = `<div class="gname">SPIRITS</div>
    <div class="tabs"><button class="tab ${bookTab === 'mine' ? 'on' : ''}" data-tab="mine">MY SPIRITS · ${sps.length}</button><button class="tab ${bookTab === 'book' ? 'on' : ''}" data-tab="book">SPIRIT BOOK · ${count} / ${Rules.SPECIES.length}</button>${unlocked('crew') ? `<button class="tab ${bookTab === 'crew' ? 'on' : ''}" data-tab="crew">NIGHT CREW · ${(S.player.crew || []).length} / ${Rules.CREW.MAX}</button>` : ''}<button class="tab ${bookTab === 'fish' ? 'on' : ''}" data-tab="fish">LEGENDS · ${popcount(S.player.legends || 0)} / 5</button></div>
    ${bookTab === 'mine' ? (sps.length ? `<div class="sub" style="margin:.4em 0">Your companion follows you and grows every night. Lantern shards: ${S.player.shards || 0}. Feed: up to ${Rules.FEEDS_A_DAY} a day (crops +6 XP, fish/honey/sushi +12, jade +25).</div>${companionTips(sps, lead)}<div class="sGrid">${sps.map(card).join('')}</div>`
      : '<div class="sub" style="margin:1em 0;line-height:1.7">No spirits yet. Look for glowing wisps around the farm, the town, and the Whispering Woods (north). Walk up and press E / A.</div>')
      : bookTab === 'crew' ? (sps.length ? crewHTML(sps) : '<div class="sub" style="margin:1em 0">Catch a spirit first: your crew is made of your spirits.</div>')
      : bookTab === 'fish' ? await legendsHTML() : `<div class="bGrid">${book}</div>`}
    <div style="margin-top:1em;display:flex;gap:.5em;flex-wrap:wrap"><button class="btn" id="bWallet">WALLET</button><button class="btn big" id="bClose">CLOSE (B)</button></div>`;
  el.classList.add('on'); sfx('menu');
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { delete ISL.crewPick; openBook(b.dataset.tab); });
  if (bookTab === 'crew') bindCrew(el);
  el.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => { queue({ t: 'SetLead', token: b.dataset.lead }, 'companion', true); flush.after = () => openBook(); });
  el.querySelectorAll('[data-evo]').forEach(b => b.onclick = () => evolve(b.dataset.evo));
  el.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => feedMenu(b.dataset.feed));
  el.querySelectorAll('[data-send],[data-sendf]').forEach(b => b.onclick = () => sendFromBook(b.dataset.send || b.dataset.sendf));
  $('bClose').onclick = () => el.classList.remove('on');
  $('bWallet').onclick = () => { el.classList.remove('on'); openWallet(); };
}
// which companion helps with what, and which worlds your spirits already open
const COMPANION_USE = [
  [0, 'Whispering Woods', 'lights the dark woods'], [1, 'Fishing', 'more fish bites'], [3, 'Mining', 'more jade'],
  [4, 'Catching nature spirits', 'easier catches'], [5, 'Ghost notes', 'sees ghost notes'], [6, 'Curses', 'stronger curses'], [2, 'Catching wind spirits', 'easier catches'],
];
function companionTips(sps, lead) {
  const byEl = el => sps.filter(s => Rules.SPECIES[s.species].el === el).sort((a, b) => b.level - a.level)[0];
  const uses = COMPANION_USE.filter(([el]) => byEl(el)).map(([el, what, how]) => {
    const s = byEl(el), e = Rules.ELEMENTS[el];
    return `${what}: <b style="color:${e.color}">${s.name}</b> <span class="sub">(${how})</span>${lead === s.token_id ? ' <span class="up">✓</span>' : ` <button class="btn" data-lead="${s.token_id}">SET</button>`}`;
  });
  const missing = COMPANION_USE.filter(([el]) => !byEl(el));
  if (missing.length) uses.push(`<span class="sub">Not yet: ${missing.map(([el, what]) => `<span style="color:${Rules.ELEMENTS[el].color}">${Rules.ELEMENTS[el].name}</span> for ${what.toLowerCase()}`).join(' · ')}</span>`);
  const has = el => sps.some(s => Rules.SPECIES[s.species].el === el);
  const worlds = [['Whispering Woods', true, 'always open'], ['Moon Market', true, 'opens at 18:00'],
    ['Sunken Shrine', has(1), has(1) ? 'open: you own a water spirit' : 'needs a WATER spirit'], ['Clockwork Sky', has(2), has(2) ? 'open: you own a wind spirit' : 'needs a WIND spirit (owls and moths in the woods)']];
  return `<div class="cTips"><div><div class="gold">BEST COMPANION FOR...</div>${uses.join('<br>')}</div>
    <div><div class="gold">WORLDS YOUR SPIRITS OPEN</div>${worlds.map(([n, ok, why]) => `<span class="${ok ? 'up' : 'dn'}">${ok ? '✓' : '🔒'}</span> ${n} <span class="sub">${why}</span>`).join('<br>')}</div></div>`;
}
function feedMenu(token) {
  const s = S.spirits.find(x => x.token_id === token);
  const foods = S.barn.map((n, i) => ({ n, i })).filter(f => f.n > 0 && f.i !== 12);
  if (!foods.length) { toast('Your barn is empty. Spirits eat crops, fish, honey, sushi and jade.', 3); return; }
  $('book').innerHTML = `<div class="gname">FEED ${s.name.toUpperCase()}</div><div class="sub">${Rules.FEEDS_A_DAY - (S.player.fed_today || 0)} meals left today</div>
    <div class="feedGrid">${foods.map(f => `<button class="btn" data-g="${f.i}"><img src="${goodIcon(f.i)}" alt=""> ${GOODS[f.i].name} ×${f.n}<br><span class="sub">+${f.i === 11 ? 25 : [1, 2, 3].includes(f.i) ? 12 : 6} XP</span></button>`).join('')}</div>
    <button class="btn big" id="fBack">BACK</button>`;
  $('book').querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const before = { xp: s.xp, level: s.level, hp: s.hp, atk: s.atk, spd: s.spd };
    queue({ t: 'Feed', token, good: +b.dataset.g }, 'feed spirit', true); sfx('coin');
    flush.after = () => { const now = (S.spirits || []).find(x => x.token_id === token); if (now) feedReport(now, before); openBook(); };
  });
  $('fBack').onclick = () => openBook();
}
// say what a meal did: XP gained, how far to the next level, and a level-up with the new stats
function feedReport(s, b) {
  const got = s.xp - b.xp; if (got <= 0) return; // refused: the error toast already said why
  const sp = Rules.SPECIES[s.species], next = sp.evo >= 0 ? Rules.SPECIES[sp.evo] : null;
  const evo = next && s.level >= sp.at ? ` It can EVOLVE into ${next.name} now${sp.shard && !S.player.shards ? ' (needs a lantern shard)' : ''}!` : '';
  if (s.level > b.level) {
    sfx('success'); popup(player.x, player.y - 80, 'LEVEL UP!', '#ffd86b');
    const row = (n, a, c, cls) => `<span>${n} <i class="${cls}">${a}${c > a ? ` → ${c}` : ''}</i></span>`;
    openCard(`<div class="ntitle">LEVEL UP!</div>
      <div class="evoRow"><img src="${spiritFace(s.species)}" alt=""></div>
      <div style="text-align:center;font-size:1.15em" class="gold">${s.name.toUpperCase()} · LV ${b.level} → ${s.level}</div>
      <div class="sStats" style="justify-content:center;gap:1.4em;margin:.7em 0">${row('HP', b.hp, s.hp, 'up')}${row('ATK', b.atk, s.atk, 'dn')}${row('SPD', b.spd, s.spd, 'cy')}</div>
      <div class="sub" style="text-align:center">${evo ? evo.trim() : next ? `Evolves into ${next.name} at LV ${sp.at}.` : 'Final form.'}</div>
      <div style="text-align:center;margin-top:1em"><button class="btn big gold" id="cardBtn">NICE</button></div>`, () => openBook(), true);
  } else {
    popup(player.x, player.y - 80, `+${got} XP`, '#8ee68a');
    toast(`+${got} XP for ${s.name} · ${20 - s.xp % 20} XP to LV ${s.level + 1}. Stats grow when it levels up.${evo}`, 4.5);
  }
}
function evolve(token) {
  const s = S.spirits.find(x => x.token_id === token), sp = Rules.SPECIES[s.species], next = Rules.SPECIES[sp.evo];
  queue({ t: 'Evolve', token }, 'evolve', true);
  flush.after = () => {
    const now = S.spirits.find(x => x.token_id === token);
    if (now && now.species === sp.evo) {
      sfx('success');
      openCard(`<div class="ntitle">WHAT? ${s.name.toUpperCase()} IS EVOLVING!</div>
        <div class="evoRow"><img src="${spiritFace(s.species)}" alt=""><span class="gold">▸</span><img class="evoNew" src="${spiritFace(sp.evo)}" alt=""></div>
        <div style="text-align:center;font-size:1.2em" class="gold">${next.name.toUpperCase()}</div>
        <div class="sub" style="text-align:center;margin:.6em 0 1em">Same NFT (#${token}), new form. If you send it to your wallet, it shows there as ${next.name}.</div>
        <div style="text-align:center"><button class="btn big gold" id="cardBtn">AMAZING</button></div>`, () => openBook(), true);
    } else openBook();
  };
}

// ---------- your NEAR wallet ----------
const popcount = n => { let c = 0; for (; n; n &= n - 1) c++; return c; };
// the five legendary fish: riddles until you catch one, then the NFT itself
async function legendsHTML() {
  let mine = [];
  try { mine = (await Backend.nfts()).filter(t => t.metadata.title.startsWith('Legendary fish')); } catch (e) {}
  const got = S.player.legends || 0;
  return `<div class="sub" style="margin:.4em 0;line-height:1.6">Five legends live off the pier. Each bites only when its riddle is true, and only once for you. Every one is a one-of-one NFT.</div>
    <div class="sGrid">${Rules.LEGENDS.map((L, k) => {
      const has = got & (1 << k), tok = mine.find(t => t.metadata.title.endsWith(L.name));
      return `<div class="sCard" style="border-color:${has ? L.tint : '#4a3f72'}"><div class="sTop"><b>${has ? L.name.toUpperCase() : '???'}</b><span style="background:${L.tint}">LEGEND</span></div>
        ${has ? `<img src="nft/fish/${k}.png" alt="" style="width:8em;height:8em;border-radius:8px">` : `<div style="font-size:3.4em;text-align:center;color:#5d5280;margin:.25em 0">?</div>`}
        <div class="sub" style="line-height:1.6;min-height:3.2em">"${L.riddle}"</div>
        <div class="sBtns">${has ? (tok ? `<span class="up">✓ CAUGHT</span><button class="btn" data-sendf="${tok.token_id}">SEND</button><span class="sNft">NFT #${tok.token_id}</span>` : '<span class="up">✓ CAUGHT · SENT AWAY</span>') : '<span class="sub">not caught yet</span>'}</div></div>`;
    }).join('')}</div>`;
}
function showLegend(k) {
  const L = Rules.LEGENDS[k]; sfx('success');
  openCard(`<div class="ntitle" style="color:${L.tint}">LEGENDARY CATCH!</div>
    <div style="text-align:center;margin:.6em 0"><img src="nft/fish/${k}.png" alt="" style="width:14em;max-width:70vw;border-radius:12px;box-shadow:0 0 30px ${L.tint}88" class="evoNew"></div>
    <div style="text-align:center;line-height:1.7">You pulled up the <b class="gold">${L.name.toUpperCase()}</b>. Nobody else has yours: it is a one-of-one NFT on NEAR.<br>${popcount(S.player.legends)} of 5 legends caught. Press B to see the others' riddles.</div>
    <div style="text-align:center;margin-top:1em"><button class="btn big gold" id="cardBtn">WHAT A FISH!</button></div>`, null, true);
}
async function sendFromBook(token) { $('book').classList.remove('on'); await openWallet('items'); sendItem(token); }
