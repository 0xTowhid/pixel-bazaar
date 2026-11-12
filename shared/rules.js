// Game rules shared by the browser and the operator server.
// The contract (contract/src/lib.rs) and its JS mirror (shared/engine.js) hard-code the same numbers;
// if you change a number here, change it there too.
(function (root) {
  'use strict';
  // index = id used on chain
  const GOODS = [
    { id: 'tea', name: 'Tea', base: 20, icon: 'item:TeaLeaf' },
    { id: 'fish', name: 'Fish', base: 35, icon: 'item:Fish' },
    { id: 'honey', name: 'Honey', base: 50, icon: 'item:Honey' },
    { id: 'sushi', name: 'Sushi', base: 80, icon: 'item:Sushi' },
    { id: 'carrot', name: 'Carrot', base: 15, icon: 'crop:0' },
    { id: 'strawberry', name: 'Strawberry', base: 30, icon: 'crop:1' },
    { id: 'pumpkin', name: 'Pumpkin', base: 60, icon: 'crop:2' },
    { id: 'tomato', name: 'Tomato', base: 25, icon: 'crop:3' },
    { id: 'corn', name: 'Corn', base: 20, icon: 'crop:4' },
    { id: 'eggplant', name: 'Eggplant', base: 35, icon: 'crop:5' },
    { id: 'apple', name: 'Apple', base: 40, icon: 'icon:apple' },
    { id: 'jade', name: 'Jade', base: 120, icon: 'icon:jade' },
    { id: 'ore', name: 'Ore', base: 12, icon: 'icon:ore' },
  ];
  // seeds: what you plant. days = watered days to ripen; regrow = days between harvests for trees/hives.
  const CROPS = [
    { id: 'carrot', name: 'Carrot', good: 4, days: 2, cost: 6, yield: 2, row: 0 },
    { id: 'strawberry', name: 'Strawberry', good: 5, days: 3, cost: 10, yield: 3, row: 1 },
    { id: 'pumpkin', name: 'Pumpkin', good: 6, days: 4, cost: 22, yield: 2, row: 2 },
    { id: 'tomato', name: 'Tomato', good: 7, days: 3, cost: 8, yield: 3, row: 3 },
    { id: 'corn', name: 'Corn', good: 8, days: 2, cost: 6, yield: 2, row: 4 },
    { id: 'eggplant', name: 'Eggplant', good: 9, days: 3, cost: 12, yield: 2, row: 5 },
    { id: 'tea', name: 'Tea bush', good: 0, days: 2, cost: 5, yield: 3, row: 6 },
    { id: 'apple', name: 'Apple sapling', good: 10, days: 4, cost: 80, yield: 3, regrow: 2 },
    { id: 'hive', name: 'Beehive', good: 2, days: 2, cost: 60, yield: 2, regrow: 2, noWater: true },
  ];
  // Each event moves one or more goods. Order matters: the contract uses the same indexes.
  const EVENTS = [
    { id: 'storm', fx: [[1, 1.5]], title: 'Storm at sea', rumor: 'A storm is coming. No boats tomorrow, so fish will be scarce.', weather: 'rain', farm: 'Rain waters every crop for free.' },
    { id: 'catch', fx: [[1, 0.62]], title: 'Record catch', rumor: 'The boats found a giant school of fish. Fish will be cheap tomorrow.' },
    { id: 'ships', fx: [[0, 0.62]], title: 'Tea ships docked', rumor: 'Three tea ships are due at dawn. Tea will flood the market.' },
    { id: 'blight', fx: [[0, 1.5]], title: 'Tea blight', rumor: 'Blight is spreading on the tea hills. Tea will be scarce.', farm: 'Unripe tea bushes die.' },
    { id: 'bees', fx: [[2, 0.62]], title: 'Honey glut', rumor: 'The hives overflowed. Honey prices are about to crash.' },
    { id: 'cold', fx: [[2, 1.5]], title: 'Cold snap', rumor: 'A cold snap is coming down from the peaks. Everyone will want honey.', weather: 'snow', farm: 'Unripe strawberries and tomatoes freeze.' },
    { id: 'fest', fx: [[3, 1.5], [6, 1.3]], title: 'Lantern festival', rumor: 'The lantern festival was moved to tomorrow. Sushi and pumpkin lanterns will sell out.' },
    { id: 'fair', fx: [[6, 1.5], [8, 1.4]], title: 'Harvest fair', rumor: 'The harvest fair comes to town tomorrow. Pumpkins and corn will fetch a fortune.' },
    { id: 'berries', fx: [[5, 0.6]], title: 'Berry glut', rumor: 'Every farm picked strawberries at once. They will be cheap tomorrow.' },
    { id: 'cooks', fx: [[4, 1.45], [7, 1.45], [9, 1.3]], title: 'New inn opens', rumor: 'A big inn opens tomorrow and its cooks need vegetables. Carrots and tomatoes will be wanted.' },
  ];
  EVENTS.forEach(e => { e.good = GOODS[e.fx[0][0]].id; e.up = e.fx[0][1] > 1; e.m = e.fx[0][1]; });
  const SOURCES = {
    mei:    { name: 'Mei', sheet: 'mei', color: '#ff9fd0', kind: 'gossip', npc: 0, voice: ['I sit with the dockworkers every morning.', 'I only repeat what I hear twice.'] },
    bram:   { name: 'Bram', sheet: 'bram', color: '#9fd2ff', kind: 'gossip', npc: 1, voice: ['Heard it from a guy who heard it from a guy.', "Don't quote me, but..."] },
    rita:   { name: 'Rita', sheet: 'rita', color: '#ffb36b', kind: 'rita', acc: .3, npc: 2, voice: ['Trust me, I would never steer you wrong.', 'Only telling you because I like you.'] },
    sailor: { name: 'Old Sailor', sheet: 'sailor', color: '#8fe0ff', kind: 'expert', npc: 3, domain: ['storm', 'catch', 'ships'], acc: .85, quiet: 'The sea is calm. Nothing coming in or going out.' },
    farmer: { name: 'Farmer Ozu', sheet: 'farmer', color: '#b9f08a', kind: 'expert', npc: 4, domain: ['blight', 'bees', 'berries', 'fair'], acc: .85, quiet: 'Nothing unusual on the farms. Prices should hold.' },
    hermit: { name: 'Hermit', sheet: 'hermit', color: '#cfe8ff', kind: 'expert', npc: 5, domain: ['cold'], acc: .9, quiet: 'The wind from the peaks is mild. No cold coming.' },
    seer:   { name: 'Madame Vey', sheet: 'seer', color: '#d59bff', kind: 'seer', npc: 6, acc: .7, cost: 40 },
  };
  const NPC_IDS = ['mei', 'bram', 'rita', 'sailor', 'farmer', 'hermit', 'seer', 'tomo'];
  const ITEMS = { license_x5: 250, license_x10: 900, bridge: 600, boat: 300, stall: 1500, plot: 120 };
  const PROJECTS = [
    { id: 'pier', name: 'Rebuild the pier', need: { 1: 30, 11: 5 }, coins: 400, reward: 'Fishing catches double.' },
    { id: 'lighthouse', name: 'Fix the lighthouse', need: { 12: 10, 11: 8 }, coins: 0, reward: 'The paper warns you when a storm is coming.' },
    { id: 'teahouse', name: 'Open the tea house', need: { 0: 40 }, coins: 600, reward: 'Tea sells for 15% more.' },
  ];
  const BADGES = {
    first_harvest: 'First harvest', green_thumb: 'Harvested 50 crops', jade_hunter: 'Mined 5 jade', angler: 'Caught 10 fish',
    x10_survivor: 'Won a x10 trade', faded_rita: 'Faded Rita and won', beat_kaito: 'Beat Kaito this season', debt_free: 'Paid the debt',
    early_bird: 'Paid the debt by day 6', restorer: 'Finished a town project', best_friend: '5 hearts with a local',
  };
  const ENERGY = { max: 100, plant: 2, water: 1, harvest: 1, mine: 8, fish: 4 };
  const evIndex = id => EVENTS.findIndex(e => e.id === id);
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];

  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function seasonAccuracy(rng) { const a = rng() < .5 ? [.8, .55] : [.55, .8]; return { mei: a[0], bram: a[1] }; }
  function rumorFor(rng, k, truth, acc) {
    const s = SOURCES[k], T = EVENTS[truth], all = EVENTS.map((e, i) => i), others = () => all.filter(i => i !== truth);
    if (s.kind === 'gossip') return rng() < acc[k] ? { ev: truth } : { ev: pick(rng, others()) };
    if (s.kind === 'seer') return rng() < s.acc ? { ev: truth } : { ev: pick(rng, others()) };
    if (s.kind === 'rita') {
      if (rng() < s.acc) return { ev: truth };
      return { ev: pick(rng, all.filter(i => i !== truth && EVENTS[i].up)), lying: true };
    }
    const inDomain = s.domain.includes(T.id);
    if (inDomain) {
      if (rng() < s.acc) return { ev: truth };
      const alt = s.domain.filter(d => d !== T.id);
      return alt.length && rng() < .5 ? { ev: evIndex(pick(rng, alt)) } : { quiet: true };
    }
    return rng() < s.acc ? { quiet: true } : { ev: evIndex(pick(rng, s.domain)) };
  }
  /** Plan one day: the hidden event, every rumor (with how sure the source sounds), and Kaito's trade. */
  function planDay(rng, acc) {
    const truth = Math.floor(rng() * EVENTS.length);
    const rumors = {};
    for (const k of Object.keys(SOURCES)) {
      const r = rumorFor(rng, k, truth, acc);
      const right = rumorRight(k, r, truth);
      r.sure = right ? rng() < .75 : rng() < .3; // friends tell you how sure they are
      rumors[k] = r;
    }
    // Kaito the Whale reads the market right about two times in three
    const kev = rng() < .65 ? truth : Math.floor(rng() * EVENTS.length);
    const kaito = { good: EVENTS[kev].fx[0][0], long: EVENTS[kev].up };
    // the evening sky is a hint, not a certainty: rain or snow usually means storm or cold, but not always
    const w = rng();
    const weather = truth === 0 ? (w < .75 ? 'rain' : null) : truth === 5 ? (w < .75 ? 'snow' : null) : (w < .1 ? 'rain' : w < .18 ? 'snow' : null);
    return { truth, rumors, kaito, weather };
  }
  function encodeRumors(r) { return Object.keys(SOURCES).map(k => k + ':' + (r[k].quiet ? 'q' : r[k].ev + (r[k].lying ? '!' : '')) + (r[k].sure ? 's' : 'u')).join(','); }
  function decodeRumors(s) {
    const r = {};
    for (const part of s.split(',')) {
      const [k, v0] = part.split(':'); const sure = v0.endsWith('s'); const v = v0.slice(0, -1);
      r[k] = v === 'q' ? { quiet: true, sure } : { ev: parseInt(v, 10), lying: v.endsWith('!') || undefined, sure };
    }
    return r;
  }
  function rumorRight(k, r, truth) { return r.quiet ? !SOURCES[k].domain.includes(EVENTS[truth].id) : r.ev === truth; }
  const hearts = f => Math.min(5, Math.floor((f || 0) / 20));

  const Rules = { GOODS, CROPS, EVENTS, SOURCES, NPC_IDS, ITEMS, PROJECTS, BADGES, ENERGY, mulberry32, seasonAccuracy, planDay, encodeRumors, decodeRumors, rumorRight, evIndex, hearts };
  if (typeof module !== 'undefined' && module.exports) module.exports = Rules; else root.Rules = Rules;
})(typeof window !== 'undefined' ? window : globalThis);
