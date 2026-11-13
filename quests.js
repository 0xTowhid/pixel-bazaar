// Madame Vey's fate cards, the daily quest board and the story chapters.
// The contract decides the cards and the quests (from the day's commitment) and checks every reward.

// The same roll the contract uses: sha256(commitment|account|what|n), first byte.
async function rollJS(commit, who, what, n) {
  const eng = Backend.mode === 'local' && Backend.localEngine();
  if (eng) return eng._roll(commit, who, what, n);
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${commit}|${who}|${what}|${n}`));
  return new Uint8Array(b)[0];
}
async function questSlots() {
  const c = S.player.commitment; if (!c) return null;
  if (S._qs && S._qs.c === c) return S._qs.v;
  const picked = [];
  for (let i = 0; picked.length < 3; i++) { const q = (await rollJS(c, Backend.accountId, 'quest', i)) % Rules.QUESTS.length; if (!picked.includes(q)) picked.push(q); }
  S._qs = { c, v: picked }; return picked;
}
const chapterDone = p => [null, p.book && p.sold > 0, p.clues & 1, p.clues & 2, p.clues & 4, p.boss_wins & 1][p.chapter];

// ---------- the goal line and the yellow arrow: always one clear next step ----------
const townGate = to => World.P.gates.find(g => g.to === to);
const leadEl = () => { const s = (S.spirits || []).find(x => x.token_id === S.player.lead); return s ? Rules.SPECIES[s.species].el : -1; };
function currentGoal() {
  if (!S || !S.player || S.night) return null;
  const p = S.player, inTown = WD.id === 'town', hour = 6 + S.t / DAY_SECONDS * 18;
  const exit = () => ({ x: WD.w.P.exit.x * TW, y: WD.w.P.exit.y * TW });
  const inTownAt = pt => inTown ? at(pt) : exit();          // a town spot: from another world, go back first
  const obj = (world, kind) => WD.id === world ? (o => o && at(o))(WD.w.objects.find(o => o.kind === kind)) : null;
  const goWorld = (world, kind, there, go) => WD.id === world ? { text: there, target: obj(world, kind) } : { text: go, target: inTown ? at(townGate(world)) : exit() };
  if (hour >= 18 && !p.asleep) return { text: inTown ? "It's late: go home and sleep (E on your door)" : "It's late: head back to town and sleep", target: inTownAt(World.P.homeDoor) };
  if (S.step <= 2) return { text: STEPS[S.step].text, target: inTown ? STEPS[S.step].target() : exit() };
  if (S.coins >= DEBT) return { text: 'You have 3,000! Pay the Harbor Master', target: inTownAt({ x: NPCS.master.x / TW, y: NPCS.master.y / TW }) };
  const ch = p.chapter, tag = ch <= 5 ? `CH.${ch} · ` : '';
  if (ch === 1) {
    if (!p.book) { const w = typeof wilds !== 'undefined' && wilds[0]; return { text: tag + 'Catch a spirit: walk up to a glowing wisp, press E', target: w ? { x: w.x, y: w.y } : null }; }
    return { text: tag + "Sell anything at Tomo's stall", target: inTownAt({ x: NPCS.tomo.x / TW, y: NPCS.tomo.y / TW }) };
  }
  if (ch === 2) return goWorld('woods', 'tablet', tag + 'Read the stone tablet, then light the braziers', tag + 'Go north to the Whispering Woods');
  if (ch === 3) {
    if (!ownsElement(1)) return { text: tag + 'Catch a WATER spirit (slimes and axolotls, around town)', target: null };
    return goWorld('shrine', 'tablet', tag + 'Read the tablet, then ring the bells', tag + 'Dive to the Sunken Shrine (east shore)');
  }
  if (ch === 4) {
    if (!ownsElement(2)) return { text: tag + 'Catch a WIND spirit (owls and moths, in the woods)', target: null };
    return goWorld('sky', 'tablet', tag + 'Read the tablet, then wind the gears', tag + 'Ride the wind to the Clockwork Sky (north-east)');
  }
  if (ch === 5) return goWorld('woods', 'gate', tag + 'Wake the Great Spirit at the old gate (north)', tag + 'Go to the old gate deep in the Whispering Woods');
  return { text: 'Reach 3,000 coins, then see the Harbor Master', target: null };
}

// ---------- after every sync: pay finished quests and move the story on ----------
let progressBusy = false;
async function checkProgress() {
  if (progressBusy || (typeof DUEL !== 'undefined' && DUEL.on) || !S || !S.player || !S.player.commitment || S.sleeping || Q.sending || Q.list.length) return;
  progressBusy = true;
  try {
    const p = S.player, slots = await questSlots();
    if (slots) slots.forEach((q, slot) => {
      const [ctr, target, coins, text] = Rules.QUESTS[q];
      if (!(p.quests_claimed & (1 << slot)) && p.daily[ctr] >= target && !checkProgress['q' + slot + p.day]) {
        checkProgress['q' + slot + p.day] = true;
        queue({ t: 'ClaimQuest', slot }, 'quest reward', true); sfx('coin');
        toast(`QUEST DONE · ${text} · +${coins} coins`, 3.5);
      }
    });
    if (p.chapter <= 5 && chapterDone(p) && !checkProgress['ch' + p.chapter]) {
      checkProgress['ch' + p.chapter] = true;
      const ch = Rules.CHAPTERS[p.chapter - 1], next = Rules.CHAPTERS[p.chapter];
      queue({ t: 'AdvanceStory' }, 'story', true);
      flush.after = () => {
        sfx('success');
        openCard(`<div class="ntitle">CHAPTER ${ch.n} COMPLETE · ${ch.title.toUpperCase()}</div>
          ${next ? `<div style="text-align:center;line-height:1.7;margin:.6em 0">Reward: +1 lantern shard and +${next.n === 5 ? 200 : 100} coins.</div>
          <div class="chNext"><div class="sub">CHAPTER ${next.n}</div><div class="gold" style="font-size:1.25em;margin:.3em 0">${next.title.toUpperCase()}</div><div style="line-height:1.6">${next.story}</div><div class="sub" style="margin-top:.6em">GOAL: ${next.goal}</div></div>`
          : `<div style="text-align:center;line-height:1.7;margin:.8em 0">The flame is back in the Great Lantern. The spirits calm down.<br>The <b class="gold">JADE DRAGON</b> joins you as an NFT, and you earn the Lantern Keeper badge.</div>`}
          <div style="text-align:center;margin-top:1em"><button class="btn big gold" id="cardBtn">ONWARD</button></div>`, null, true);
      };
    }
  } finally { progressBusy = false; }
}

// ---------- Madame Vey ----------
async function readFate() {
  if (S.player.fate_day !== S.day) {
    queue({ t: 'DrawFate' }, 'fate cards', true);
    await new Promise(res => { flush.after = () => res(); });
    if (S.player.fate_day !== S.day) return;
    showFate(true);
  } else showFate(false);
}
function showFate(fresh) {
  const f = S.player.fate, kinds = [['BLESSING', '#8ee68a'], ['CURSE', '#ff7a6e'], ['SECRET', '#b9a8e8']];
  const sign = ['THE FLAME', 'THE TIDE', 'THE GALE', 'THE STONE', 'THE GROVE', 'THE LANTERN', 'THE SHADOW'][Backend.accountId.length % 7];
  const card = (k, i) => {
    const c = Rules.FATE[k][f[k]], [kind, col] = kinds[k];
    let text = c.text;
    if (k === 2 && f[2] === 2 && S.rumors && S.rumors.rita) text += S.rumors.rita.lying ? ' Today: she LIES.' : ' Today: she tells the truth.';
    return `<div class="fCard ${fresh ? 'flip' : ''}" style="--col:${col};animation-delay:${i * .35}s"><div class="fBack"></div><div class="fFront">
      <div class="fKind" style="color:${col}">${kind}</div><img src="assets/spirits/f_${c.icon}.png" alt=""><div class="fName">${c.name.toUpperCase()}</div><div class="fText">${text}</div></div></div>`;
  };
  const el = $('fate');
  el.innerHTML = `<div class="gname">MADAME VEY READS YOUR FATE</div><div class="sub">DAY ${S.day} · YOUR SIGN: <span class="cy">${sign}</span> · the cards come from today's commitment on NEAR</div>
    <div class="fRow">${[0, 1, 2].map(card).join('')}</div>
    <div class="sub" style="text-align:center">"The cards do not lie, dear. Only people do." · they last until you sleep</div>
    <div style="text-align:center;margin-top:.8em"><button class="btn big" id="fClose">THANK YOU</button></div>`;
  el.classList.add('on'); sfx(fresh ? 'success' : 'menu');
  $('fClose').onclick = () => el.classList.remove('on');
}

// ---------- the board: story + quests ----------
async function openQuests() {
  const p = S.player, slots = await questSlots();
  const chapters = Rules.CHAPTERS.map(ch => {
    const state = p.chapter > ch.n ? 'done' : p.chapter === ch.n ? 'now' : 'locked';
    return `<div class="chRow ${state}"><div class="sub">CHAPTER ${ch.n}${state === 'now' ? ' · IN PROGRESS' : state === 'done' ? ' · DONE' : ''}</div>
      <div class="chT">${state === 'locked' ? '???' : ch.title.toUpperCase()}</div>
      <div class="sub">${state === 'locked' ? 'Finish the chapter before' : state === 'done' ? ch.story : ch.goal}</div></div>`;
  }).join('');
  const clues = [['woods', p.clues & 1], ['shrine', p.clues & 2], ['sky', p.clues & 4], ['the old gate', p.boss_wins & 1]];
  const quests = slots ? slots.map((q, slot) => {
    const [ctr, target, coins, text] = Rules.QUESTS[q], have = Math.min(target, p.daily[ctr]), claimed = p.quests_claimed & (1 << slot);
    return `<div class="qNote ${claimed ? 'done' : ''}"><div class="sub2"><span>DAILY</span><span>${claimed ? '✓ PAID' : have + ' / ' + target}</span></div><div class="qT">${text}</div><div class="qR">reward: ${coins} coins${p.lead ? ' + companion XP' : ''}</div></div>`;
  }).join('') : '<div class="sub">The board fills up once the day has started on NEAR.</div>';
  const el = $('quests');
  el.innerHTML = `<div class="qCols"><div class="qStory"><div class="gname">THE LANTERN MYSTERY</div><div class="sub" style="margin-bottom:.6em">who stole the Great Lantern?</div>${chapters}
      <div class="sub" style="margin-top:.6em">CLUES FOUND</div><div class="clueRow">${clues.map(([n, ok]) => `<span title="${n}">${ok ? '✦' : '?'}</span>`).join('')}</div></div>
    <div class="qBoard"><div class="gname" style="color:#ffd9a0">QUEST BOARD</div><div class="sub" style="color:#d9b88a;margin-bottom:.6em">new quests every morning · rewards pay out by themselves</div>${quests}
      <div class="qNote ghost"><div class="sub2"><span>ALWAYS</span><span></span></div><div class="qT">Pay the Harbor Master 3,000 coins</div><div class="qR">reward: freedom, badges, a new season</div></div></div></div>
    <div style="text-align:right;margin-top:.6em"><button class="btn big" id="qClose">CLOSE (Q)</button></div>`;
  el.classList.add('on'); sfx('menu');
  $('qClose').onclick = () => el.classList.remove('on');
}
