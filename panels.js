// Pixel Bazaar panels: the morning newspaper, selling, seeds, gifts, the town board and the share image.
'use strict';

// ---------- The Bazaar Bugle ----------
function showPaper(after) {
  const l = S.lastLog, ev = l ? EVENTS[l.event] : null;
  const prevPrices = S.closes ? null : null;
  const movers = GOODS.map((g, i) => ({ g, i, p: S.price[g.id], c: S.closes[g.id] && S.closes[g.id].length > 1 ? S.price[g.id] / S.closes[g.id][S.closes[g.id].length - 2] - 1 : 0 }))
    .filter(x => x.g.id !== 'ore').sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 6);
  const headline = ev ? ev.title.toUpperCase() + (l.results.some(r => r.liquidated) ? ' · YOU GOT LIQUIDATED' : '') : 'A NEW SEASON AT THE BAZAAR';
  const story = ev ? `${GOODS[ev.fx[0][0]].name} moved ${Math.round((ev.fx[0][1] - 1) * 100)}% on the news. ${ev.farm || ''}` : 'The Harbor Master wants 5,000 coins in ten days. Locals are already whispering.';
  const k = S.kaito, kn = k ? `Kaito went ${k.long ? 'LONG' : 'SHORT'} ${GOODS[k.good].name.toUpperCase()} x5 at dawn. Follow or fade?` : 'Kaito is counting his coins.';
  const letters = S.letters.map(key => {
    const r = S.rumors[key], s = SOURCES[key];
    return `<div class="letter"><b style="color:${s.color}">${s.name}</b> writes: "${r.quiet ? s.quiet : r.ev.rumor}"${r.sure ? ' (sure)' : ' (not sure)'}</div>`;
  }).join('');
  const proj = Rules.PROJECTS.map((pj, j) => S.player.projects[j] ? `${pj.name}: DONE` : `${pj.name}: ${projectPct(j)}% funded`).join(' · ');
  const seer = pick(['"Those who sail at dawn will curse or bless the clouds."', '"The loudest voice in the market is not the truest."', '"What grows slowly sells dearly."', '"Watch who sells while they shout buy."', '"The whale swims where the water is deep."']);
  openCard(`<div class="paper">
    <div class="pt">THE BAZAAR BUGLE</div>
    <div class="pm">DAY ${S.day} · ${SEASON_DAYS - S.day + 1} DAYS TO PAY THE HARBOR MASTER · ALL THE GOSSIP FIT TO PRINT</div>
    <div class="ph">${headline}</div><div class="pp">${story}</div>
    <div class="pcols"><div><div class="pk">WHALE WATCH</div><div class="pp">${kn}</div>
      ${S.stormWarning !== null ? `<div class="pk">LIGHTHOUSE</div><div class="pp">${S.stormWarning ? 'Storm clouds on the horizon. A storm hits tonight.' : 'Clear seas tonight. No storm.'}</div>` : ''}</div>
      <div><div class="pk">MARKET</div>${movers.map(m => `<div class="pr"><span><img src="${goodIcon(m.i)}">${m.g.name}</span><span>${fmt(m.p)} <span class="${m.c >= 0 ? 'pu' : 'pd'}">${m.c >= 0 ? '+' : ''}${Math.round(m.c * 100)}%</span></span></div>`).join('')}</div></div>
    ${letters ? `<div class="pk">LETTERS FROM FRIENDS</div>${letters}` : ''}
    <div class="pk">TOWN NEWS</div><div class="pp">${proj}</div>
    <div class="pk">THE SEER SAYS</div><div class="pp"><i>${seer}</i></div>
    <button class="btn big dark" id="cardBtn">START DAY ${S.day}</button></div>`, after);
}
function projectPct(j) {
  const [pj, d] = [Rules.PROJECTS[j], S.player.donated[j]];
  let need = pj.coins * 100, have = Math.min(d[GOODS.length], pj.coins * 100);
  for (const [g, n] of Object.entries(pj.need)) { need += n * 1000; have += Math.min(d[g], n) * 1000; }
  return need ? Math.floor(have / need * 100) : 100;
}

// ---------- selling the harvest ----------
function openSell() {
  hideToast();
  const rows = GOODS.map((g, i) => ({ g, i })).filter(x => x.g.id !== 'sushi');
  const has = rows.filter(x => S.barn[x.i] > 0);
  $('trade').innerHTML = `<div class="gname">SELL YOUR HARVEST</div>
    <div class="sub">Each sale nudges the price down 2%. Prices change every night, so time your sales with the rumors.</div>
    ${has.length ? has.map(({ g, i }) => `<div class="srow"><img src="${goodIcon(i)}"><span>${g.name}<br><span class="sub">you have ${S.barn[i]}</span></span><span>${fmt(S.price[g.id] * (g.id === 'tea' && S.player.projects[2] ? 1.15 : 1))}</span>
      <span><button class="btn" data-s="${i}" data-q="1">SELL 1</button><button class="btn" data-s="${i}" data-q="${S.barn[i]}">ALL</button></span></div>`).join('') : '<div class="sub" style="margin:1em 0">Your barn is empty. Harvest crops, mine or fish first.</div>'}
    <div class="tfoot"><span>Barn ${S.barn.reduce((a, b) => a + b, 0)}/40 · Coins ${fmt(S.coins)}</span><button class="link" id="tClose">CLOSE</button></div>`;
  $('trade').querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    const i = +b.dataset.s, q = Math.min(+b.dataset.q, S.barn[i]); if (!q) return;
    let got = 0; for (let n = 0; n < q; n++) { got += S.price[GOODS[i].id] * (i === 0 && S.player.projects[2] ? 1.15 : 1); S.price[GOODS[i].id] *= .98; }
    S.barn[i] -= q; S.coins += got; sfx('coin');
    queue({ t: 'Sell', good: i, qty: q }, 'sell ' + GOODS[i].name.toLowerCase());
    openSell();
  });
  $('tClose').onclick = closeTrade;
  $('trade').classList.add('on'); hud();
}

// ---------- seeds and land ----------
function openSeeds() {
  hideToast();
  $('trade').innerHTML = `<div class="gname">SEEDS</div>
    <div class="sub">Plant behind your house. Water every day; a crop only grows on days it was watered (rain counts).</div>
    ${Rules.CROPS.map((c, i) => `<div class="srow"><img src="${seedIcon(i)}"><span>${c.name}<br><span class="sub">${c.days} days · ${c.yield}x ${GOODS[c.good].name.toLowerCase()}${c.regrow ? ', then every ' + c.regrow + ' days' : ''}${c.noWater ? ' · no water' : ''}</span></span><span>${c.cost}</span>
      <span><button class="btn" data-b="${i}" data-q="1">BUY 1</button><button class="btn" data-b="${i}" data-q="5">x5</button></span></div>`).join('')}
    <div class="tfoot"><span>Coins ${fmt(S.coins)} · Plots ${S.player.plots.length}/18 (walk to the dashed plot to buy land)</span><button class="link" id="tClose">CLOSE</button></div>`;
  $('trade').querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const i = +b.dataset.b, q = +b.dataset.q, cost = Rules.CROPS[i].cost * q;
    if (S.coins < cost) { toast('Not enough coins.', 2); sfx('alert'); return; }
    S.coins -= cost; S.player.seeds[i] += q; S.seedSel = i; sfx('coin'); renderHotbar();
    queue({ t: 'BuySeed', crop: i, qty: q }, 'buy seeds');
    openSeeds();
  });
  $('tClose').onclick = closeTrade;
  $('trade').classList.add('on'); hud();
}

// ---------- gifts ----------
function giftMenu(k) {
  const npc = Rules.NPC_IDS.indexOf(k), name = (SOURCES[k] || { name: 'Tomo' }).name;
  if (S.player.gift_day[npc] === S.day) { say(NPCS[k], `"You already gave me something today. Thank you!"`); return; }
  const have = GOODS.map((g, i) => ({ g, i })).filter(x => S.barn[x.i] > 0);
  if (!have.length) { say(NPCS[k], `"That's sweet, but your hands are empty. Crops make the best gifts."`); return; }
  closeDlg();
  $('trade').innerHTML = `<div class="gname">GIFT FOR ${name.toUpperCase()}</div>
    <div class="sub">One gift a day. Home-grown crops count more than other goods.</div>
    <div class="inv big">${have.map(({ g, i }) => `<button class="btn" data-g="${i}"><img src="${goodIcon(i)}"> ${g.name} (${S.barn[i]})</button>`).join('')}</div>
    <div class="tfoot"><span>${heartsHTML(npcFriend(k))}</span><button class="link" id="tClose">CANCEL</button></div>`;
  $('trade').querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const i = +b.dataset.g, liked = i >= 4 && i <= 10 ? 15 : 10;
    S.barn[i]--; S.player.gift_day[npc] = S.day; S.player.friendship[npc] = Math.min(100, S.player.friendship[npc] + liked);
    queue({ t: 'Gift', npc, good: i }, 'gift to ' + name.toLowerCase());
    closeTrade(); sfx('success');
    say(NPCS[k], `"${pick(['Oh! For me? You are too kind.', 'This is wonderful, thank you!', 'You remembered! I love this.'])}"`);
    popup(NPCS[k].x, NPCS[k].y - 70, '♥ +' + liked, '#ff9fd0');
  });
  $('tClose').onclick = closeTrade;
  $('trade').classList.add('on');
}

// ---------- town board: restoration projects + records ----------
function openTown() {
  hideToast();
  const rows = Object.keys(SOURCES).filter(k => S.rec[k].tot).map(k => `${SOURCES[k].name} ${S.rec[k].ok}/${S.rec[k].tot}`).join(' · ') || 'No records yet.';
  $('trade').innerHTML = `<div class="gname">TOWN RESTORATION</div>
    <div class="sub">Donate goods and coins. Finished projects help you for good.</div>
    ${Rules.PROJECTS.map((pj, j) => {
      const d = S.player.donated[j], done = S.player.projects[j];
      const needs = Object.entries(pj.need).map(([g, n]) => `<img src="${goodIcon(+g)}">${Math.min(d[g], n)}/${n}`).join(' ') + (pj.coins ? ` · coins ${fmt(Math.min(d[GOODS.length], pj.coins * 100) / 100)}/${pj.coins}` : '');
      const cleft = Math.max(0, pj.coins - Math.floor(d[GOODS.length] / 100));
      return `<div class="proj"><div class="tr" style="border:0"><b>${pj.name}</b><span>${done ? '<span class="up">DONE</span>' : `<button class="btn" data-d="${j}" data-c="0">GIVE GOODS</button>${cleft ? ` <button class="btn" data-d="${j}" data-c="${Math.min(100, cleft)}">+${Math.min(100, cleft)} COINS</button>` : ''}`}</span></div>
        <div class="needs">${needs}</div><div class="bar"><div style="width:${done ? 100 : projectPct(j)}%"></div></div><div class="sub" style="color:#b9f08a">Reward: ${pj.reward}</div></div>`;
    }).join('')}
    <div class="jh">RUMOR RECORDS</div><div class="sub">${rows}</div>
    <div class="tfoot"><span>Coins ${fmt(S.coins)}</span><button class="link" id="tClose">CLOSE</button></div>`;
  $('trade').querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    const j = +b.dataset.d, c = +b.dataset.c;
    if (c > S.coins) { toast('Not enough coins.', 2); sfx('alert'); return; }
    queue({ t: 'Donate', project: j, coins: c }, 'donate to ' + Rules.PROJECTS[j].id, true);
    while (Q.list.length || Q.sending) await wait(120);
    if (S.player.projects[j]) { sfx('success'); toast(Rules.PROJECTS[j].name + ' is finished! ' + Rules.PROJECTS[j].reward, 4); } else sfx('coin');
    openTown();
  });
  $('tClose').onclick = closeTrade;
  $('trade').classList.add('on');
}

// ---------- share image ----------
function shareImage(won, score) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 675; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(MAP.ground, World.P.homeDoor.x * TW - 600, World.P.homeDoor.y * TW - 400, 1200, 675, 0, 0, 1200, 675);
  x.fillStyle = 'rgba(18,14,31,.78)'; x.fillRect(0, 0, 1200, 675);
  x.drawImage(IMG.player, 0, 128, 64, 64, 80, 220, 256, 256);
  x.fillStyle = '#ffd86b'; x.font = '56px Joy, monospace'; x.fillText('PIXEL BAZAAR', 380, 140);
  x.fillStyle = won ? '#8ee68a' : '#ff7a6e'; x.font = '34px Joy, monospace'; x.fillText(won ? 'DEBT PAID ON DAY ' + S.day : 'THE HARBOR MASTER WON', 380, 210);
  x.fillStyle = '#fff3d6'; x.font = '26px Joy, monospace';
  const lines = [`Fortune: ${fmt(score)} coins`, `Harvested: ${S.player.harvested} crops`, `Badges: ${[...S.items].filter(t => t.startsWith('badge_')).length} of ${Object.keys(Rules.BADGES).length}`, `Rita lied to me ${S.rec.rita.tot - S.rec.rita.ok} times`, Backend.accountId];
  lines.forEach((t, i) => x.fillText(t, 380, 280 + i * 52));
  x.fillStyle = '#a79cc9'; x.font = '20px Joy, monospace'; x.fillText('Farm by day. Trade on rumors by night. On NEAR. #NEARHackathon', 80, 630);
  c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pixel-bazaar-season.png'; document.body.appendChild(a); a.click(); a.remove(); toast('Saved pixel-bazaar-season.png', 2.5); });
}
