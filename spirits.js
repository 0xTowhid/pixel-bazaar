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
  const z = World.zone(Math.floor(player.x / TW), Math.floor(player.y / TW));
  const night = S.t / DAY_SECONDS > 12 / 18;
  if (z === 'woods') return 1;
  if (night && (z === 'town' || z === 'harbor')) return 4; // the Moon Market comes out at night
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
    ctx.font = '9px Joy, monospace'; ctx.textAlign = 'center'; const t = `Lv ${L.level} ${L.name.toUpperCase()}`, w2 = ctx.measureText(t).width + 8;
    ctx.fillStyle = '#000a'; ctx.fillRect(x - w2 / 2, y - 48, w2, 12); ctx.fillStyle = elOf(L.species).color; ctx.fillText(t, x, y - 39);
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
  if (!ran) $('catch').querySelector('.cHint').textContent = ok ? 'It calms down... is it coming with you?' : 'It got spooked!';
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
  const el = $('book'), sps = S.spirits || [], lead = S.player.lead;
  const card = s => {
    const sp = Rules.SPECIES[s.species], e = Rules.ELEMENTS[sp.el], next = sp.evo >= 0 ? Rules.SPECIES[sp.evo] : null;
    const canEvo = next && s.level >= sp.at && (!sp.shard || S.player.shards > 0);
    return `<div class="sCard ${s.shiny ? 'shiny' : ''}" style="border-color:${e.color}">
      <div class="sTop"><b>${s.shiny ? '✦ ' : ''}${s.name.toUpperCase()}</b><span style="background:${e.color}">${e.name}</span></div>
      <img src="${spiritFace(s.species)}" alt="">
      <div class="sub">${Rules.RARITY[s.rarity]} · LV ${s.level} · ${s.xp % 20}/20 XP</div>
      <div class="sStats"><span>HP <i class="up">${s.hp}</i></span><span>ATK <i class="dn">${s.atk}</i></span><span>SPD <i class="cy">${s.spd}</i></span></div>
      <div class="sub sPow">${e.power}</div>
      ${next ? `<div class="sub">EVOLVES INTO ${next.name.toUpperCase()} AT LV ${sp.at}${sp.shard ? ' + LANTERN SHARD' : ''}</div>` : '<div class="sub">FINAL FORM</div>'}
      <div class="sBtns">
        ${lead === s.token_id ? '<span class="up">✓ COMPANION</span>' : `<button class="btn" data-lead="${s.token_id}">COMPANION</button>`}
        <button class="btn" data-feed="${s.token_id}">FEED</button>
        ${canEvo ? `<button class="btn gold" data-evo="${s.token_id}">EVOLVE!</button>` : ''}
        ${S.player.wallet ? `<button class="btn" data-send="${s.token_id}">TO WALLET</button>` : ''}
      </div><div class="sNft">NFT #${s.token_id}</div></div>`;
  };
  const caughtBits = BigInt(S.player.book || 0);
  const book = Rules.SPECIES.map((sp, i) => {
    const got = (caughtBits >> BigInt(i)) & 1n;
    return `<div class="bSlot ${got ? 'got' : ''}">${got ? `<img src="${spiritFace(i)}" alt="">` : '<i>?</i>'}<span>${got ? sp.name.toUpperCase() : '???'}</span></div>`;
  }).join('');
  const count = Rules.SPECIES.filter((_, i) => (caughtBits >> BigInt(i)) & 1n).length;
  el.innerHTML = `<div class="gname">SPIRITS</div>
    <div class="tabs"><button class="tab ${bookTab === 'mine' ? 'on' : ''}" data-tab="mine">MY SPIRITS · ${sps.length}</button><button class="tab ${bookTab === 'book' ? 'on' : ''}" data-tab="book">SPIRIT BOOK · ${count} / ${Rules.SPECIES.length}</button></div>
    ${bookTab === 'mine' ? (sps.length ? `<div class="sub" style="margin:.4em 0">Your companion follows you and grows every night. Lantern shards: ${S.player.shards || 0}. Feed: up to ${Rules.FEEDS_A_DAY} a day (crops +6 XP, fish/honey/sushi +12, jade +25).</div><div class="sGrid">${sps.map(card).join('')}</div>`
      : '<div class="sub" style="margin:1em 0;line-height:1.7">No spirits yet. Look for glowing wisps around the farm, the town, and the Whispering Woods (north). Walk up and press E / A.</div>')
      : `<div class="bGrid">${book}</div>`}
    <div style="margin-top:1em;display:flex;gap:.5em;flex-wrap:wrap"><button class="btn" id="bWallet">${S.player.wallet ? 'WALLET: ' + S.player.wallet : 'LINK A NEAR WALLET'}</button><button class="btn big" id="bClose">CLOSE (B)</button></div>`;
  el.classList.add('on'); sfx('menu');
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => openBook(b.dataset.tab));
  el.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => { queue({ t: 'SetLead', token: b.dataset.lead }, 'companion', true); flush.after = () => openBook(); });
  el.querySelectorAll('[data-evo]').forEach(b => b.onclick = () => evolve(b.dataset.evo));
  el.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => feedMenu(b.dataset.feed));
  el.querySelectorAll('[data-send]').forEach(b => b.onclick = () => sendToWallet(b.dataset.send));
  $('bClose').onclick = () => el.classList.remove('on');
  $('bWallet').onclick = () => walletPanel();
}
function feedMenu(token) {
  const s = S.spirits.find(x => x.token_id === token);
  const foods = S.barn.map((n, i) => ({ n, i })).filter(f => f.n > 0 && f.i !== 12);
  if (!foods.length) { toast('Your barn is empty. Spirits eat crops, fish, honey, sushi and jade.', 3); return; }
  $('book').innerHTML = `<div class="gname">FEED ${s.name.toUpperCase()}</div><div class="sub">${Rules.FEEDS_A_DAY - (S.player.fed_today || 0)} meals left today</div>
    <div class="feedGrid">${foods.map(f => `<button class="btn" data-g="${f.i}"><img src="${goodIcon(f.i)}" alt=""> ${GOODS[f.i].name} ×${f.n}<br><span class="sub">+${f.i === 11 ? 25 : [1, 2, 3].includes(f.i) ? 12 : 6} XP</span></button>`).join('')}</div>
    <button class="btn big" id="fBack">BACK</button>`;
  $('book').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { queue({ t: 'Feed', token, good: +b.dataset.g }, 'feed spirit', true); sfx('coin'); flush.after = () => openBook(); });
  $('fBack').onclick = () => openBook();
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
        <div style="text-align:center"><button class="btn big gold" id="cardBtn">AMAZING</button></div>`, () => openBook());
    } else openBook();
  };
}

// ---------- your NEAR wallet ----------
async function walletPanel() {
  const p = S.player, req = await Backend.linkRequest().catch(() => null);
  const mockish = Backend.mode !== 'chain';
  $('book').innerHTML = `<div class="gname">YOUR NEAR WALLET</div>
    <div style="line-height:1.7;margin:.6em 0">Your spirits and badges are real NEAR NFTs (NEP-171). Link a wallet once, then send any of them to it: you will see them in your wallet, can send them to friends or list them on a marketplace, and can send them back to play.</div>
    ${p.wallet ? `<div class="up" style="margin:.6em 0">LINKED: ${esc(p.wallet)}</div><button class="btn" id="wUnlink">UNLINK</button>`
      : req ? `<div style="margin:.6em 0">The wallet <b class="gold">${esc(req)}</b> asked to link to this game account.</div><button class="btn big gold" id="wConfirm">YES, THAT IS MY WALLET</button>`
      : `<ol class="wSteps"><li>Connect your wallet and approve one small transaction (it says "link_wallet").</li><li>Come back here and confirm it.</li></ol>
         ${mockish ? `<div class="sub">Test mode: type a wallet name instead.</div><input id="wName" placeholder="you.testnet"> ` : ''}<button class="btn big gold" id="wConnect">CONNECT A WALLET</button>`}
    <div style="margin-top:1em"><button class="btn big" id="wBack">BACK</button></div>`;
  $('wBack').onclick = () => openBook();
  if ($('wUnlink')) $('wUnlink').onclick = () => { queue({ t: 'UnlinkWallet' }, 'unlink wallet', true); flush.after = () => walletPanel(); };
  if ($('wConfirm')) $('wConfirm').onclick = () => { queue({ t: 'ConfirmWallet', wallet: req }, 'link wallet', true); flush.after = () => { toast('Wallet linked. Now you can send spirits and badges to it.', 4); walletPanel(); }; };
  if ($('wConnect')) $('wConnect').onclick = () => mockish ? mockLink() : connectWallet();
}
async function mockLink() {
  const w = ($('wName').value || '').trim().toLowerCase(); if (!w) return;
  await fetch('/mock/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId: w, method: 'link_wallet', args: { game_account: Backend.accountId } }) }).catch(() => {});
  if (Backend.mode === 'local') { try { Backend.localEngine().link_wallet(w, { game_account: Backend.accountId }); } catch (e) {} }
  walletPanel();
}
async function connectWallet() {
  try {
    if (!document.querySelector('link[href="assets/wallet.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/wallet.css'; document.head.appendChild(l); }
    $('busy').textContent = 'Opening wallets...'; $('busy').style.display = 'block';
    const m = await import('./vendor/wallet.mjs');
    const { selector, modal } = await m.openWallets(Backend.network, Backend.contractId);
    $('busy').style.display = 'none';
    const go = async () => {
      const wallet = await selector.wallet(); const accts = await wallet.getAccounts(); const wid = accts[0] && accts[0].accountId;
      if (!wid) return;
      safeSet('pb_linking', wid);
      toast('Approve the link_wallet transaction in your wallet...', 5);
      await wallet.signAndSendTransaction({ receiverId: Backend.contractId, actions: [{ type: 'FunctionCall', params: { methodName: 'link_wallet', args: { game_account: Backend.accountId }, gas: '30000000000000', deposit: '1' } }] });
      walletPanel();
    };
    if (selector.isSignedIn()) await go();
    else { modal.show(); selector.on('signedIn', () => { modal.hide(); go().catch(e => toast(e.message || String(e), 4)); }); }
  } catch (e) { $('busy').style.display = 'none'; toast('Wallet: ' + (e.message || e), 4); }
}
function sendToWallet(token) {
  const s = S.spirits.find(x => x.token_id === token);
  queue({ t: 'SendToWallet', token }, 'send to wallet', true);
  flush.after = () => { if (!S.spirits.find(x => x.token_id === token)) { sfx('success'); toast(`${s.name} (#${token}) is in your wallet ${S.player.wallet} now.`, 4); } openBook(); };
}
// After a wallet redirect (or on any start): a wallet asked to link? Ask the player once.
async function checkWalletLink() {
  try {
    const req = await Backend.linkRequest();
    if (req && S.player.wallet !== req) { toast(`The wallet ${req} asked to link. Press B, then the wallet button, to confirm.`, 6); }
  } catch (e) {}
}
