// The island, shared with every player on NEAR: ghost notes (true or liar?), curses and charms,
// the rare world boss with one HP bar for everybody, and the island feed.

const WORLD_NO = { town: 0, woods: 1, shrine: 2, sky: 3, moon: 4 };
const ISL = { notes: {}, feed: [], boss: null, seenFeed: 0, polled: 0, tab: 'feed' };
const shortName = a => (a || '').split('.')[0].replace(/^(.{16}).+$/, '$1…');
const shortText = t => (t || '').replace(/\b([a-z0-9_-]+)(\.[a-z0-9_-]+)*\.(testnet|near)\b/gi, '$1');

async function pollIsland(force) {
  if (!S || !S.player || (!force && performance.now() - ISL.polled < 20000)) return;
  ISL.polled = performance.now();
  const w = WORLD_NO[WD.id];
  try {
    const [notes, feed, boss] = await Promise.all([Backend.view('get_notes', { world: w }), Backend.view('get_feed', {}), Backend.view('get_boss', {})]);
    ISL.notes[w] = notes || []; ISL.boss = boss;
    const fresh = (feed || []).filter(f => f.at > ISL.seenFeed && f.who !== Backend.accountId);
    if (fresh.some(f => f.who === Backend.contractId)) sfx('alert');
    if (ISL.seenFeed && fresh.length) { const f = fresh[fresh.length - 1]; toast(f.who === Backend.contractId ? `⚠ ${f.text} Press I.` : `✦ ${shortName(f.who)} ${shortText(f.text)}`, 5); }
    ISL.feed = feed || []; if (ISL.feed.length) ISL.seenFeed = Math.max(ISL.seenFeed, ISL.feed[ISL.feed.length - 1].at);
    else if (!ISL.seenFeed) ISL.seenFeed = 1;
    bossBanner();
  } catch (e) { /* the island can wait */ }
  checkHex();
}
setInterval(() => pollIsland(), 5000);

// ---------- curses landing on you ----------
function checkHex() {
  const h = S.player && S.player.last_hex; if (!h) return;
  const key = 'pb_hex|' + Backend.accountId, sig = JSON.stringify(h) + '|' + S.day + '|' + S.player.charms;
  let seen = null; try { seen = localStorage.getItem(key); } catch (e) {}
  if (seen === sig) return; try { localStorage.setItem(key, sig); } catch (e) {}
  const c = Rules.ISLAND.CURSES[h.kind];
  if (h.blocked) { sfx('success'); toast(`Your charm crumbled: it blocked ${shortName(h.from)}'s ${c.name} curse!`, 5); }
  else { sfx('alert'); toast(`${shortName(h.from)} cursed you with ${c.name.toUpperCase()}! ${h.kind === 0 ? '-15 energy.' : h.kind === 1 ? 'A crow stole 30 coins!' : 'Ribbit. Ribbit.'} Buy charms to block the next one.`, 6); if (h.kind === 2) S.frogDay = S.day; }
}

// ---------- ghost notes ----------
function noteText(n) {
  const L = Rules.ISLAND.NOTE_LINES[n.line] || { t: '...' };
  return L.t.replace('{good}', (GOODS[n.arg] || GOODS[0]).name.toLowerCase()).replace('{n}', (n.arg % 4) + 1).replace('{el}', (Rules.ELEMENTS[n.arg % 7] || Rules.ELEMENTS[0]).name.toLowerCase());
}
function worldNotes() { return (ISL.notes[WORLD_NO[WD.id]] || []).slice(-25); }
function noteTarget() {
  let best = null, bd = 40;
  for (const n of worldNotes()) { const d = Math.hypot(player.x - n.x / 10 * TW, player.y - n.y / 10 * TW); if (d < bd) { bd = d; best = { kind: 'note', n, label: 'READ THE GHOST NOTE' }; } }
  return best;
}
function noteDrawables(camX, camY) {
  const t = performance.now() / 1000;
  return worldNotes().map(n => ({ base: n.y / 10 * TW, draw: () => {
    const x = n.x / 10 * TW - camX, y = n.y / 10 * TW - camY - 14 + Math.sin(t * 2 + n.id) * 3;
    const trust = n.truth - n.liar, col = trust > 0 ? '142,230,138' : trust < 0 ? '255,122,110' : '185,168,232';
    const g = ctx.createRadialGradient(x, y, 1, x, y, 18); g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(x - 6, y - 7, 12, 14); ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x - 4, y - 4, 8, 2); ctx.fillRect(x - 4, y, 6, 2);
  } }));
}
function readNote(n) {
  const mine = n.author === Backend.accountId, voted = (S.player.voted || []).includes(n.id);
  const who = { name: 'Ghost note from ' + shortName(n.author), color: '#b9a8e8' };
  const tally = `  (${n.truth} say true · ${n.liar} say liar)`;
  if (mine || voted) { say(who, `"${noteText(n)}"${tally}${mine ? ' This one is yours.' : ' You already voted.'}`); return; }
  say(who, `"${noteText(n)}"${tally} True, or a liar?`, [
    { t: 'TRUE', fn: () => voteNote(n, true) }, { t: 'LIAR!', fn: () => voteNote(n, false) }, { t: 'LEAVE', fn: closeDlg }]);
}
function voteNote(n, truth) {
  closeDlg(); if ((S.player.votes_today || 0) >= Rules.ISLAND.VOTES_A_DAY) { toast('You have voted enough for today.', 3); return; }
  queue({ t: 'VoteNote', id: n.id, truth }, 'vote', true);
  flush.after = () => { toast(truth ? `You backed ${shortName(n.author)}: they get 5 coins and +1 reputation.` : `You called ${shortName(n.author)} a liar: -1 reputation for them.`, 3.5); pollIsland(true); };
}
function noteComposer() {
  const L = Rules.ISLAND.NOTE_LINES, done = S.player.note_day === S.day;
  return `<div class="sub" style="margin:.4em 0;line-height:1.6">${done ? 'You left your ghost note for today. Come back tomorrow.' : `Leave one ghost note a day, right where you stand (${WD.id === 'town' ? 'Town' : WD.w.spec.name}). Others vote TRUE or LIAR: true votes pay you 5 coins each.`}</div>
    ${done ? '' : `<div class="nList">${L.map((l, i) => `<button class="btn nLine" data-l="${i}">${l.t.replace(/\{\w+\}/, '…')}</button>`).join('')}</div>
    <div id="nArg" class="sBtns"></div>`}`;
}
function bindComposer(el) {
  el.querySelectorAll('.nLine').forEach(b => b.onclick = () => {
    const i = +b.dataset.l, L = Rules.ISLAND.NOTE_LINES[i];
    const post = arg => { queue({ t: 'LeaveNote', world: WORLD_NO[WD.id], x: Math.round(player.x / TW * 10), y: Math.round(player.y / TW * 10), line: i, arg }, 'ghost note', true); flush.after = () => { sfx('success'); toast('Your ghost note floats here now. Let the island decide.', 3.5); pollIsland(true); openIsland('notes'); }; };
    if (!L.arg) { post(0); return; }
    const opts = L.arg === 'good' ? GOODS.map((g, k) => [k, g.name]).filter(([k]) => k !== 3 && k < 12) : L.arg === 'n' ? [[0, '1'], [1, '2'], [2, '3'], [3, '4']] : Rules.ELEMENTS.map((e, k) => [k, e.name]);
    $('nArg').innerHTML = `<span class="sub">${L.t.replace(/\{\w+\}/, '___')}</span>` + opts.map(([k, n]) => `<button class="btn" data-a="${k}">${n.toUpperCase()}</button>`).join('');
    $('nArg').querySelectorAll('[data-a]').forEach(x => x.onclick = () => post(+x.dataset.a));
  });
}

// ---------- the world boss ----------
function bossUp() { const b = ISL.boss; return b && b.hp > 0 && Date.now() < b.ends; }
function bossBanner() {
  const el = $('bossBar'); if (!el) return;
  const b = ISL.boss;
  if (!bossUp() && !(b && b.killed_by && b.hitters.includes(Backend.accountId) && S.player.boss_claimed !== b.id)) { el.classList.remove('on'); return; }
  const sp = Rules.SPECIES[b.species];
  el.innerHTML = bossUp() ? `⚠ WORLD BOSS · ${sp.name.toUpperCase()} · <span class="bHp"><i style="width:${Math.max(0, 100 * b.hp / b.max)}%"></i></span> ${Math.max(0, b.hp)} / ${b.max} · PRESS I`
    : `✦ THE ${sp.name.toUpperCase()} FELL! CLAIM YOUR REWARD · PRESS I`;
  el.classList.add('on');
}
function bossHTML() {
  const b = ISL.boss, me = Backend.accountId;
  if (!b) return `<div class="isEmpty"><div class="gname">THE SKY IS CALM</div><div class="sub" style="line-height:1.7">World bosses are rare: a two-day window opens about once a month, decided on NEAR.<br>When one comes, everyone on the island shares one HP bar. Hit it with your companion (3 hits each), and everyone who fought gets 250 coins, a lantern shard and the Boss Slayer badge NFT.</div></div>`;
  const sp = Rules.SPECIES[b.species], up = bossUp(), hits = S.player.boss_seen === b.id ? S.player.boss_hits : 0, fought = b.hitters.includes(me);
  const left = Math.max(0, b.ends - Date.now()), hrs = Math.floor(left / 3600000), mins = Math.floor(left / 60000) % 60;
  return `<div class="bossBox"><div class="dSpr huge" data-sp="${sp.sprite}" data-dir="down" data-strip="${(BOSS_FORMS[sp.sprite] || [4])[0]}" style="background-image:url(assets/spirits/${sp.sprite}.png)"></div>
    <div class="gname" style="color:#ff7a6e">${sp.name.toUpperCase()}</div>
    <div class="bHp big"><i style="width:${Math.max(0, 100 * b.hp / b.max)}%"></i></div><div class="sub">${Math.max(0, b.hp)} / ${b.max} HP · ${b.hitters.length} fighters${up ? ` · leaves in ${hrs}h ${mins}m` : ''}</div>
    ${b.killed_by ? `<div class="gold" style="margin:.6em 0">${shortName(b.killed_by)} landed the final blow!</div>` : ''}
    <div class="sBtns" style="justify-content:center;margin-top:.8em">
      ${up ? `<button class="btn big gold" id="bHit" ${hits >= Rules.ISLAND.BOSS_HITS ? 'disabled' : ''}>${hits >= Rules.ISLAND.BOSS_HITS ? 'YOU HIT IT 3 TIMES' : `HIT IT WITH YOUR COMPANION (${Rules.ISLAND.BOSS_HITS - hits} LEFT · 15 ENERGY)`}</button>` : ''}
      ${b.killed_by && fought && S.player.boss_claimed !== b.id ? '<button class="btn big gold" id="bClaim">CLAIM: 250 COINS, A SHARD, THE BADGE</button>' : ''}
    </div><div class="sub" style="margin-top:.6em">Hits use your companion's attack. Strong elements hit 1.5×. ${Rules.ELEMENTS[sp.el].name} is weak to ${Rules.ELEMENTS.filter((e, i) => Rules.beats(i, sp.el)).map(e => e.name).join(' and ')}.</div></div>`;
}
function bossHit() {
  if (!S.player.lead) { toast('You need a companion spirit. Press B and pick one.', 3.5); return; }
  const hpBefore = ISL.boss.hp;
  queue({ t: 'BossHit' }, 'world boss', true); sfx('alert');
  const el = document.querySelector('#island .dSpr.huge'); if (el) { el.classList.add('hurt'); setTimeout(() => el.classList.remove('hurt'), 400); }
  flush.after = async () => { await pollIsland(true); if (ISL.boss) popupBoss(hpBefore - ISL.boss.hp); openIsland('boss'); };
}
function popupBoss(dmg) { if (dmg > 0) toast(`You hit it for ${dmg}!${ISL.boss.hp <= 0 ? ' IT FALLS!' : ''}`, 3); }

// ---------- curses and charms ----------
function curseHTML() {
  const me = Backend.accountId, seen = [...new Set([...ISL.feed.map(f => f.who), ...Object.values(ISL.notes).flat().map(n => n.author)])].filter(a => a !== me && a !== Backend.contractId).slice(-12).reverse();
  const done = S.player.curse_day === S.day;
  return `<div class="sub" style="margin:.4em 0;line-height:1.6">Charms: <b class="gold">${S.player.charms || 0} / 3</b> · each one blocks a curse aimed at you. <button class="btn" id="cBuy">BUY A CHARM (25)</button></div>
    <div class="sub" style="margin:.6em 0 .3em">CURSE SOMEONE · ${done ? 'you already cursed someone today' : 'one a day · 40 coins'}</div>
    ${seen.length ? `<div class="cList">${seen.map(a => `<div class="cRow"><span>${shortName(a)}</span><span>${Rules.ISLAND.CURSES.map((c, k) => `<button class="btn" ${done ? 'disabled' : ''} data-who="${a}" data-k="${k}" title="${c.text}">${c.name.toUpperCase()}</button>`).join('')}</span></div>`).join('')}</div>`
      : '<div class="sub">Nobody around yet. People show up here once they post on the island feed or leave notes.</div>'}
    <div class="sub" style="margin-top:.6em">${Rules.ISLAND.CURSES.map(c => `${c.name}: ${c.text}`).join(' · ')}</div>`;
}

// ---------- the panel (I) ----------
async function openIsland(tab) {
  if (tab) ISL.tab = tab;
  if (!$('island').classList.contains('on')) { await pollIsland(true); }
  const el = $('island'), t = ISL.tab;
  const feed = ISL.feed.slice().reverse().map(f => `<div class="fRowI"><span class="sub">${ago(f.at)}</span> ${f.who === Backend.contractId ? `<b class="dn">⚠ ${f.text}</b>` : `<b class="${f.who === Backend.accountId ? 'gold' : 'cy'}">${f.who === Backend.accountId ? 'You' : shortName(f.who)}</b> ${shortText(f.text)}`}</div>`).join('') || '<div class="sub">Quiet so far. Catch something rare, beat a rival or pay the debt and the whole island hears about it.</div>';
  el.innerHTML = `<div class="gname">THE ISLAND</div><div class="sub">shared with every player on NEAR · rep ${S.player.rep || 0}</div>
    <div class="tabs">${[['feed', 'FEED'], ['boss', bossUp() ? '⚠ WORLD BOSS' : 'WORLD BOSS'], ['notes', 'GHOST NOTES'], ['curse', 'CURSES']].map(([k, n]) => `<button class="tab ${t === k ? 'on' : ''}" data-it="${k}">${n}</button>`).join('')}</div>
    <div class="isBody">${t === 'feed' ? `<div class="fList">${feed}</div>` : t === 'boss' ? bossHTML() : t === 'notes' ? noteComposer() : curseHTML()}</div>
    <div style="text-align:right;margin-top:.8em"><button class="btn big" id="iClose">CLOSE (I)</button></div>`;
  el.classList.add('on'); sfx('menu');
  el.querySelectorAll('[data-it]').forEach(b => b.onclick = () => openIsland(b.dataset.it));
  $('iClose').onclick = closeIsland;
  if ($('bHit')) $('bHit').onclick = bossHit;
  if ($('bClaim')) $('bClaim').onclick = () => { queue({ t: 'BossClaim' }, 'boss reward', true); flush.after = () => { sfx('success'); toast('Boss Slayer! +250 coins, a lantern shard and the badge NFT.', 5); pollIsland(true); openIsland('boss'); }; };
  if ($('cBuy')) $('cBuy').onclick = () => { queue({ t: 'BuyCharm' }, 'charm', true); flush.after = () => { sfx('coin'); openIsland('curse'); }; };
  el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { queue({ t: 'Curse', target: b.dataset.who, kind: +b.dataset.k }, 'curse', true); flush.after = () => { sfx('alert'); toast(`You cursed ${shortName(b.dataset.who)}. Unless they carry a charm...`, 4); pollIsland(true); openIsland('feed'); }; });
  if (t === 'notes') bindComposer(el);
  clearInterval(ISL.anim); ISL.anim = setInterval(() => { if (!el.classList.contains('on')) { clearInterval(ISL.anim); return; } const f = Math.floor(performance.now() / 150); el.querySelectorAll('.dSpr').forEach(s => { const w = s.clientWidth, n = +s.dataset.strip || 4; s.style.backgroundSize = `${n * w}px ${w}px`; s.style.backgroundPosition = `${-(f % n) * w}px 0`; }); }, 80);
}
function closeIsland() { $('island').classList.remove('on'); }
function ago(ms) { const s = Math.max(0, (Date.now() - ms) / 1000); return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; }
