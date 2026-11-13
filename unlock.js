// The first season reveals the game a little at a time, so day 1 is just the core: farm, sell, catch spirits, trade on rumors.
// Returning players (season 2+) have everything from the start. This only hides things on screen; the contract is unchanged.

const UNLOCKS = [
  { id: 'worlds', day: 2, icon: 'f_Owl', title: 'THE GATES OPEN', text: 'The roads to the other worlds are open. The Whispering Woods are north of town.' },
  { id: 'fate', day: 2, icon: 'f_LanternRed', title: 'MADAME VEY', text: 'Madame Vey will read your three fate cards every day now.' },
  { id: 'crew', day: 2, icon: 'f_Flam', title: 'NIGHT CREW', text: 'Your spirits can work while you sleep. Press B, then NIGHT CREW.' },
  { id: 'duels', day: 3, icon: 'f_KappaGreen', title: 'SPIRIT DUELS', text: 'Challenge Mei to a 3 vs 3 spirit duel. Rita duels at the Moon Market at night.' },
  { id: 'calls', day: 3, icon: 'f_Eye2', title: 'CALLS AND CURSES', text: 'Post your own call on the Bazaar Board, and curse (or protect yourself from) other players.' },
  { id: 'market', day: 3, icon: 'f_GoldRacoon', title: 'THE PLAYER MARKET', text: 'Sell spirits and legendary fish to other players for coins, on the Bazaar Board. 5% of every sale is burned.' },
  { id: 'barons', day: 4, icon: 'f_Skull', title: 'THE BARON RACE', text: 'Each baron owns a stall. Out-trade one on their good this season and the stall NFT is yours. Peek at their sealed calls too.' },
];
function unlocked(id) {
  if (!S || !S.player) return true;
  const u = UNLOCKS.find(x => x.id === id);
  return !u || S.player.season > 1 || S.day >= u.day;
}
const unlockDay = id => (UNLOCKS.find(x => x.id === id) || {}).day || 1;

// at dawn: one small card with what opened today (first season only)
function showUnlocks() {
  if (!S || !S.player || S.player.season > 1) return;
  const today = UNLOCKS.filter(u => u.day === S.day);
  if (!today.length) return;
  const key = `pb_unl|${Backend.accountId}|${S.player.season}|${S.day}`;
  let seen = null; try { seen = localStorage.getItem(key); } catch (e) {}
  if (seen) return; try { localStorage.setItem(key, '1'); } catch (e) {}
  openCard(`<div class="ntitle">NEW TODAY</div>
    ${today.map(u => `<div class="uRow"><img src="assets/spirits/${u.icon}.png" alt=""><div><b class="gold">${u.title}</b><div class="sub">${u.text}</div></div></div>`).join('')}
    <div style="text-align:center;margin-top:.9em"><button class="btn big gold" id="cardBtn">LET'S GO</button></div>`, null, true);
}

// learn by doing: the first few times you walk up to something new, the prompt says what it is for
const TIPS = {
  wild: 'A wild spirit. Stop the bar in the green to catch it.',
  plot: 'Pick a seed (1-9) and plant it. Water it; it grows overnight.',
  plant: 'Water it each day. It grows while you sleep.', water: 'Water it each day. It grows while you sleep.',
  harvest: "Ready! Sell it at Tomo's or at a stall.",
  rock: "Mining uses energy. Ore sells at Tomo's.",
  fish: "Fishing uses energy. Fish sell at Bolt-9's stall.",
  stall: 'Sell this good here. Rumors say if it rises tomorrow.',
  npc: "Talk every day: rumors about tomorrow's prices. Some lie.",
  home: 'After 18:00, sleep to end the day.',
  board: 'What every player and trader is doing.',
  gate: 'Each world has its own spirits and a daily puzzle.',
};
const tipSeen = (() => { try { return JSON.parse(localStorage.getItem('pb_tips') || '{}'); } catch (e) { return {}; } })();
function tipFor(t) {
  if (!t || !TIPS[t.kind] || !S || !S.player || S.player.season > 1 || (tipSeen[t.kind] || 0) >= 2) return '';
  if (t.kind === 'gate' && !unlocked('worlds')) return '';
  return TIPS[t.kind];
}
function learnTip(t) { if (!t || !TIPS[t.kind]) return; tipSeen[t.kind] = (tipSeen[t.kind] || 0) + 1; try { localStorage.setItem('pb_tips', JSON.stringify(tipSeen)); } catch (e) {} }
