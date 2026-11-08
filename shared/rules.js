// Game rules shared by the browser and the operator server: goods, events, rumor sources and the daily plan.
(function (root) {
  'use strict';
  const GOODS = [
    { id: 'tea', name: 'Tea', base: 20, icon: 'TeaLeaf' },
    { id: 'fish', name: 'Fish', base: 35, icon: 'Fish' },
    { id: 'honey', name: 'Honey', base: 50, icon: 'Honey' },
    { id: 'sushi', name: 'Sushi', base: 80, icon: 'Sushi' },
  ];
  // Order matters: the contract uses the same indexes (EVENTS in contract/src/lib.rs).
  const EVENTS = [
    { id: 'storm', good: 'fish', m: 1.5, up: true, title: 'Storm at sea', rumor: 'A storm is coming. No boats tomorrow, so fish will be scarce.', weather: 'rain' },
    { id: 'catch', good: 'fish', m: 0.62, up: false, title: 'Record catch', rumor: 'The boats found a giant school of fish. Fish will be cheap tomorrow.' },
    { id: 'ships', good: 'tea', m: 0.62, up: false, title: 'Tea ships docked', rumor: 'Three tea ships are due at dawn. Tea will flood the market.' },
    { id: 'blight', good: 'tea', m: 1.5, up: true, title: 'Tea blight', rumor: 'Blight is spreading on the tea hills. Tea will be scarce.' },
    { id: 'bees', good: 'honey', m: 0.62, up: false, title: 'Honey glut', rumor: 'The hives overflowed. Honey prices are about to crash.' },
    { id: 'cold', good: 'honey', m: 1.5, up: true, title: 'Cold snap', rumor: 'A cold snap is coming down from the peaks. Everyone will want honey.', weather: 'snow' },
    { id: 'fest', good: 'sushi', m: 1.5, up: true, title: 'Lantern festival', rumor: 'The lantern festival was moved to tomorrow. Sushi will sell out.' },
  ];
  const SOURCES = {
    mei:    { name: 'Mei', sheet: 'mei', color: '#ff9fd0', kind: 'gossip', voice: ['I sit with the dockworkers every morning.', 'I only repeat what I hear twice.'] },
    bram:   { name: 'Bram', sheet: 'bram', color: '#9fd2ff', kind: 'gossip', voice: ['Heard it from a guy who heard it from a guy.', "Don't quote me, but..."] },
    rita:   { name: 'Rita', sheet: 'rita', color: '#ffb36b', kind: 'rita', acc: .3, voice: ['Trust me, I would never steer you wrong.', 'Only telling you because I like you.'] },
    sailor: { name: 'Old Sailor', sheet: 'sailor', color: '#8fe0ff', kind: 'expert', domain: ['storm', 'catch', 'ships'], acc: .85, quiet: 'The sea is calm. Nothing coming in or going out.' },
    farmer: { name: 'Farmer Ozu', sheet: 'farmer', color: '#b9f08a', kind: 'expert', domain: ['blight', 'bees'], acc: .85, quiet: 'Hills look fine. Tea and hives are normal.' },
    hermit: { name: 'Hermit', sheet: 'hermit', color: '#cfe8ff', kind: 'expert', domain: ['cold'], acc: .9, quiet: 'The wind from the peaks is mild. No cold coming.' },
    seer:   { name: 'Madame Vey', sheet: 'seer', color: '#d59bff', kind: 'seer', acc: .7, cost: 40 },
  };
  const ITEMS = { license_x5: 250, license_x10: 900, bridge: 600, boat: 300 };
  const evIndex = id => EVENTS.findIndex(e => e.id === id);
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];

  // Small seeded PRNG so the server can rebuild any day from a secret.
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // Which gossip is reliable is reshuffled each season.
  function seasonAccuracy(rng) { const a = rng() < .5 ? [.8, .55] : [.55, .8]; return { mei: a[0], bram: a[1] }; }

  function rumorFor(rng, k, truth, acc) {
    const s = SOURCES[k], T = EVENTS[truth], others = () => EVENTS.map((e, i) => i).filter(i => i !== truth);
    if (s.kind === 'gossip') return rng() < acc[k] ? { ev: truth } : { ev: pick(rng, others()) };
    if (s.kind === 'seer') return rng() < s.acc ? { ev: truth } : { ev: pick(rng, others()) };
    if (s.kind === 'rita') {
      if (rng() < s.acc) return { ev: truth };
      return { ev: pick(rng, EVENTS.map((e, i) => i).filter(i => i !== truth && EVENTS[i].up)), lying: true };
    }
    const inDomain = s.domain.includes(T.id);
    if (inDomain) {
      if (rng() < s.acc) return { ev: truth };
      const alt = s.domain.filter(d => d !== T.id);
      return alt.length && rng() < .5 ? { ev: evIndex(pick(rng, alt)) } : { quiet: true };
    }
    return rng() < s.acc ? { quiet: true } : { ev: evIndex(pick(rng, s.domain)) };
  }
  /** Plan one day: the hidden event and every source's rumor. */
  function planDay(rng, acc) {
    const truth = Math.floor(rng() * EVENTS.length);
    const rumors = {};
    for (const k of Object.keys(SOURCES)) rumors[k] = rumorFor(rng, k, truth, acc);
    return { truth, rumors };
  }
  // Compact text form, used in the on-chain commitment: "mei:3,bram:q,rita:5!,..."
  function encodeRumors(r) { return Object.keys(SOURCES).map(k => k + ':' + (r[k].quiet ? 'q' : r[k].ev + (r[k].lying ? '!' : ''))).join(','); }
  function decodeRumors(s) {
    const r = {};
    for (const part of s.split(',')) { const [k, v] = part.split(':'); r[k] = v === 'q' ? { quiet: true } : { ev: parseInt(v, 10), lying: v.endsWith('!') || undefined }; }
    return r;
  }
  /** Was a rumor right, given the real event? Quiet experts are right when nothing happened in their area. */
  function rumorRight(k, r, truth) { return r.quiet ? !SOURCES[k].domain.includes(EVENTS[truth].id) : r.ev === truth; }

  const Rules = { GOODS, EVENTS, SOURCES, ITEMS, mulberry32, seasonAccuracy, planDay, encodeRumors, decodeRumors, rumorRight, evIndex };
  if (typeof module !== 'undefined' && module.exports) module.exports = Rules; else root.Rules = Rules;
})(typeof window !== 'undefined' ? window : globalThis);
