// The Night Log: every night of this season as NEAR settled it, so the night report is never gone.
// Opens from the Journal (J), the morning paper (LAST NIGHT) and the L key. The data is your player's history on chain.

const NL = { sel: null };

function nightLogs() { return ((S.player && S.player.history) || []).slice().sort((a, b) => b.day - a.day); }
// prices before a night: the night before it, or the season's opening prices
function pricesBefore(log) {
  const prev = (S.player.history || []).find(h => h.day === log.day - 1);
  return prev ? prev.prices : GOODS.map(g => g.base * 1000); // milli-coins, like the contract
}
const tradeSum = log => (log.results || []).reduce((a, r) => a + r.pnl, 0) / 100;
const pctTxt = c => (c > 0 ? '+' : c < 0 ? '−' : '') + Math.abs(c) + '%';
const signed = v => v > 0 ? `<span class="up">+${fmt(v)}</span>` : v < 0 ? `<span class="dn">−${fmt(-v)}</span>` : '<span class="sub">±0</span>';

const WHY = {
  storm: 'A storm hit the sea and no boats went out, so fish was scarce', catch: 'The boats found a giant school of fish, so fish was cheap',
  ships: 'Three tea ships docked at dawn and flooded the market with tea', blight: 'Blight spread on the tea hills, so tea was scarce',
  bees: 'The hives overflowed and honey flooded the market', cold: 'A cold snap came down from the peaks and everyone wanted honey',
  fest: 'The lantern festival came early: sushi and pumpkin lanterns sold out', fair: 'The harvest fair came to town and paid a fortune for pumpkins and corn',
  berries: 'Every farm picked strawberries at once, so they were cheap', cooks: 'A big inn opened and its cooks bought up vegetables',
};
function nightWhy(log) {
  const ev = EVENTS[log.event];
  const moved = ev.fx.map(([g, m]) => `<b class="${m > 1 ? 'up' : 'dn'}">${GOODS[g].name.toLowerCase()} ${pctTxt(Math.round((m - 1) * 100))}</b>`).join(', ');
  return `${WHY[ev.id] || ev.title}: ${moved}. ${ev.farm ? ev.farm + ' ' : ''}Every other good only drifted a little back toward its usual price.`;
}
function openNightLog(day) {
  const logs = nightLogs(), el = $('nightlog');
  if (!logs.length) { toast('No nights yet this season. Sleep after 18:00 and the first one shows up here.', 3.5); return; }
  NL.sel = day || (logs.find(l => l.day === NL.sel) ? NL.sel : logs[0].day);
  const log = logs.find(l => l.day === NL.sel) || logs[0], ev = EVENTS[log.event];
  const before = pricesBefore(log), evGoods = ev.fx.map(f => f[0]);
  const list = logs.map(l => { const e = EVENTS[l.event], t = tradeSum(l), m = e.fx[0];
    return `<button class="nlIt ${l.day === log.day ? 'on' : ''}" data-nl="${l.day}"><b>NIGHT ${l.day} · ${e.title.toUpperCase()}</b>
      <span class="sub2"><span>${GOODS[m[0]].name.toLowerCase()} ${pctTxt(Math.round((m[1] - 1) * 100))}</span><span>${l.results.length ? signed(t) : '<span class="sub">no trades</span>'}</span></span></button>`; }).join('');
  // the goods the event moved first, then the biggest drifts
  const rows = GOODS.map((g, i) => ({ g, i, a: before[i] / 1000, b: log.prices[i] / 1000, ev: evGoods.includes(i) }))
    .filter(r => r.g.id !== 'ore').map(r => ({ ...r, c: Math.round((r.b / r.a - 1) * 100) }))
    .sort((x, y) => (y.ev - x.ev) || Math.abs(y.c) - Math.abs(x.c));
  const shown = rows.slice(0, 6);
  const prices = shown.map(r => `<tr><td><img src="${goodIcon(r.i)}" alt=""> ${r.g.name}${r.ev ? ' <span class="nlTag">EVENT</span>' : ''}</td><td>${fmt(r.a)} → ${fmt(r.b)}</td><td class="${r.c > 0 ? 'up' : r.c < 0 ? 'dn' : ''}">${pctTxt(r.c)}</td></tr>`).join('')
    + (rows.length > shown.length ? `<tr><td colspan="3" class="sub">+ ${rows.length - shown.length} more goods · drift only</td></tr>` : '');
  const trades = log.results.length ? log.results.map(r => { const v = r.pnl / 100, even = !r.liquidated && Math.round(v) === 0;
      return `<div class="pos ${r.liquidated ? 'liq' : even ? 'even' : v > 0 ? 'win' : 'loss'}"><span>${r.long ? 'LONG' : 'SHORT'} ${GOODS[r.good].name.toUpperCase()} x${r.lev} · ${fmt(r.stake / 100)}${even ? ' · not moved' : r.liquidated ? ' · LIQUIDATED' : ''}</span><b>${r.liquidated ? '−' + fmt(r.stake / 100) : even ? '±0' : (v > 0 ? '+' : '−') + fmt(Math.abs(v))}</b></div>`; }).join('')
    + `<div class="sub" style="margin-top:.4em">Trades that night: ${signed(tradeSum(log))} · coins at dawn <b class="gold">${fmt(log.coins_after / 100)}</b></div>`
    : '<div class="sub">You had no open trades that night.</div>';
  let rum = {}; try { rum = Rules.decodeRumors(log.rumors || ''); } catch (e) {}
  const who = Object.keys(rum).filter(k => SOURCES[k]).map(k => { const ok = Rules.rumorRight(k, rum[k], log.event);
    return `<div><span style="color:${SOURCES[k].color}">${SOURCES[k].name}</span>: <span class="${ok ? 'up' : 'dn'}">${ok ? 'right' : 'wrong'}</span>${!ok && k === 'rita' ? ' <span class="sub">(she was lying)</span>' : ''}</div>`; }).join('') || '<div class="sub">No rumors that day.</div>';
  const other = [];
  (log.npc || []).forEach(n => { const a = Rules.AGENTS[n.agent]; if (a) other.push(`${a.name}: ${n.long ? 'long' : 'short'} ${GOODS[n.good].name.toLowerCase()} · ${signed(n.pnl / 100)}`); });
  (log.crew || []).forEach(h => { const got = h.goods.map(g => `${g.qty} ${GOODS[g.good].name.toLowerCase()}`).concat(h.coins ? [`${h.coins} coins`] : [], h.shard ? ['a shard'] : [], h.charm ? ['a charm'] : []);
    other.push(`${Rules.SPECIES[h.species].name} (crew, ${Rules.CREW.JOBS[h.job].job.toLowerCase()}): ${got.length ? got.join(', ') : h.note === 3 ? 'stayed home, hungry' : 'nothing'}`); });
  if (log.call != null) other.push(`Your call: ${log.call ? '<span class="up">right</span>' : '<span class="dn">wrong</span>'}`);
  if (log.rent) other.push(`Stall rent: <span class="gold">+${fmt(log.rent / 100)}</span>`);
  if (log.passed_out_loss) other.push(`<span class="dn">You passed out in the street: −${fmt(log.passed_out_loss / 100)}</span>`);
  if (log.killed) other.push(`<span class="dn">${log.killed} crop${log.killed > 1 ? 's' : ''} died</span>`);
  el.innerHTML = `<div class="gname" style="text-align:center">NIGHT LOG <span class="sub">· every night of this season, as NEAR settled it</span></div>
    <div class="nlCols"><div class="nlList">${list}</div>
    <div class="nlDet">
      <div class="nlBox nlWhy"><img src="${goodIcon(ev.fx[0][0])}" alt=""><div><b class="gold">WHY PRICES MOVED: ${ev.title.toUpperCase()}</b><div class="nlTxt">${nightWhy(log)}</div></div></div>
      <div class="nlBox"><div class="nlH">PRICES</div><table class="nlTab">${prices}</table></div>
      <div class="nlBox"><div class="nlH">YOUR TRADES</div>${trades}</div>
      <div class="nlBox"><div class="nlH">WHO WAS RIGHT</div><div class="nlTxt nlWho">${who}</div></div>
      <div class="nlBox"><div class="nlH">BARONS · CREW · MORE</div><div class="nlTxt">${other.map(x => `<div>${x}</div>`).join('') || '<span class="sub">A quiet night.</span>'}</div></div>
    </div></div>
    <div style="text-align:right;margin-top:.5em"><button class="btn" id="nlClose">CLOSE (L)</button></div>`;
  el.querySelectorAll('[data-nl]').forEach(b => b.onclick = () => { sfx('ok'); openNightLog(+b.dataset.nl); });
  $('nlClose').onclick = closeNightLog;
  el.classList.add('on'); sfx('menu');
}
function closeNightLog() { $('nightlog').classList.remove('on'); }
