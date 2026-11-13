// v8: the player market (spirits and legendary fish for coins, 5% of every sale burned), the season's omen,
// and the island goal that every player works on together each week. All three live on NEAR.

const MKT = { list: [], stats: null, goals: null, sell: null, loaded: 0 };

async function loadMarket(force) {
  if (!force && performance.now() - MKT.loaded < 8000) return;
  MKT.loaded = performance.now();
  const [list, stats, goals] = await Promise.all([
    Backend.view('get_market', {}).catch(() => MKT.list), Backend.view('get_stats', {}).catch(() => MKT.stats), Backend.view('get_goal', {}).catch(() => MKT.goals)]);
  MKT.list = list || []; MKT.stats = stats; MKT.goals = goals;
}

// ---------- the market ----------
function itemInfo(item) {
  if (!item) return { img: '', name: 'GONE', sub: '' };
  if (item.type === 'Spirit') { const sp = Rules.SPECIES[item.species], e = Rules.ELEMENTS[sp.el];
    return { img: spiritFace(item.species), name: (item.shiny ? '✦ ' : '') + sp.name.toUpperCase(), sub: `LV ${Rules.spiritLevel(item.xp)} · <span style="color:${e.color}">${e.name}</span> · ${Rules.RARITY[sp.rar]}` }; }
  if (item.type === 'Fish') return { img: `nft/fish/${item.kind}.png`, name: Rules.LEGENDS[item.kind].name.toUpperCase(), sub: 'LEGENDARY FISH · one of a kind' };
  return { img: '', name: '?', sub: '' };
}
function marketHTML() {
  const me = Backend.accountId, st = MKT.stats;
  const mine = MKT.list.filter(l => l.seller === me), others = MKT.list.filter(l => l.seller !== me).reverse();
  const row = l => { const i = itemInfo(l.item), own = l.seller === me;
    return `<div class="mRow"><img src="${i.img}" alt=""><div style="flex:1;min-width:0"><b>${i.name}</b><div class="sub">${i.sub}</div><div class="sub">${own ? 'your listing' : 'from ' + shortName(l.seller)} · ${ago(l.at)}</div></div>
      <b class="gold">${fmt(l.price)}</b> ${own ? `<button class="btn" data-unlist="${l.id}">TAKE BACK</button>` : `<button class="btn gold" data-buy="${l.id}" ${S.coins < l.price ? 'disabled' : ''}>BUY</button>`}</div>`; };
  if (MKT.sell) return sellForm();
  return `<div class="sub" style="margin:.3em 0 .6em;line-height:1.6">Players sell spirits and legendary fish to each other for coins. <b class="gold">${Rules.MARKET.FEE}% of every sale is burned</b>${st ? ` · ${fmt(Number(st.burned) / 100)} coins burned so far · ${st.sales} sales` : ''}.</div>
    <div class="sBtns"><button class="btn big gold" id="mSell">SELL SOMETHING</button></div>
    ${mine.length ? `<div class="gold bH" style="margin-top:.7em">YOUR LISTINGS · ${mine.length}/${Rules.MARKET.EACH}</div><div class="cList">${mine.map(row).join('')}</div>` : ''}
    <div class="gold bH" style="margin-top:.7em">FOR SALE</div>
    <div class="cList">${others.map(row).join('') || '<div class="sub">Nothing for sale yet. Be the first: list a spirit you have two of.</div>'}</div>`;
}
function sellForm() {
  const crew = S.player.crew || [], lead = S.player.lead;
  const spirits = (S.spirits || []).slice().sort((a, b) => b.level - a.level);
  const pick = MKT.sell.token;
  const opts = spirits.map(s => { const e = Rules.ELEMENTS[Rules.SPECIES[s.species].el];
    return `<button class="chipBtn ${pick === s.token_id ? 'on' : ''}" data-pick="${s.token_id}" style="border-color:${e.color}"><img src="${spiritFace(s.species)}" alt=""> ${s.shiny ? '✦ ' : ''}${s.name} · LV ${s.level}${s.token_id === lead ? ' · companion' : crew.includes(s.token_id) ? ' · crew' : ''}</button>`; }).join('');
  const fish = (MKT.sell.fish || []).map(f => `<button class="chipBtn ${pick === f.token_id ? 'on' : ''}" data-pick="${f.token_id}"><img src="${nftImg(f)}" alt=""> ${esc(f.metadata.title.replace(/^Legendary fish: /, ''))}</button>`).join('');
  const sel = spirits.find(s => s.token_id === pick);
  return `<div class="sub" style="margin:.3em 0 .6em">Pick what to sell, then set a price in coins. The market holds it until someone buys it, or you take it back.</div>
    <div class="chipRow" style="display:flex;flex-wrap:wrap;gap:.4em">${opts || '<span class="sub">You have no spirits yet.</span>'}${fish}</div>
    ${sel && (sel.token_id === lead || crew.includes(sel.token_id)) ? `<div class="sub dn" style="margin-top:.4em">Listing it takes it off ${sel.token_id === lead ? 'your side' : 'the night crew'}.</div>` : ''}
    <div class="wForm" style="margin-top:.8em;max-width:22em"><label>PRICE (COINS)<input id="mPrice" type="number" min="1" max="${Rules.MARKET.PRICE_MAX}" step="1" value="${MKT.sell.price || ''}" placeholder="150"></label>
    <div class="sub" id="mNet">${MKT.sell.price ? `You get ${fmt(Math.floor(MKT.sell.price * (100 - Rules.MARKET.FEE)) / 100)} · ${fmt(MKT.sell.price * Rules.MARKET.FEE / 100)} is burned` : `You get ${100 - Rules.MARKET.FEE}% · ${Rules.MARKET.FEE}% is burned`}</div></div>
    <div class="sBtns" style="margin-top:.8em"><button class="btn big" id="mBack">BACK</button><button class="btn big gold" id="mList" ${pick ? '' : 'disabled'}>LIST IT</button></div>`;
}
function bindMarket(el) {
  if ($('mSell')) $('mSell').onclick = async () => {
    MKT.sell = { token: null, price: 0, fish: [] }; openIsland('market');
    try { MKT.sell.fish = (await Backend.nfts()).filter(n => (n.metadata.title || '').startsWith('Legendary fish')); if (MKT.sell) openIsland('market'); } catch (e) {}
  };
  if ($('mBack')) $('mBack').onclick = () => { MKT.sell = null; openIsland('market'); };
  el.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { MKT.sell.token = b.dataset.pick; sfx('ok'); openIsland('market'); });
  if ($('mPrice')) {
    $('mPrice').onkeydown = e => e.stopPropagation();
    $('mPrice').oninput = () => { MKT.sell.price = Math.max(0, Math.floor(+$('mPrice').value || 0)); const p = MKT.sell.price;
      $('mNet').textContent = p ? `You get ${fmt(Math.floor(p * (100 - Rules.MARKET.FEE)) / 100)} · ${fmt(p * Rules.MARKET.FEE / 100)} is burned` : ''; };
  }
  if ($('mList')) $('mList').onclick = () => {
    const price = MKT.sell.price, token = MKT.sell.token;
    if (!(price >= 1 && price <= Rules.MARKET.PRICE_MAX)) { toast('Set a price from 1 to 100,000 coins.', 3); return; }
    queue({ t: 'List', token, price }, 'market list', true);
    flush.after = async () => { MKT.sell = null; await loadMarket(true); if (MKT.list.some(l => l.token === token)) { sfx('coin'); toast('Listed on the market. You get paid the moment someone buys it.', 4); } openIsland('market'); };
  };
  el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const id = +b.dataset.buy, l = MKT.list.find(x => x.id === id), name = itemInfo(l && l.item).name;
    queue({ t: 'Buy', id }, 'market buy', true);
    flush.after = async () => { await loadMarket(true); if (!MKT.list.some(x => x.id === id)) { sfx('success'); toast(`Bought ${name}! ${l && l.item && l.item.type === 'Spirit' ? 'Press B to see it.' : 'It is in your wallet.'}`, 4); } openIsland('market'); };
  });
  el.querySelectorAll('[data-unlist]').forEach(b => b.onclick = () => {
    queue({ t: 'Unlist', id: +b.dataset.unlist }, 'market unlist', true);
    flush.after = async () => { await loadMarket(true); toast('Taken back. It is yours again.', 3); openIsland('market'); };
  });
}

// ---------- the island goal ----------
function goalState() {
  const g = MKT.goals, p = S.player; if (!g || !p) return null;
  const now = g.now, mineNow = p.goal_week === now.week ? p.goal_part : 0, need = Rules.GOALS[now.kind].part;
  const can = x => x && x.progress >= x.target && p.goal_week === x.week && p.goal_part >= Rules.GOALS[x.kind].part && p.goal_claimed !== x.week;
  return { now, mine: mineNow, need, claim: can(now) || can(g.last), last: g.last };
}
function goalHTML() {
  const s = goalState(); if (!s) return '<div class="sub">The island goal is loading...</div>';
  const g = s.now, G = Rules.GOALS[g.kind], pct = Math.min(100, 100 * g.progress / g.target), days = Math.max(0, Math.ceil(((g.week + 1) * 7 * 86400000 - Date.now()) / 86400000));
  return `<div class="goalBox"><div class="sub">THIS WEEK, EVERY PLAYER TOGETHER</div><div class="gname" style="margin:.2em 0">${G.name.toUpperCase()}</div>
    <div class="bHp big gGoal"><i style="width:${pct}%"></i></div>
    <div class="sub">${fmt(g.progress)} / ${fmt(g.target)} · ${g.helpers} player${g.helpers === 1 ? '' : 's'} helping · ${days} day${days === 1 ? '' : 's'} left</div>
    <div style="margin:.8em 0;line-height:1.6">Your part: <b class="gold">${Math.min(s.mine, s.need)} / ${s.need}</b>${s.mine >= s.need ? ' ✓' : ''}<br><span class="sub">Do your part and, once the island reaches the goal, everyone who helped gets <b class="gold">${Rules.GOAL_REWARD} coins</b>.</span></div>
    ${s.claim ? `<button class="btn big gold" id="gClaim">CLAIM ${Rules.GOAL_REWARD} COINS</button>` : ''}
    ${s.last ? `<div class="sub" style="margin-top:.8em">Last week: ${Rules.GOALS[s.last.kind].name} · ${fmt(s.last.progress)} / ${fmt(s.last.target)} ${s.last.progress >= s.last.target ? '<span class="up">REACHED</span>' : '<span class="dn">missed</span>'}</div>` : ''}</div>`;
}
function bindGoal() {
  if ($('gClaim')) $('gClaim').onclick = () => { queue({ t: 'ClaimGoal' }, 'island goal', true); flush.after = async () => { sfx('success'); toast(`The island thanks you: +${Rules.GOAL_REWARD} coins.`, 4); await loadMarket(true); openIsland('goal'); }; };
}
function goalNote() {
  const s = goalState(); if (!s) return '';
  return `<div class="qNote ${s.mine >= s.need ? 'done' : ''}"><div class="sub2"><span>ISLAND GOAL</span><span>${Math.min(s.mine, s.need)} / ${s.need}</span></div><div class="qT">${Rules.GOALS[s.now.kind].name} with everyone: ${fmt(s.now.progress)} / ${fmt(s.now.target)}</div><div class="qR">reward: ${Rules.GOAL_REWARD} coins when the island gets there${s.claim ? ' · <b class="gold">READY: claim on the Board (I)</b>' : ''}</div></div>`;
}

// ---------- the season's omen ----------
function omenNote() {
  const o = S.player && S.player.omen; if (o === null || o === undefined) return '';
  const O = Rules.OMENS[o];
  return `<div class="qNote done"><div class="sub2"><span>THIS SEASON'S OMEN</span><span></span></div><div class="qT">${O.name}</div><div class="qR">${O.text}</div></div>`;
}
function maybeOmen() {
  const p = S && S.player; if (!p || p.finished || p.season < 2 || (p.omen !== null && p.omen !== undefined) || !(p.omen_offer || []).length) return;
  if (uiOpen && uiOpen()) { setTimeout(maybeOmen, 2000); return; }
  openCard(`<div class="ntitle">THE OMENS OF SEASON ${p.season}</div>
    <div class="sub" style="text-align:center;margin-bottom:.8em">Madame Vey turns three cards. Pick one: it lasts the whole season. The Harbor Master wants <b class="gold">${fmt(DEBT)}</b> this time.</div>
    ${p.omen_offer.map(k => { const O = Rules.OMENS[k]; return `<button class="uRow omenPick" data-omen="${k}"><img src="assets/spirits/${O.icon}.png" alt=""><div><b class="gold">${O.name.toUpperCase()}</b><div class="sub">${O.text}</div></div></button>`; }).join('')}
    <div style="text-align:center;margin-top:.6em"><button class="btn" id="cardBtn">DECIDE LATER</button></div>`, null, true);
  document.querySelectorAll('[data-omen]').forEach(b => b.onclick = () => {
    const k = +b.dataset.omen; closeCard();
    queue({ t: 'PickOmen', omen: k }, 'omen', true);
    flush.after = () => { if (S.player.omen === k) { sfx('success'); toast(`${Rules.OMENS[k].name}: ${Rules.OMENS[k].text}`, 5); } };
  });
}
