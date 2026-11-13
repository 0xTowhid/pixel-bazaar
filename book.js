// HOW TO PLAY as a book you can turn: two pages at a time, chapter tabs on the side, a page flip with a paper sound.
// Opens from the welcome card (the short book), the Journal (J) and the menu (the full book).

const BOOK_FULL = [
  { tab: 'STORY', ch: 'THE LANTERN ISLES', pages: [
    { h: 'YOUR DEBT', img: 'f_LanternRed', p: `You arrive owing the <b>Harbor Master 3,000 coins</b>. You have 300 coins and <b>10 days</b>.`, tip: 'Pay him before day 10 ends to win the season.' },
    { h: 'THE STOLEN FLAME', img: 'f_GiantSpirit', p: `Someone stole the <b>Great Lantern</b> and the island's spirits went wild.<br><br>Earn your coins, catch the spirits, and follow the clues through four worlds to find who took the flame.` } ] },
  { tab: 'A DAY', ch: 'ONE DAY', pages: [
    { h: 'MORNING AND DAY', img: 'f_Owl', p: `<ol><li><b>Morning:</b> the paper and the locals tell <b>rumors</b> about tomorrow's prices. Some lie.</li><li><b>Day:</b> farm, fish, mine, catch spirits, sell, trade and do your <b>3 daily quests</b>.</li></ol>`, tip: 'Most actions use energy. It refills every night.' },
    { h: 'NIGHT', img: 'f_Owl2', p: `<ol><li><b>After 18:00</b> walk home and press E on your door to <b>sleep</b>. Stay up too late and you pass out.</li><li>At night <b>NEAR reveals</b> what really happened: prices move, trades pay out, crops grow, your night crew works.</li></ol>` } ] },
  { tab: 'UNLOCKS', ch: 'WHAT OPENS WHEN', pages: [
    { h: 'THE FIRST DAYS', img: 'f_Flam', p: `Your first season opens a little each day:<ol><li><b>Day 1:</b> farm, sell, fish, mine, catch spirits, rumors, trading.</li><li><b>Day 2:</b> the other worlds, fate cards, the night crew.</li></ol>` },
    { h: 'AND THEN', img: 'f_Flam2', p: `<ol><li><b>Day 3:</b> spirit duels, your own calls and curses, the player market.</li><li><b>Day 4:</b> the baron race for the five stalls.</li></ol>`, tip: 'From season 2, everything is open from the start. The yellow arrow always shows your next goal.' } ] },
  { tab: 'COINS', ch: 'MAKING COINS', pages: [
    { h: 'THE FARM', img: 'f_Bamboo', p: `Behind your house are your <b>farm plots</b>. Pick a seed with keys <b>1-9</b>, plant it, and water it every day.<br><br>Crops grow while you sleep. Rain waters them for you. <b>Frost</b> kills them.` },
    { h: 'SELLING AND MORE', img: 'f_GoldRacoon', p: `<ol><li><b>Tea, honey, carrots, fish, jade</b> sell at the barons' stalls. <b>Seeds, apples, ore</b> and the rest at <b>Tomo's</b>.</li><li><b>Fish</b> at the pier, <b>mine</b> rocks, shake <b>apple trees</b>, pet <b>Mochi</b> the cat.</li><li><b>Quests</b> (Q) pay coins every day.</li></ol>` } ] },
  { tab: 'TRADING', ch: 'TRADING ON RUMORS', pages: [
    { h: 'LONG OR SHORT', img: 'f_Eye2', p: `At a stall, or at Tomo's, bet on a good: <b>LONG</b> if the price will rise, <b>SHORT</b> if it will fall. Add leverage to win more.<br><br>Trades settle at night on NEAR.`, tip: 'x5 and x10 need a license. Big leverage can wipe out your stake.' },
    { h: 'WHO TO TRUST', img: 'f_Snake', p: `Rumors come from the paper and the locals. Some always lie, some lie only on some days. Learn who to trust.<br><br>Give gifts to make friends: friends tell you <b>how sure</b> they are.` } ] },
  { tab: 'WORLDS', ch: 'THE STORY', pages: [
    { h: 'CHAPTERS 1 TO 3', img: 'f_Spirit', p: `<ol><li>Catch your first spirit and sell anything.</li><li><b>Whispering Woods</b> (north road): the brazier puzzle. A fire spirit lights the dark.</li><li><b>Sunken Shrine</b> (east shore): the bell puzzle. You need a <b>water</b> spirit.</li></ol>` },
    { h: 'CHAPTERS 4 AND 5', img: 'f_TenguBlue', p: `<ol><li><b>Clockwork Sky</b> (north-east cliff): the gear puzzle. You need a <b>wind</b> spirit.</li><li><b>The Old Gate</b>, deep in the woods: beat the <b>Great Spirit</b> in a duel.</li></ol>`, tip: 'The Moon Market gate in town opens after 18:00. Every world has a chest that refills daily.' } ] },
  { tab: 'SPIRITS', ch: 'SPIRITS', pages: [
    { h: 'CATCH AND RAISE', img: 'f_KappaGreen', p: `Walk up to a <b>glowing wisp</b>, press E and stop the bar in the green. Every spirit is a real <b>NFT you own</b> (press B).<br><br>Your <b>companion</b> follows you and grows each night. Feed it and it <b>evolves</b>.` },
    { h: 'CREW AND DUELS', img: 'f_Dragon', p: `Up to 3 spirits on your <b>night crew</b> work while you sleep: earth mines, water fishes, nature farms, fire guards, wind delivers.<br><br><b>Duel</b> Mei, Rita or the Great Spirit with 3 spirits, once a day each.`, tip: 'Fire beats nature, nature beats water, water beats fire.' } ] },
  { tab: 'BARONS', ch: 'OWN THE BAZAAR', pages: [
    { h: 'THE FIVE BARONS', img: 'f_Skull', p: `Kaito (tea), Rita (honey), Granny Pell (carrots), Bolt-9 (fish) and Luna (jade) own the stalls.<br><br>Each makes a <b>sealed call</b> every morning, opened at night. <b>Peek</b> for a price, then follow or fade them.` },
    { h: 'TAKE A STALL', img: 'f_SkullBlue', p: `Out-trade a baron on their own good this season, and pay your debt: their <b>stall NFT</b> is yours. It pays rent every night, and that good sells 10% higher.`, tip: 'Hold all five and finish the story to become the Lantern Keeper.' } ] },
  { tab: 'BOARD', ch: 'THE BAZAAR BOARD', pages: [
    { h: 'THE WHOLE ISLAND', img: 'f_Mushroom', p: `Press <b>I</b>, or walk up to the board in the town square.<ol><li><b>Calls:</b> the barons' calls, and your own. A right call pays.</li><li><b>Feed:</b> what every player did.</li><li><b>Curses:</b> curse a rival; charms block curses.</li></ol>` },
    { h: 'TOGETHER', img: 'f_Octopus', p: `<ol><li><b>Market:</b> buy and sell spirits and legendary fish with other players. 5% of each sale is burned.</li><li><b>Goal:</b> one goal a week for everyone. Do your part, get <b>80 coins</b>.</li><li><b>Boss:</b> rarely, a world boss you all fight.</li></ol>` } ] },
  { tab: 'SEASONS', ch: 'NEW SEASONS', pages: [
    { h: 'WHAT YOU KEEP', img: 'f_Butterfly', p: `After day 10 a new season starts. You keep your farm, spirits, stalls, badges and items. Coins start again at 300.`, tip: 'The Harbor Master raises the debt 500 each season, up to 6,000.' },
    { h: 'OMENS', img: 'f_ButterflyBlue', p: `From season 2, Madame Vey turns three <b>omens</b>. Pick one: it lasts the whole season.<br><br>An extra crop per harvest, more fish, easier catches, cheaper mining, better prices, or coins every night.` } ] },
  { tab: 'NEAR', ch: 'IT IS ALL ON NEAR', pages: [
    { h: 'A REAL ACCOUNT', img: 'f_Eye', p: `Your game account is a real NEAR account, and you <b>never pay gas</b>. Every move is saved on NEAR: watch the saving dot.<br><br>Open <b>WALLET</b> to receive NEAR and send spirits, badges and fish to anyone.` },
    { h: 'KEYS', img: 'f_Slime', p: `<ol><li><b>Arrows / WASD</b> move · <b>E</b> act</li><li><b>1-9</b> seeds · <b>B</b> spirits</li><li><b>Q</b> quests · <b>I</b> island</li><li><b>P</b> profile · <b>J</b> journal · <b>Tab</b> menu</li></ol>`, tip: 'On phones: the thumb stick and the A button.' } ] },
];
const BOOK_SHORT = [
  { ch: 'HOW TO PLAY', pages: [
    { h: 'YOUR GOAL', img: 'f_LanternRed', p: `You owe the <b>Harbor Master 3,000 coins</b>. You have 300 and <b>10 days</b>.<br><br>Farm, fish, catch spirits and trade on rumors to pay him. Someone also stole the Great Lantern: find out who.` },
    { h: 'ONE DAY', img: 'f_Owl', p: `<ol><li><b>Day:</b> farm, sell, catch spirits, listen to rumors about tomorrow's prices.</li><li><b>After 18:00:</b> go home and <b>sleep</b>.</li><li><b>Night:</b> NEAR reveals the real prices. Crops grow, trades pay out.</li></ol>`, tip: 'The yellow arrow always points at your next goal.' } ] },
  { ch: 'HOW TO PLAY', pages: [
    { h: 'LEARN AS YOU GO', img: 'f_Flam', p: `Walk up to anything and a hint tells you what it does.<br><br>New things open each day: <b>day 2</b> the other worlds and your night crew, <b>day 3</b> duels and the market, <b>day 4</b> the baron race.` },
    { h: 'READY?', img: 'f_KappaGreen', p: `The whole guide is in your <b>Journal</b> (press J), as this same book.<br><br>Good luck, trader.`, end: true } ] },
];

const GB = { pages: [], tabs: [], i: 0, busy: false, done: null, short: false };

function bookPageHTML(pg, n, side) {
  if (!pg) return `<div class="gbPg ${side}"></div>`;
  return `<div class="gbPg ${side}"><div class="gbCh">${pg.chN ? `CHAPTER ${pg.chN} · ` : ''}${pg.ch}</div><h2>${pg.h}</h2>
    ${pg.img ? `<div class="gbArt"><img src="assets/spirits/${pg.img}.png" alt=""></div>` : ''}
    <div class="gbTxt">${pg.p}</div>${pg.tip ? `<div class="gbTip">TIP · ${pg.tip}</div>` : ''}
    ${pg.end ? `<div style="text-align:center;margin-top:.8em"><button class="btn big gold" data-gbclose>LET'S PLAY</button></div>` : ''}
    <div class="gbNum">— ${n} —</div>${side === 'r' ? '<div class="gbCurl"></div>' : ''}</div>`;
}
function renderBook() {
  const el = $('gbook'), i = GB.i, L = GB.pages[i], R = GB.pages[i + 1];
  const curTab = L ? L.tabI : -1, last = i + 2 >= GB.pages.length;
  el.innerHTML = `<div class="gbWrap"><div class="gbBook" id="gbBook"><div class="gbCover"></div><div class="gbRibbon"></div>
      ${bookPageHTML(L, i + 1, 'l')}${bookPageHTML(R, i + 2, 'r')}</div>
    ${GB.tabs.length ? `<div class="gbTabs">${GB.tabs.map((t, k) => `<button class="${k === curTab ? 'on' : ''}" data-gbtab="${k}">${t}</button>`).join('')}</div>` : ''}
    <div class="gbNav"><button class="btn" id="gbBack" ${i ? '' : 'disabled'}>◂ TURN BACK</button>
      <span>PAGE ${i + 1}-${Math.min(i + 2, GB.pages.length)} OF ${GB.pages.length} · ← → OR SWIPE · <a id="gbX">CLOSE</a></span>
      <button class="btn gold" id="gbNext">${last ? (GB.short ? "LET'S PLAY" : 'CLOSE THE BOOK') : 'TURN PAGE ▸'}</button></div></div>`;
  $('gbBack').onclick = () => turnBook(-1);
  $('gbNext').onclick = () => last ? closeGuideBook() : turnBook(1);
  $('gbX').onclick = closeGuideBook;
  el.querySelectorAll('[data-gbclose]').forEach(b => b.onclick = closeGuideBook);
  el.querySelectorAll('[data-gbtab]').forEach(b => b.onclick = () => { const k = +b.dataset.gbtab, to = GB.pages.findIndex(p => p.tabI === k); if (to >= 0 && to !== GB.i) turnBook(to > GB.i ? 1 : -1, to); });
  const bk = $('gbBook'); let sx = null;
  bk.onpointerdown = e => { sx = e.clientX; };
  bk.onpointerup = e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) turnBook(dx < 0 ? 1 : -1); };
}
// the flip: a leaf turns over the spine (front = the page it leaves, back = the page it shows)
function turnBook(dir, to) {
  if (GB.busy) return;
  const from = GB.i, next = to !== undefined ? to : from + dir * 2;
  if (next < 0 || next >= GB.pages.length) return;
  GB.busy = true; pageSound();
  const bk = $('gbBook'), fwd = next > from;
  const front = fwd ? GB.pages[from + 1] : GB.pages[from], back = fwd ? GB.pages[next] : GB.pages[next + 1];
  // under the leaf, show the destination's page on that side
  const under = fwd ? GB.pages[next + 1] : GB.pages[next];
  const sidePg = bk.querySelector(fwd ? '.gbPg.r' : '.gbPg.l');
  sidePg.outerHTML = bookPageHTML(under, (fwd ? next + 2 : next + 1), fwd ? 'r' : 'l');
  const leaf = document.createElement('div'); leaf.className = 'gbLeaf ' + (fwd ? 'fwd' : 'bwd');
  leaf.innerHTML = `<div class="gbFace front">${bookPageHTML(front, fwd ? from + 2 : from + 1, fwd ? 'r' : 'l')}</div><div class="gbFace back">${bookPageHTML(back, fwd ? next + 1 : next + 2, fwd ? 'l' : 'r')}</div>`;
  bk.appendChild(leaf);
  requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('go')));
  setTimeout(() => { GB.i = next; GB.busy = false; renderBook(); }, 620);
}
function pageSound() {
  try {
    const ac = pageSound.ac || (pageSound.ac = new (window.AudioContext || window.webkitAudioContext)());
    if (!audioReady) return;
    const len = ac.sampleRate * .32, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) { const t = k / len; d[k] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 2) * (1 - t * .6); }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = .6; g.gain.value = .35;
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
  } catch (e) {}
}
function openGuideBook(short) {
  const src = short ? BOOK_SHORT : BOOK_FULL;
  GB.short = !!short; GB.pages = []; GB.tabs = short ? [] : src.map(c => c.tab); GB.i = 0; GB.busy = false;
  src.forEach((c, k) => c.pages.forEach(p => GB.pages.push({ ...p, ch: c.ch, chN: short ? 0 : k + 1, tabI: k })));
  renderBook(); $('gbook').classList.add('on'); sfx('menu');
  return new Promise(res => { GB.done = res; });
}
function closeGuideBook() {
  if (!$('gbook').classList.contains('on')) return;
  $('gbook').classList.remove('on'); sfx('ok');
  const d = GB.done; GB.done = null; if (d) d(false);
}
window.guideKey = e => {
  if (!$('gbook') || !$('gbook').classList.contains('on')) return false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); GB.i + 2 >= GB.pages.length ? closeGuideBook() : turnBook(1); }
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); turnBook(-1); }
  else if (e.key === 'Escape' || e.key === 'j' || e.key === 'J') closeGuideBook();
  return true;
};
// the old name still works everywhere the game asks for the guide
function showGuide(short) { return openGuideBook(short); }
