// The Lantern Isles: intro cutscene, the welcome card (why play), and the spotlight tour.
// Everything here is presentation only; nothing touches the chain.

// ---------- spirit sprites drawn over the screen (intro) ----------
const FX = { spirits: [], t: 0, lantern: 1, raf: 0 };
const FX_SPIRITS = ['Flam', 'Spirit', 'LanternGreen', 'Spirit2', 'LanternRed', 'Butterfly', 'Owl', 'Axolot'];
const FX_IMG = {};
function fxImg(n) { if (!FX_IMG[n]) { const i = new Image(); i.src = 'assets/spirits/' + n + '.png'; FX_IMG[n] = i; } return FX_IMG[n]; }

// ---------- keyboard while a story overlay is open ----------
let storyHandler = null;
window.storyKey = e => {
  if (!storyHandler) return false;
  const k = e.key;
  if (['Enter', ' ', 'e', 'E', 'ArrowRight'].includes(k)) { e.preventDefault(); storyHandler('next'); }
  else if (k === 'ArrowLeft') storyHandler('back');
  else if (k === 'Escape') storyHandler('skip');
  return true;
};

// ---------- 1. the intro ----------
const INTRO = [
  { who: null, text: 'The Lantern Isles. For a hundred years, the Great Lantern on the hill kept the island spirits calm.', lantern: 1 },
  { who: null, text: 'Then, on the very night you arrived to settle your debt...', lantern: 1, flicker: true },
  { who: null, text: '...it went out.', lantern: 0, burst: true },
  { who: 'mei', name: 'MEI', color: '#ff9ad5', text: 'You can see them too? Nobody else can! The spirits are loose all over the island.', lantern: 0 },
  { who: 'mei', name: 'MEI', color: '#ff9ad5', text: "Someone stole the Lantern's flame. Without it the spirits run wild and the town falls apart.", lantern: 0 },
  { who: 'master', name: 'HARBOR MASTER', color: '#ffd86b', text: 'Lantern or no Lantern, you still owe me 5,000 coins. Ten days.', lantern: 0 },
  { who: 'mei', name: 'MEI', color: '#ff9ad5', text: "Catch the spirits, find who took the flame, and I'll help you with that debt. Come find me at the market!", lantern: 0 },
];
function playIntro() {
  return new Promise(done => {
    S.story = true; playMusic('story');
    const el = $('cine'); el.classList.add('on');
    let i = 0;
    const fcv = $('fxcv'), fx = fcv.getContext('2d');
    FX.spirits = []; FX.lantern = 1; FX.t = 0;
    const resize = () => { const r = $('stage').getBoundingClientRect(); fcv.width = r.width; fcv.height = r.height; fx.imageSmoothingEnabled = false; };
    resize();
    const burst = () => {
      const w = fcv.width, h = fcv.height;
      for (let k = 0; k < 14; k++) FX.spirits.push({ n: FX_SPIRITS[k % FX_SPIRITS.length], x: w / 2, y: h * .2, vx: (Math.random() * 2 - 1) * 260, vy: 60 + Math.random() * 180, s: 2.4 + Math.random() * 1.6, ph: Math.random() * 6 });
    };
    let lastT = performance.now();
    const frame = now => {
      const dt = Math.min(.05, (now - lastT) / 1000); lastT = now; FX.t += dt;
      const w = fcv.width, h = fcv.height; fx.clearRect(0, 0, w, h);
      // night over the town
      fx.fillStyle = 'rgba(8,6,32,.78)'; fx.fillRect(0, 0, w, h);
      // the Great Lantern
      const cur = INTRO[i] || INTRO[INTRO.length - 1];
      const target = cur.lantern;
      FX.lantern += (target - FX.lantern) * Math.min(1, dt * 3);
      let glow = FX.lantern; if (cur.flicker) glow *= .55 + .45 * Math.abs(Math.sin(FX.t * 11) * Math.sin(FX.t * 4.3));
      const lx = w / 2, ly = h * .2, s = Math.max(1, h / 450);
      if (glow > .02) { const g = fx.createRadialGradient(lx, ly, 4, lx, ly, 200 * s); g.addColorStop(0, `rgba(255,214,120,${.55 * glow})`); g.addColorStop(1, 'rgba(255,170,80,0)'); fx.fillStyle = g; fx.fillRect(0, 0, w, h); }
      fx.fillStyle = '#2c2018'; fx.fillRect(lx - 7 * s, ly + 18 * s, 14 * s, 70 * s); fx.fillRect(lx - 16 * s, ly - 26 * s, 32 * s, 6 * s);
      fx.fillStyle = `rgb(${80 + 175 * glow},${60 + 150 * glow},${40 + 80 * glow})`; fx.fillRect(lx - 13 * s, ly - 20 * s, 26 * s, 38 * s);
      fx.strokeStyle = '#2c2018'; fx.lineWidth = 3 * s; fx.strokeRect(lx - 13 * s, ly - 20 * s, 26 * s, 38 * s);
      // spirits
      for (const p of FX.spirits) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; p.vy *= .985; p.ph += dt * 3;
        const yy = p.y + Math.sin(p.ph) * 10, img = fxImg(p.n), fr = Math.floor(FX.t * 6) % 4;
        fx.save(); fx.shadowColor = '#ffe9a0'; fx.shadowBlur = 18;
        if (img.complete) fx.drawImage(img, 0, fr * 16, 16, 16, p.x - 8 * p.s, yy - 8 * p.s, 16 * p.s, 16 * p.s);
        fx.restore();
      }
      FX.raf = requestAnimationFrame(frame);
    };
    FX.raf = requestAnimationFrame(frame);
    const show = () => {
      const f = INTRO[i];
      if (f.burst && !FX.spirits.length) { burst(); sfx('alert'); }
      $('cineN').textContent = (i + 1) + ' / ' + INTRO.length;
      $('cineBox').innerHTML = (f.who ? `<canvas id="cinePort" width="96" height="96"></canvas>` : '') +
        `<div style="flex:1">${f.who ? `<div style="color:${f.color};margin-bottom:.5em">${f.name}</div>` : ''}<div class="cineT">${esc(f.text)}</div></div><div class="sub" style="align-self:flex-end">▼ A</div>`;
      $('cineBox').classList.toggle('narr', !f.who);
      if (f.who) portrait(f.who, $('cinePort'));
      sfx('voice');
    };
    const end = () => {
      storyHandler = null; cancelAnimationFrame(FX.raf); el.classList.remove('on'); S.story = false; playMusic('village');
      fx.clearRect(0, 0, fcv.width, fcv.height); done();
    };
    storyHandler = a => {
      if (a === 'skip') return end();
      if (a === 'back') { i = Math.max(0, i - 1); return show(); }
      i++; if (i >= INTRO.length) return end(); show();
    };
    $('cineSkip').onclick = e => { e.stopPropagation(); storyHandler('skip'); };
    el.onclick = () => storyHandler && storyHandler('next');
    show();
  });
}

// ---------- 2. the welcome card: why play ----------
function showWelcome() {
  return new Promise(res => {
    const item = (f, t, d) => `<div class="wItem"><img src="assets/spirits/f_${f}.png" alt=""><div><b>${t}</b><span>${d}</span></div></div>`;
    openCard(`<div class="ntitle">WELCOME TO THE LANTERN ISLES</div>
      <div class="sub" style="text-align:center;margin-bottom:1em">Someone stole the Great Lantern. The spirits are loose. You can talk to them.</div>
      <div class="wGrid">
        ${item('Flam', 'CATCH SPIRITS', 'They follow you, evolve, and are real NFTs you own')}
        ${item('LanternRed', 'FIND THE THIEF', '5 chapters across 4 worlds')}
        ${item('KappaGreen', 'DUEL WITH CARDS', '3 vs 3 spirit card battles')}
        ${item('Owl', 'YOUR FATE, DAILY', "Madame Vey's three cards every morning")}
        ${item('Mushroom', 'FARM · FISH · TRADE', 'The cozy life between adventures')}
        ${item('Skull', 'PRANK OTHER PLAYERS', 'Ghost notes, curses, a rare world boss')}
      </div>
      <div style="text-align:center;margin-top:1.2em"><button class="btn big gold" id="cardBtn">TAKE THE 1-MINUTE TOUR</button> <button class="btn big" id="wSkip">SKIP, LET ME PLAY</button></div>
      <div class="sub" style="text-align:center;margin-top:.8em">No wallet needed. Everything you earn is saved on NEAR.</div>`, () => res(true));
    $('wSkip').onclick = e => { e.stopPropagation(); cardCb = null; $('card').classList.remove('on'); sfx('ok'); res(false); };
  });
}

// ---------- 3. the spotlight tour ----------
const domTarget = sel => () => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel(); if (!e) return null; const r = e.getBoundingClientRect(), st = $('stage').getBoundingClientRect(); return { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height }; };
const worldTarget = (fn, w = 90, h = 110) => () => { const p = fn(); if (!p) return null; const s = toScreen(p.x, p.y); return { x: s.x - w * s.k / 2, y: s.y - h * s.k * .75, w: w * s.k, h: h * s.k }; };
const TOUR = [
  { t: 'YOUR GOAL', d: 'Your current goal is always written here, and a yellow arrow on screen points the way. Tap it (or press Q) for the story and the daily quests.', at: domTarget('#objBox') },
  { t: 'THAT IS YOU', d: 'Move with the arrow keys or WASD (on phones, the pad). Press E or Space (A on phones) to talk, farm, fish and catch spirits.', at: worldTarget(() => player) },
  { t: 'COINS AND DEBT', d: 'You start with 300 coins and owe the Harbor Master 5,000. This bar fills as you get closer. Chapter 1 ends when you pay him.', at: domTarget(() => $('hudL').children[2]) },
  { t: 'ENERGY', d: 'Farming, mining, fishing and catching spirits use energy. It refills every night when you sleep.', at: domTarget(() => $('hudL').children[3]) },
  { t: 'SEEDS', d: 'Pick a seed with keys 1-9 (or tap it). Plant and water it on the plots behind your house, then sell the harvest.', at: domTarget('#hotbar') },
  { t: 'MEI', d: 'The townsfolk hear rumors about tomorrow. Some tell the truth, some do not. Make friends: gifts fill their hearts.', at: worldTarget(() => NPCS.mei) },
  { t: "TOMO'S STALL", d: 'Sell your harvest, buy seeds, or bet on the rumors: go long or short with leverage. Trades settle overnight on NEAR.', at: worldTarget(() => NPCS.tomo) },
  { t: 'PROFILE AND JOURNAL', d: 'P opens your profile: badges, spirits, wallet. J opens the journal: rumors, friends, and this tour again.', at: domTarget(() => { const a = $('pBtn').getBoundingClientRect(), b = $('jBtn').getBoundingClientRect(); return { getBoundingClientRect: () => ({ left: a.left, top: a.top, width: b.right - a.left, height: a.height }) }; }) },
  { t: 'YOUR HOUSE', d: 'After 18:00, go home and sleep. Overnight the day is revealed on NEAR: prices move, crops grow, trades pay out.', at: worldTarget(() => ({ x: World.P.homeDoor.x * TW, y: World.P.homeDoor.y * TW }), 130, 130) },
];
function startTour() {
  let i = 0; S.story = true;
  const el = $('tour'); el.classList.add('on');
  const spot = $('tourSpot'), box = $('tourBox');
  const place = () => {
    const step = TOUR[i], st = $('stage').getBoundingClientRect();
    const r = step.at() || { x: st.width / 2 - 60, y: st.height / 2 - 60, w: 120, h: 120 };
    const pad = 8;
    Object.assign(spot.style, { left: (r.x - pad) + 'px', top: (r.y - pad) + 'px', width: (r.w + pad * 2) + 'px', height: (r.h + pad * 2) + 'px' });
    box.innerHTML = `<div class="sub">TOUR · ${i + 1} OF ${TOUR.length}</div><div class="tT">${step.t}</div><div class="tD">${step.d}</div>
      <div class="tDots">${TOUR.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tBtns"><button class="btn" id="tBack" ${i ? '' : 'disabled'}>BACK</button><button class="btn gold" id="tNext">${i === TOUR.length - 1 ? 'START PLAYING' : 'NEXT ▸'}</button><span style="flex:1"></span><button class="btn" id="tSkip">SKIP TOUR</button></div>`;
    // put the box beside the spotlight, inside the screen
    const bw = Math.min(st.width - 24, 520), bh = box.offsetHeight || 220;
    let bx = r.x + r.w + 24, by = r.y;
    if (bx + bw > st.width - 12) bx = r.x - bw - 24;
    if (bx < 12) { bx = Math.max(12, Math.min(st.width - bw - 12, r.x + r.w / 2 - bw / 2)); by = r.y + r.h + 20; if (by + bh > st.height - 12) by = r.y - bh - 20; }
    by = Math.max(12, Math.min(st.height - bh - 12, by));
    Object.assign(box.style, { left: bx + 'px', top: by + 'px', width: bw + 'px' });
    $('tBack').onclick = e => { e.stopPropagation(); storyHandler('back'); };
    $('tNext').onclick = e => { e.stopPropagation(); storyHandler('next'); };
    $('tSkip').onclick = e => { e.stopPropagation(); storyHandler('skip'); };
    sfx('menu');
  };
  const end = () => { storyHandler = null; el.classList.remove('on'); S.story = false; removeEventListener('resize', place); toast('Have fun! The tour is in your Journal any time.', 3.5); };
  storyHandler = a => {
    if (a === 'skip') return end();
    if (a === 'back') { i = Math.max(0, i - 1); return place(); }
    i++; if (i >= TOUR.length) return end(); place();
  };
  addEventListener('resize', place);
  place(); setTimeout(place, 60); // second pass once the box has its real height
}
