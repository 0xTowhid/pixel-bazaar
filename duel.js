// Spirit duels: up to three of your spirits against a rival's team.
// The contract runs the whole fight from the day's commitment (no rerolls); the game runs the same function to show every hit.

const DUEL = { foe: 0, pick: [], on: false, timer: null };
const LINES = {
  win: ['"Not bad... not bad at all."', '"Darling, you got lucky. Tomorrow I win."', '"THE LANTERN... IS YOURS TO GUARD."'],
  lose: ['"Feed them more carrots and come back tomorrow!"', '"Every market has a loser, darling."', '"YOU ARE NOT READY, LITTLE KEEPER."'],
};

function spriteBox(sp, dir, big) {
  const s = Rules.SPECIES[sp], boss = BOSS_FORMS[s.sprite];
  return `<div class="dSpr ${big ? 'big' : ''}" data-sp="${s.sprite}" data-dir="${dir}" ${boss ? `data-strip="${boss[0]}"` : ''} style="background-image:url(assets/spirits/${s.sprite}.png)"></div>`;
}
// one timer moves every sprite on the duel screen
function animSprites() {
  const f = Math.floor(performance.now() / 160);
  document.querySelectorAll('#duel .dSpr').forEach(el => {
    const w = el.clientWidth, n = +el.dataset.strip;
    if (n) { el.style.backgroundSize = `${n * w}px ${w}px`; el.style.backgroundPosition = `${-(f % n) * w}px 0`; }
    else { el.style.backgroundSize = `${4 * w}px ${4 * w}px`; el.style.backgroundPosition = `${-DIRI[el.dataset.dir] * w}px ${-(f % 4) * w}px`; }
  });
}

function duelChoice(foe) {
  const f = Rules.FOES[foe], done = S.player.duel_day && S.player.duel_day[foe] === S.day;
  if (done) return { t: 'DUEL (DONE TODAY)', fn: () => { closeDlg(); toast(`${f.name} has had enough for today. Come back tomorrow.`, 3); } };
  return { t: foe === 2 ? 'WAKE THE GREAT SPIRIT' : 'SPIRIT DUEL', fn: () => { closeDlg(); openDuel(foe); } };
}

function openDuel(foe) {
  if (!(S.spirits || []).length) { toast('You need at least one spirit to duel. Catch one in the tall grass first.', 4); return; }
  DUEL.foe = foe; DUEL.pick = DUEL.pick.filter(t => S.spirits.find(s => s.token_id === t)).slice(0, 3);
  if (!DUEL.pick.length) DUEL.pick = [...S.spirits].sort((a, b) => b.level - a.level).slice(0, 3).map(s => s.token_id);
  DUEL.on = true; renderPicker(); $('duel').classList.add('on'); sfx('menu');
  clearInterval(DUEL.timer); DUEL.timer = setInterval(animSprites, 80);
  playMusic(foe === 2 ? 'boss' : 'fight');
}
function closeDuel() {
  $('duel').classList.remove('on'); DUEL.on = false; clearInterval(DUEL.timer);
  playMusic(WD.id === 'town' ? 'village' : WD.w.spec.music);
}

function effHint(mine, theirs) {
  let good = 0, bad = 0;
  for (const t of theirs) { if (Rules.beats(mine, Rules.SPECIES[t[0]].el)) good++; if (Rules.beats(Rules.SPECIES[t[0]].el, mine)) bad++; }
  return good > bad ? '<span class="up">STRONG HERE</span>' : bad > good ? '<span class="dn">WEAK HERE</span>' : '';
}

function renderPicker() {
  const f = Rules.FOES[DUEL.foe], el = $('duel');
  const foeCards = f.team.map(([sp, lv]) => {
    const st = Rules.fighter(sp, lv), e = Rules.ELEMENTS[st.el];
    return `<div class="dCard" style="border-color:${e.color}">${spriteBox(sp, 'down')}<b>${Rules.SPECIES[sp].name.toUpperCase()}</b><div class="sub">LV ${lv} · <span style="color:${e.color}">${e.name}</span></div><div class="sub">HP ${st.hp} · ATK ${st.atk} · SPD ${st.spd}</div></div>`;
  }).join('');
  const mine = [...S.spirits].sort((a, b) => b.level - a.level).map(s => {
    const st = Rules.fighter(s.species, s.level), e = Rules.ELEMENTS[st.el], k = DUEL.pick.indexOf(s.token_id);
    return `<div class="dCard pick ${k >= 0 ? 'on' : ''}" data-t="${s.token_id}" style="border-color:${e.color}">${k >= 0 ? `<i class="dNum">${k + 1}</i>` : ''}<img src="${spiritFace(s.species)}" alt="">
      <b>${s.shiny ? '✦ ' : ''}${s.name.toUpperCase()}</b><div class="sub">LV ${s.level} · <span style="color:${e.color}">${e.name}</span> ${effHint(st.el, f.team)}</div><div class="sub">HP ${st.hp} · ATK ${st.atk} · SPD ${st.spd}</div></div>`;
  }).join('');
  const tired = S.player.energy < Rules.DUEL_ENERGY;
  el.innerHTML = `<div class="dHead"><img src="assets/spirits/f_${f.face}.png" alt=""><div><div class="gname">${f.name.toUpperCase()} WANTS A DUEL</div><div class="sub">${f.line}</div></div></div>
    <div class="sub" style="margin:.6em 0 .3em">THEIR TEAM</div><div class="dRow">${foeCards}</div>
    <div class="sub" style="margin:.8em 0 .3em">YOUR TEAM · tap up to 3, in fighting order</div><div class="dGrid">${mine}</div>
    <div class="dWheel sub">ELEMENTS: FIRE › NATURE › WATER › FIRE · WIND › EARTH › FIRE · SPIRIT ⇄ DARK · strong hits do 1.5×</div>
    <div class="dBtns"><span class="sub">win: +${f.coins} coins${DUEL.foe === 2 ? ', a lantern shard, the Champion badge NFT and the last clue' : ''} · every fighter gains XP · ${Rules.DUEL_ENERGY} energy · one duel a day</span>
      <span><button class="btn big" id="dBack">LEAVE</button> <button class="btn big gold" id="dGo" ${DUEL.pick.length && !tired ? '' : 'disabled'}>${tired ? 'TOO TIRED' : 'FIGHT!'}</button></span></div>`;
  el.querySelectorAll('.dCard.pick').forEach(c => c.onclick = () => {
    const t = c.dataset.t, k = DUEL.pick.indexOf(t);
    if (k >= 0) DUEL.pick.splice(k, 1); else if (DUEL.pick.length < 3) DUEL.pick.push(t); else { DUEL.pick.shift(); DUEL.pick.push(t); }
    sfx('ok'); renderPicker();
  });
  $('dBack').onclick = closeDuel; $('dGo').onclick = fight;
  animSprites();
}

async function fight() {
  const foe = DUEL.foe, f = Rules.FOES[foe], team = DUEL.pick.map(t => S.spirits.find(s => s.token_id === t));
  const c = S.player.commitment; if (!c) { toast('The day has not started on NEAR yet.', 3); return; }
  // the same rolls the contract will use
  const rolls = await Promise.all([...Array(420).keys()].map(n => rollJS(c, Backend.accountId, 'duel' + foe, n)));
  let n = 0; const sim = Rules.duel(team.map(s => [s.species, s.level]), f.team, () => rolls[n++]);
  const coinsBefore = S.player.coins, winsBefore = S.player.duel_wins || 0;
  queue({ t: 'Duel', foe, team: DUEL.pick.slice() }, 'spirit duel', true);
  const chain = new Promise(res => { flush.after = () => res(); });
  await showFight(team, f, sim);
  await chain;
  const won = (S.player.duel_wins || 0) > winsBefore, ran = S.player.duel_day && S.player.duel_day[foe] === S.day;
  if (!ran) { closeDuel(); return; } // the transaction failed; the error toast already says why
  if (won !== sim.won) console.warn('duel: chain and preview differ');
  sfx(won ? 'success' : 'alert');
  $('dStage').insertAdjacentHTML('beforeend', `<div class="dEnd ${won ? 'win' : 'lose'}"><div class="gname">${won ? 'VICTORY!' : 'DEFEAT'}</div>
    <div>${(won ? LINES.win : LINES.lose)[foe]}</div>
    <div class="sub" style="margin:.6em 0">${won ? `+${Math.round((S.player.coins - coinsBefore) / 100)} coins · each fighter +20 XP${foe === 2 ? ' · +1 lantern shard · Champion badge NFT' : ''}` : 'each fighter +6 XP · try again tomorrow'}</div>
    <div class="sub">decided on NEAR from today's commitment, so nobody can reroll it</div>
    <button class="btn big gold" id="dDone">${won && foe === 2 ? 'THE LANTERN!' : 'OK'}</button></div>`);
  $('dDone').onclick = () => { closeDuel(); checkProgress(); };
}

function showFight(team, f, sim) {
  const el = $('duel');
  const side = (list, k) => list.map((x, i) => `<div class="dF" id="dF${k}${i}">${spriteBox(x[0], k ? 'left' : 'right', true)}<div class="dHp"><i style="width:100%"></i></div><div class="sub">${Rules.SPECIES[x[0]].name.toUpperCase()} · LV ${x[1]}</div></div>`).join('');
  const mine = team.map(s => [s.species, s.level]);
  el.innerHTML = `<div id="dStage"><div class="dSide">${side(mine, 0)}</div><div class="dVs">VS</div><div class="dSide foe">${side(f.team, 1)}</div><div id="dLog" class="sub"></div></div>`;
  const max = [mine.map(x => Rules.fighter(...x).hp), f.team.map(x => Rules.fighter(...x).hp)];
  const front = (k, i) => { document.querySelectorAll(`#dStage .dF[id^=dF${k}]`).forEach((d, j) => d.classList.toggle('front', j === i)); };
  front(0, 0); front(1, 0); animSprites();
  return new Promise(res => {
    let i = 0;
    const step = () => {
      if (i >= sim.log.length) { setTimeout(res, 500); return; }
      const h = sim.log[i++], atk = $(`dF${h.by}${h.from}`), def = $(`dF${1 - h.by}${h.to}`);
      front(h.by, h.from); front(1 - h.by, h.to);
      atk.classList.remove('hit'); void atk.offsetWidth; atk.classList.add(h.by ? 'lungeL' : 'lungeR');
      setTimeout(() => {
        atk.classList.remove('lungeL', 'lungeR');
        def.classList.add('hurt'); setTimeout(() => def.classList.remove('hurt'), 260);
        def.querySelector('.dHp i').style.width = (100 * h.left / max[1 - h.by][h.to]) + '%';
        def.insertAdjacentHTML('beforeend', `<span class="dDmg ${h.crit ? 'crit' : ''}">${h.dmg}${h.crit ? '!' : ''}</span>`);
        setTimeout(() => def.querySelector('.dDmg')?.remove(), 700);
        sfx(h.crit ? 'alert' : 'ok');
        const who = Rules.SPECIES[(h.by ? f.team : mine)[h.from][0]].name;
        $('dLog').textContent = `${h.by ? f.name + "'s " : ''}${who} hits for ${h.dmg}${h.eff > 0 ? ' · super effective!' : h.eff < 0 ? ' · not very effective' : ''}${h.crit ? ' · CRITICAL!' : ''}${h.ko ? ' · KNOCKED OUT' : ''}`;
        if (h.ko) def.classList.add('ko');
        setTimeout(step, h.ko ? 700 : 420);
      }, 220);
    };
    setTimeout(step, 600);
  });
}
