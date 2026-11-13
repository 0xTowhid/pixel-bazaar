// The first season reveals the game a little at a time, so day 1 is just the core: farm, sell, catch spirits, trade on rumors.
// Returning players (season 2+) have everything from the start. This only hides things on screen; the contract is unchanged.

const UNLOCKS = [
  { id: 'worlds', day: 2, icon: 'f_Owl', title: 'THE GATES OPEN', text: 'The roads to the other worlds are open. The Whispering Woods are north of town.' },
  { id: 'fate', day: 2, icon: 'f_LanternRed', title: 'MADAME VEY', text: 'Madame Vey will read your three fate cards every day now.' },
  { id: 'crew', day: 2, icon: 'f_Flam', title: 'NIGHT CREW', text: 'Your spirits can work while you sleep. Press B, then NIGHT CREW.' },
  { id: 'duels', day: 3, icon: 'f_KappaGreen', title: 'SPIRIT DUELS', text: 'Challenge Mei to a 3 vs 3 spirit duel. Rita duels at the Moon Market at night.' },
  { id: 'calls', day: 3, icon: 'f_Eye2', title: 'CALLS AND CURSES', text: 'Post your own call on the Bazaar Board, and curse (or protect yourself from) other players.' },
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
