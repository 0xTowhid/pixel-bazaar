// JavaScript mirror of the NEAR contract (contract/src/lib.rs). Same units, same rules (night crews, sealed agent calls, baron stalls included).
// Used for the offline build in the browser and as a stand-in contract when testing the server.
(function (root) {
  'use strict';
  const START_COINS = 300 * 100, DEBT = 3000 * 100, SEASON_DAYS = 10, NG = 13;
  const GOODS = ['tea', 'fish', 'honey', 'sushi', 'carrot', 'strawberry', 'pumpkin', 'tomato', 'corn', 'eggplant', 'apple', 'jade', 'ore'];
  const BASE = [20000, 35000, 50000, 80000, 15000, 30000, 60000, 25000, 20000, 35000, 40000, 120000, 12000];
  const EVENTS = [[[1, 1500]], [[1, 620]], [[0, 620]], [[0, 1500]], [[2, 620]], [[2, 1500]], [[3, 1500], [6, 1300]], [[6, 1500], [8, 1400]], [[5, 600]], [[4, 1450], [7, 1450], [9, 1300]]];
  const EV_STORM = 0, EV_BLIGHT = 3, EV_COLD = 5;
  // good, days, seed cost, yield, regrow, needs water
  const CROPS = [[4, 2, 6, 2, 0, true], [5, 3, 10, 3, 0, true], [6, 4, 22, 2, 0, true], [7, 3, 8, 3, 0, true], [8, 2, 6, 2, 0, true], [9, 3, 12, 2, 0, true], [0, 2, 5, 3, 0, true], [10, 4, 80, 3, 2, true], [2, 2, 60, 2, 2, false]];
  const ITEMS = { license_x5: 250, license_x10: 900, bridge: 600, boat: 300, stall: 1500 };
  const PROJECTS = [[[[1, 30], [11, 5]], 400], [[[12, 10], [11, 8]], 0], [[[0, 40]], 600]];
  const BADGES = ['first_harvest', 'green_thumb', 'jade_hunter', 'angler', 'x10_survivor', 'faded_rita', 'beat_kaito', 'debt_free', 'early_bird', 'restorer', 'best_friend', 'first_spirit', 'spirit_tamer', 'shiny_hunter', 'legend_tamer', 'wallet_linked', 'lantern_seeker', 'lantern_keeper', 'spirit_champion', 'fishing_legend', 'island_oracle', 'boss_slayer', 'stall_owner', 'bazaar_keeper'];
  const PLOT_COST = 120, MAX_PLOTS = 18, START_PLOTS = 6, BARN_CAP = 40, NPCS = 8, ROCKS = 8, ENERGY_MAX = 100;

  const R = (typeof module !== 'undefined' && module.exports) ? require('./rules.js') : root.Rules;
  const SP = R.SPECIES, SPAWN = R.SPAWN, FIRE = 0, WATER = 1, WIND = 2, EARTH = 3, PUZZLES = [4, 3, 4];
  const fail = m => { throw new Error(m); };
  const req = (c, m) => { if (!c) fail(m); };
  const emptyPlot = () => ({ crop: null, grown: 0, watered_day: 0 });
  const newPlayer = season => {
    const seeds = new Array(CROPS.length).fill(0); seeds[0] = 4; seeds[4] = 2;
    return { season, day: 1, coins: START_COINS, prices: BASE.slice(), positions: [], commitment: null, npc_moves: [],
      asleep: false, passed_out: false, fish_day: 0, seer_day: 0, chest: false, finished: false, won: false, history: [],
      energy: ENERGY_MAX, plots: Array.from({ length: START_PLOTS }, emptyPlot), seeds, friendship: new Array(NPCS).fill(0), gift_day: new Array(NPCS).fill(0),
      projects: PROJECTS.map(() => false), donated: PROJECTS.map(() => new Array(NG + 1).fill(0)), mined_day: 0, mined: 0, catches_today: 0, cat_day: 0,
      harvested: 0, jade_found: 0, fish_caught: 0, kaito_pnl: 0, start_coins: START_COINS, seasons_won: 0, best_score: 0,
      lead: null, enc_today: 0, fed_today: 0, wild: null, wallet: null, book: 0, shards: 0, clues: 0, solved_day: [0, 0, 0],
      fate_day: 0, fate: [], daily: [0, 0, 0, 0, 0, 0, 0], quests_claimed: 0, chapter: 1, boss_wins: 0, duel_day: [0, 0, 0], duel_wins: 0, legends: 0,
      note_day: 0, votes_today: 0, voted: [], rep: 0, curse_day: 0, hex: null, last_hex: null, charms: 0, boss_seen: 0, boss_hits: 0, boss_claimed: 0,
      cursed_day: 0, cursed_season: 0, sold: 0, duel_seed: '', duel_last: 0, forage_day: [0, 0, 0, 0, 0],
      crew: [], fed: [], peeked: 0, npc_right: [0, 0, 0, 0, 0], npc_total: [0, 0, 0, 0, 0], call: null, call_right: 0, call_total: 0,
      stall_score: [0, 0, 0, 0, 0], baron_score: [0, 0, 0, 0, 0], baron_lv: [0, 0, 0, 0, 0], stall_last: [0, 0, 0, 0, 0] };
  };
  const preimage = (player, season, day, event, rumors, salt, moves) => `${player}|${season}|${day}|${event}|${rumors}|${salt}|${moves || ''}`;
  function settle(pos, price) { const e = Math.max(1, pos.entry); const mv = Math.trunc((price - e) * 1e6 / e); return Math.trunc(pos.stake * pos.lev * mv * (pos.long ? 1 : -1) / 1e6); }
  const ripe = pl => pl.crop !== null && pl.grown >= CROPS[pl.crop][1];
  const rnd = () => Math.floor(Math.random() * 256);
  const clone = o => JSON.parse(JSON.stringify(o));
  // FNV-1a, used for the day's fixed rolls when no sha256 is available (the browser's offline mode)
  const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };

  class Engine {
    constructor(operator, contractId, sha256hex) {
      this.operator = operator; this.contractId = contractId; this.sha = sha256hex || null;
      this.players = {}; this.balances = {}; this.supply = {}; this.npcs = {}; this.leaderboard = [];
      this.tokens = {}; this.owners = {}; this.byOwner = {}; this.links = {}; this.nextToken = 0;
      this.notes = []; this.nextNote = 0; this.feed = []; this.boss = null; this.bossWindow = -1; this.calls = []; this.now = () => Date.now();
    }
    // ---- the island (shared by every player) ----
    _post(who, text) { this.feed.push({ at: this.now(), who, text }); if (this.feed.length > R.ISLAND.FEED_KEPT) this.feed.shift(); }
    _bossRoll(w) { if (this.sha) { const h = this.sha('pixel-bazaar|boss|' + w); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16)]; } const f = fnv('pixel-bazaar|boss|' + w); return [f & 255, (f >>> 8) & 255]; }
    _maybeSpawnBoss(now) {
      const w = Math.floor(now / R.ISLAND.BOSS_WINDOW_MS);
      if (this.bossWindow === w || (this.boss && this.boss.hp > 0 && now < this.boss.ends)) return;
      this.bossWindow = w; const r = this._bossRoll(w);
      if (r[0] < R.ISLAND.BOSS_CHANCE) this._spawnBoss(R.ISLAND.BOSS_FORMS[r[1] % 3], (w + 1) * R.ISLAND.BOSS_WINDOW_MS);
    }
    _spawnBoss(species, ends) {
      this.boss = { id: this.boss ? this.boss.id + 1 : 1, species, hp: R.ISLAND.BOSS_HP, max: R.ISLAND.BOSS_HP, ends, hitters: [], killed_by: null };
      this._post(this.contractId, `THE ${SP[species].name.toUpperCase()} DESCENDS ON THE ISLAND! Everyone, fight!`);
    }
    _seed8() { const b = new Uint8Array(8); (globalThis.crypto || require('crypto').webcrypto).getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
    get_notes(world) { return this.notes.filter(n => n.world === world); }
    get_feed() { return this.feed.slice(); }
    get_boss() {
      const now = this.now(), w = Math.floor(now / R.ISLAND.BOSS_WINDOW_MS), b = this.boss;
      if (b && ((b.hp > 0 && now < b.ends) || (b.killed_by && now < b.ends + R.ISLAND.BOSS_WINDOW_MS))) return clone(b);
      const r = this._bossRoll(w);
      if (this.bossWindow !== w && r[0] < R.ISLAND.BOSS_CHANCE) return { id: 0, species: R.ISLAND.BOSS_FORMS[r[1] % 3], hp: R.ISLAND.BOSS_HP, max: R.ISLAND.BOSS_HP, ends: (w + 1) * R.ISLAND.BOSS_WINDOW_MS, hitters: [], killed_by: null };
      return null;
    }
    summon_boss(c, { species }) {
      this._op(c); req(R.ISLAND.BOSS_FORMS.includes(species), 'not a boss');
      req(!this.boss || this.boss.hp <= 0 || this.now() >= this.boss.ends, 'a boss is already up');
      this._spawnBoss(species, this.now() + R.ISLAND.BOSS_WINDOW_MS);
    }
    _p(a) { return this.players[a] || fail('not a player'); }
    _op(c) { if (c !== this.operator) fail('operator only'); }
    _bal(t, a) { return this.balances[t + '|' + a] || 0; }
    _mint(t, a, n) { const k = t + '|' + a; this.balances[k] = (this.balances[k] || 0) + n; this.supply[t] = (this.supply[t] || 0) + n; }
    _burn(t, a, n) { const k = t + '|' + a; req((this.balances[k] || 0) >= n, 'not enough balance'); this.balances[k] -= n; this.supply[t] -= n; }
    _maxLev(a) { return this._bal('license_x10', a) ? 10 : this._bal('license_x5', a) ? 5 : 2; }
    _barnAdd(a, g, n) { const tot = GOODS.reduce((s, t) => s + this._bal(t, a), 0); req(tot + n <= BARN_CAP, 'your barn is full'); this._mint(GOODS[g], a, n); }
    _badge(name, a) { const t = 'badge_' + name; if (this._bal(t, a)) return false; this._mint(t, a, 1); const id = 'b' + (++this.nextToken); this.tokens[id] = { type: 'Badge', name }; this._give(id, a); return true; }
    // ---- spirits and NFTs ----
    _give(id, to) { this.owners[id] = to; (this.byOwner[to] = this.byOwner[to] || []).push(id); }
    _move(id, from, to) { req(from !== to, 'already there'); this.byOwner[from] = (this.byOwner[from] || []).filter(t => t !== id); this._give(id, to); const p = this.players[from]; if (p && p.lead === id) p.lead = null; }
    _mintSpirit(to, species, shiny) { const id = 's' + (++this.nextToken); this.tokens[id] = { type: 'Spirit', species, shiny, xp: 0 }; this._give(id, to); return id; }
    _xp(id, n) { const t = this.tokens[id]; if (t && t.type === 'Spirit') t.xp = Math.min(800, t.xp + n); }
    _ownsSpirit(c, id) { req(this.owners[id] === c, 'that spirit is not with you'); req(this.tokens[id] && this.tokens[id].type === 'Spirit', 'not a spirit'); }
    _leadEl(c, p) { const t = p.lead && this.owners[p.lead] === c && this.tokens[p.lead]; return t && t.type === 'Spirit' ? SP[t.species].el : null; }
    _ownsEl(c, el) { return (this.byOwner[c] || []).some(id => { const t = this.tokens[id]; return t && t.type === 'Spirit' && SP[t.species].el === el; }); }
    _bookAdd(book, sp) { return Number(BigInt(book || 0) | (1n << BigInt(sp))); }
    _bookCount(book) { let n = 0, b = BigInt(book || 0); while (b) { n += Number(b & 1n); b >>= 1n; } return n; }
    daily_quest(commit, who, slot) { const picked = []; for (let i = 0; picked.length <= slot; i++) { const q = this._roll(commit, who, 'quest', i) % R.QUESTS.length; if (!picked.includes(q)) picked.push(q); } return picked[slot]; }
    puzzle_order(commit, who, k) { const n = PUZZLES[k], v = [...Array(n).keys()]; for (let i = n - 1; i >= 1; i--) { const j = this._roll(commit, who, 'puzzle' + k, i) % (i + 1); [v[i], v[j]] = [v[j], v[i]]; } return v; }
    link_wallet(c, { game_account }) { req(this.players[game_account], 'no trader with that name'); this.links[game_account] = c; }
    get_link_request(game_account) { return this.links[game_account] || null; }
    nft_transfer(c, { receiver_id, token_id }) { req(this.owners[token_id] === c, 'not the owner'); this._move(token_id, c, receiver_id); }
    nft_token(token_id) { const o = this.owners[token_id]; if (!o) return null; const t = this.tokens[token_id];
      if (t.type === 'Stall') { const g = GOODS[R.AGENTS[t.good].stall]; return { token_id, owner_id: o, metadata: { title: g[0].toUpperCase() + g.slice(1) + ' Stall (Lv ' + t.level + ')', media: 'nft/stalls/' + g + '.png' } }; }
      return { token_id, owner_id: o, metadata: t.type === 'Spirit' ? { title: (t.shiny ? 'Shiny ' : '') + SP[t.species].name + ' (Lv ' + R.spiritLevel(t.xp) + ')', media: 'nft/spirits/' + SP[t.species].sprite + (t.shiny ? '_shiny' : '') + '.png' } : t.type === 'Fish' ? { title: 'Legendary fish: ' + R.LEGENDS[t.kind].name, media: 'nft/fish/' + t.kind + '.png' } : { title: 'Badge: ' + t.name.replace(/_/g, ' '), media: 'nft/badges/' + t.name + '.png' } }; }
    nft_tokens_for_owner(account_id) { return (this.byOwner[account_id] || []).map(id => this.nft_token(id)); }
    get_spirits(account_id) {
      return (this.byOwner[account_id] || []).filter(id => this.tokens[id].type === 'Spirit').map(id => {
        const t = this.tokens[id], sp = SP[t.species], lv = R.spiritLevel(t.xp);
        return { token_id: id, species: t.species, name: sp.name, element: sp.el, rarity: sp.rar, shiny: t.shiny, xp: t.xp, level: lv,
          hp: sp.hp + Math.floor(sp.hp * (lv - 1) / 20), atk: sp.atk + Math.floor(sp.atk * (lv - 1) / 20), spd: sp.spd + Math.floor(sp.spd * (lv - 1) / 25) };
      });
    }
    _stall(a, k) { return (this.byOwner[a] || []).find(id => this.tokens[id] && this.tokens[id].type === 'Stall' && this.tokens[id].good === k) || null; }
    get_stalls(account_id) { return [0, 1, 2, 3, 4].map(k => [k, this._stall(account_id, k)]).filter(([, t]) => t).map(([k, t]) => [k, t, this.tokens[t].level]); }
    get_calls() { return clone(this.calls); }
    _resolveStalls(a, p) {
      const badges = [];
      for (let k = 0; k < 5; k++) {
        const bar = R.baronBar(p, k), mine = p.stall_score[k], t = this._stall(a, k), baron = R.AGENTS[k].id + '.' + this.contractId, g = GOODS[R.AGENTS[k].stall];
        p.stall_last[k] = 0;
        if (t) { if (mine >= bar) { this.tokens[t].level++; p.baron_lv[k]++; p.stall_last[k] = 2; } else { this._move(t, a, baron); p.stall_last[k] = -1; this._post(a, `lost the ${g} stall back to ${R.AGENTS[k].id}`); } }
        else if (p.won && mine > bar) { const id = 't' + (++this.nextToken); this.tokens[id] = { type: 'Stall', good: k, level: 1 }; this._give(id, a); p.baron_lv[k]++; p.stall_last[k] = 1; badges.push('stall_owner'); this._post(a, `took the ${g} stall from ${R.AGENTS[k].id}`); }
      }
      if (p.chapter > 5 && [0, 1, 2, 3, 4].every(k => this._stall(a, k))) badges.push('bazaar_keeper');
      return badges;
    }
    _crewNight(a, p, secret, event) {
      const out = [];
      p.crew.forEach((t, i) => {
        const tok = this.owners[t] === a && this.tokens[t];
        if (!tok || tok.type !== 'Spirit') { out.push({ token: t, species: 0, job: 0, goods: [], coins: 0, shard: false, charm: false, note: 5 }); return; }
        const sp = SP[tok.species];
        if (!p.fed.includes(t)) { out.push({ token: t, species: tok.species, job: sp.el, goods: [], coins: 0, shard: false, charm: false, note: 3 }); return; }
        let [goods, coins, shard, charm, note] = R.crewWork(sp.el, R.spiritLevel(tok.xp), sp.rar, tok.shiny, event, this._roll(secret, a, 'crew', i * 2), this._roll(secret, a, 'crew', i * 2 + 1), p.charms);
        const got = [];
        for (const [g, q] of goods) {
          const room = Math.max(0, BARN_CAP - GOODS.reduce((s, x) => s + this._bal(x, a), 0)), n = Math.min(q, room);
          if (n < q) note = 4; if (n > 0) { this._mint(GOODS[g], a, n); got.push({ good: g, qty: n }); } if (g === 11 && n > 0) p.jade_found += n;
        }
        p.coins += coins * 100; if (shard) p.shards++; if (charm) p.charms++;
        this._xp(t, R.CREW.XP);
        out.push({ token: t, species: tok.species, job: sp.el, goods: got, coins, shard, charm, note });
      });
      p.crew = p.crew.filter(t => this.owners[t] === a);
      return out;
    }
    _roll(commit, who, what, n) { const s = `${commit}|${who}|${what}|${n}`; return this.sha ? parseInt(this.sha(s).slice(0, 2), 16) : fnv(s) & 255; }
    _rank(e) {
      const better = (a, b) => (a.won - b.won) || (a.score - b.score) || (b.day - a.day);
      const i = this.leaderboard.findIndex(x => x.account === e.account);
      if (i >= 0) { if (better(e, this.leaderboard[i]) <= 0) return; this.leaderboard.splice(i, 1); }
      this.leaderboard.push(e); this.leaderboard.sort((x, y) => (y.won - x.won) || (y.score - x.score) || (x.day - y.day)); this.leaderboard.length = Math.min(20, this.leaderboard.length); }

    register_player(c, name) { this._op(c); const id = `${name}.${this.contractId}`; req(!this.players[id], 'name taken'); this.players[id] = newPlayer(1); return id; }
    create_npc(c, name) { this._op(c); this.npcs[`${name}.${this.contractId}`] = 1000 * 100; }

    start_season(c) {
      const old = this._p(c); req(old.finished, 'finish this season first'); const p = newPlayer(old.season + 1);
      p.plots = old.plots.map(pl => ({ ...pl, watered_day: 0 })); p.seeds = old.seeds; p.friendship = old.friendship; p.projects = old.projects; p.donated = old.donated;
      p.harvested = old.harvested; p.jade_found = old.jade_found; p.fish_caught = old.fish_caught;
      p.seasons_won = old.seasons_won; p.best_score = old.best_score;
      p.lead = old.lead; p.wallet = old.wallet; p.book = old.book; p.shards = old.shards; p.clues = old.clues; p.chapter = old.chapter; p.boss_wins = old.boss_wins; p.duel_wins = old.duel_wins; p.legends = old.legends; p.rep = old.rep; p.voted = old.voted; p.charms = old.charms; p.boss_seen = old.boss_seen; p.boss_hits = old.boss_hits; p.boss_claimed = old.boss_claimed;
      p.crew = old.crew; p.npc_right = old.npc_right; p.npc_total = old.npc_total; p.call_right = old.call_right; p.call_total = old.call_total; p.baron_lv = old.baron_lv; p.stall_last = old.stall_last;
      this.players[c] = p;
    }
    open_position(c, { good, long, lev, stake }) {
      const max = this._maxLev(c), p = this._p(c);
      req(!p.finished && !p.asleep, 'day is over'); req(p.commitment, 'the day has not started yet');
      req(good >= 0 && good < NG, 'bad good'); req([1, 2, 5, 10].includes(lev), 'bad leverage'); req(lev <= max, 'you need a license for that leverage');
      req(stake > 0 && stake <= p.coins, 'not enough coins');
      p.coins -= stake; p.positions.push({ good, long, lev, stake, entry: p.prices[good] });
    }
    buy_item(c, { token_id }) {
      const cost = ITEMS[token_id]; req(cost !== undefined, 'unknown item'); req(!this._bal(token_id, c), 'already owned');
      const p = this._p(c); req(!p.finished, 'season over'); req(p.coins >= cost * 100, 'not enough coins');
      p.coins -= cost * 100; this._mint(token_id, c, 1);
    }
    claim(c, { kind }) {
      const boat = this._bal('boat', c) > 0, p = this._p(c);
      req(!p.finished && !p.asleep, 'day is over');
      if (kind === 'fisherman' || kind === 'fish') { req(p.fish_day !== p.day, 'already claimed today'); p.fish_day = p.day; p.coins += 3000; }
      else if (kind === 'chest') { req(boat && !p.chest, 'no chest for you'); p.chest = true; p.coins += 40000; }
      else if (kind === 'seer') { req(p.seer_day !== p.day && p.coins >= 4000, 'cannot pay the seer'); p.seer_day = p.day; p.coins -= 4000; }
      else fail('unknown claim');
    }
    act(c, { actions }) {
      req(actions && actions.length > 0 && actions.length <= 60, '1 to 60 actions');
      this._p(c); const allBefore = clone(this.players), balBefore = { ...this.balances }, supBefore = { ...this.supply };
      const isl = clone({ n: this.notes, nn: this.nextNote, f: this.feed, b: this.boss, w: this.bossWindow, c: this.calls });
      const nft = clone({ t: this.tokens, o: this.owners, b: this.byOwner, l: this.links, n: this.nextToken });
      try { this._act(c, actions); }
      catch (e) {
        this.players = allBefore; this.balances = balBefore; this.supply = supBefore;
        this.notes = isl.n; this.nextNote = isl.nn; this.feed = isl.f; this.boss = isl.b; this.bossWindow = isl.w; this.calls = isl.c;
        this.tokens = nft.t; this.owners = nft.o; this.byOwner = nft.b; this.links = nft.l; this.nextToken = nft.n; throw e;
      }
    }
    _act(c, actions) {
      const p = this._p(c); req(!p.finished && !p.asleep, 'day is over'); req(p.commitment, 'the day has not started yet');
      const commit = p.commitment, roll = (what, n) => this._roll(commit, c, what, n);
      const leadEl = this._leadEl(c, p);
      const fate = (k, v) => p.fate_day === p.day && p.fate.length === 3 && p.fate[k] === v, inc = i => { p.daily[i] = Math.min(255, p.daily[i] + 1); };
      const energy = n => { req(p.energy >= n, 'you are too tired'); p.energy -= n; };
      const badges = [];
      if (p.hex) { const h = p.hex; p.hex = null; if (h.kind === 0) p.energy = Math.max(0, p.energy - 15); if (h.kind === 1) p.coins = Math.max(0, p.coins - 3000); p.last_hex = h; }
      for (const a of actions) {
        switch (a.t) {
          case 'Plant': { energy(2); req(a.crop < CROPS.length && p.seeds[a.crop] > 0, 'no seeds of that kind'); const pl = p.plots[a.plot] || fail('no such plot'); req(pl.crop === null, 'plot is not empty'); p.plots[a.plot] = { crop: a.crop, grown: 0, watered_day: 0 }; p.seeds[a.crop]--; break; }
          case 'Water': { energy(1); const pl = p.plots[a.plot] || fail('no such plot'); req(pl.crop !== null && pl.watered_day !== p.day, 'nothing to water'); pl.watered_day = p.day; break; }
          case 'Harvest': {
            energy(1); const pl = p.plots[a.plot] || fail('no such plot'); req(ripe(pl), 'not ripe yet');
            const [good, days, , yld, regrow] = CROPS[pl.crop];
            this._barnAdd(c, good, yld);
            p.plots[a.plot] = regrow ? { crop: pl.crop, grown: days - regrow, watered_day: pl.watered_day } : emptyPlot();
            p.harvested += yld; p.daily[2] = Math.min(255, p.daily[2] + yld);
            if (p.harvested === yld) badges.push('first_harvest');
            if (p.harvested >= 50 && p.harvested - yld < 50) badges.push('green_thumb');
            break;
          }
          case 'Mine': {
            energy(fate(1, 2) ? 12 : 8); req(a.rock < ROCKS, 'no such rock'); inc(3);
            if (p.mined_day !== p.day) { p.mined_day = p.day; p.mined = 0; }
            req(!(p.mined & (1 << a.rock)), 'already mined today'); p.mined |= 1 << a.rock;
            const r = roll('mine', a.rock), jade = (leadEl === EARTH ? 96 : 64) + (fate(0, 1) ? 32 : 0);
            if (r < jade) { this._barnAdd(c, 11, 1); p.jade_found++; if (p.jade_found === 5) badges.push('jade_hunter'); }
            else if (r < 200) this._barnAdd(c, 12, 1);
            else if (r >= 250) p.shards++;
            else p.seeds[r % 7] += 2;
            break;
          }
          case 'Fish': {
            energy(4); req(p.catches_today < 6, 'the fish stopped biting for today');
            const r = roll('fish', p.catches_today); p.catches_today++;
            if (a.ok && r < Math.max(0, Math.min(255, (leadEl === WATER ? 210 : 179) + (fate(0, 0) ? 40 : 0) - (fate(1, 4) ? 30 : 0)))) { const n = p.projects[0] ? 2 : 1; this._barnAdd(c, 1, n); p.fish_caught += n; p.daily[1] = Math.min(255, p.daily[1] + n); if (p.fish_caught >= 10 && p.fish_caught - n < 10) badges.push('angler');
              const season = [leadEl === FIRE, leadEl === WATER && p.day >= 5, fate(0, 0), p.chapter >= 5, (p.legends & 15) === 15];
              const k = R.LEGENDS.findIndex((_, k) => season[k] && !(p.legends & (1 << k)));
              if (k >= 0 && roll('legend', p.catches_today) < R.LEGENDS[k].chance) {
                p.legends |= 1 << k; this._post(c, 'pulled up the legendary ' + R.LEGENDS[k].name); const id = 'f' + (++this.nextToken); this.tokens[id] = { type: 'Fish', kind: k }; this._give(id, c);
                if (p.legends === 31) badges.push('fishing_legend');
              } }
            break;
          }
          case 'Cat': { req(p.cat_day !== p.day, 'Mochi already found something today'); req(!fate(1, 1), 'The Crow scared Mochi today'); p.cat_day = p.day; const r = roll('cat', 0); if (r < 128) p.coins += 1000; else p.seeds[r % 7] += 1; break; }
          case 'Sell': {
            const g = a.good; req(g >= 0 && g < NG && g !== 3 && a.qty > 0, 'cannot sell that'); req(this._bal(GOODS[g], c) >= a.qty, 'not enough in your barn');
            this._burn(GOODS[g], c, a.qty); p.sold += a.qty;
            const k = R.AGENTS.findIndex(x => x.stall === g), held = k >= 0 && !!this._stall(c, k);
            const bonus = (g === 0 && p.projects[2] ? 115 : 100) + (held ? 10 : 0); let got = 0;
            for (let i = 0; i < a.qty; i++) { const v = Math.trunc(Math.trunc(p.prices[g] / 10) * bonus / 100); p.coins += v; got += v; p.prices[g] = Math.max(1, Math.trunc(p.prices[g] * 98 / 100)); }
            if (k >= 0) p.stall_score[k] += Math.trunc(got / 5);
            break;
          }
          case 'Gift': {
            const n = a.npc; req(n >= 0 && n < NPCS, 'no such person'); req(p.gift_day[n] !== p.day, 'one gift a day'); req(a.good >= 0 && a.good < NG, 'no such good'); req(this._bal(GOODS[a.good], c) >= 1, "you don't have that");
            this._burn(GOODS[a.good], c, 1); p.gift_day[n] = p.day; inc(4);
            const before = p.friendship[n]; p.friendship[n] = Math.min(100, p.friendship[n] + (a.good >= 4 && a.good <= 10 ? 15 : 10));
            if (before < 100 && p.friendship[n] >= 100) badges.push('best_friend');
            break;
          }
          case 'Donate': {
            const j = a.project; req(j >= 0 && j < PROJECTS.length && !p.projects[j], 'nothing to donate to');
            const [need, coins] = PROJECTS[j];
            for (const [g, n] of need) { const give = Math.min(this._bal(GOODS[g], c), Math.max(0, n - p.donated[j][g])); if (give > 0) { this._burn(GOODS[g], c, give); p.donated[j][g] += give; } }
            const cgive = Math.min((a.coins || 0) * 100, Math.max(0, coins * 100 - p.donated[j][NG])); req(p.coins >= cgive, 'not enough coins'); p.coins -= cgive; p.donated[j][NG] += cgive;
            if (need.every(([g, n]) => p.donated[j][g] >= n) && p.donated[j][NG] >= coins * 100) { p.projects[j] = true; badges.push('restorer'); }
            break;
          }
          case 'BuySeed': { req(a.crop < CROPS.length && a.qty > 0 && a.qty <= 50, 'bad seed order'); const cost = CROPS[a.crop][2] * 100 * a.qty; req(p.coins >= cost, 'not enough coins'); p.coins -= cost; p.seeds[a.crop] += a.qty; break; }
          case 'BuyPlot': { req(p.plots.length < MAX_PLOTS, 'no more land'); req(p.coins >= PLOT_COST * 100, 'not enough coins'); p.coins -= PLOT_COST * 100; p.plots.push(emptyPlot()); break; }
          case 'Encounter': {
            energy(fate(1, 0) ? 8 : 5); req(a.zone >= 0 && a.zone < SPAWN.length, 'no such place'); req(p.enc_today < R.ENCOUNTERS_A_DAY + (fate(2, 0) ? 1 : 0), 'the spirits are hiding until tomorrow');
            if (a.zone === 2) req(this._ownsEl(c, WATER), 'you need a water spirit to dive to the shrine');
            if (a.zone === 3) req(this._ownsEl(c, WIND), 'you need a wind spirit to glide to the sky');
            const n = p.enc_today++; const table = SPAWN[a.zone], total = table.reduce((t, x) => t + x[1], 0);
            let pick = (roll('enc', n) * 256 + roll('enc2', n)) % total, species = table[0][0];
            for (const [sp, w] of table) { if (pick < w) { species = sp; break; } pick -= w; }
            p.wild = { species, shiny: roll('shiny', n) < (fate(2, 3) ? 16 : 4), zone: a.zone };
            break;
          }
          case 'Catch': {
            const w = p.wild || fail('there is no spirit here'); p.wild = null;
            const sp = SP[w.species]; let chance = R.CATCH_CHANCE[sp.rar] + (fate(0, 2) ? 26 : 0); if (fate(1, 3)) chance = Math.max(0, chance - 20); if (leadEl === sp.el) chance += 38;
            if (a.ok && roll('catch', p.enc_today) < chance) {
              this._mintSpirit(c, w.species, w.shiny); inc(0); p.book = this._bookAdd(p.book, w.species);
              const caught = this._bookCount(p.book);
              if (caught === 1) badges.push('first_spirit'); if (caught === 10) badges.push('spirit_tamer'); if (w.shiny) badges.push('shiny_hunter');
              if (w.shiny || sp.rar >= 2) this._post(c, `caught a ${w.shiny ? 'SHINY ' : ''}${sp.name}`);
            }
            break;
          }
          case 'SetLead': this._ownsSpirit(c, a.token); p.lead = a.token; break;
          case 'Feed': {
            this._ownsSpirit(c, a.token); req(p.fed_today < R.FEEDS_A_DAY, 'it is full for today');
            req(a.good >= 0 && a.good < NG && this._bal(GOODS[a.good], c) >= 1, "you don't have that");
            this._burn(GOODS[a.good], c, 1); p.fed_today++; inc(6); this._xp(a.token, a.good === 11 ? 25 : [1, 2, 3].includes(a.good) ? 12 : 6);
            if (!p.fed.includes(a.token)) p.fed.push(a.token);
            break;
          }
          case 'Evolve': {
            this._ownsSpirit(c, a.token); const t = this.tokens[a.token], sp = SP[t.species];
            req(sp.evo >= 0, 'this is its final form'); req(R.spiritLevel(t.xp) >= sp.at, 'it needs a higher level');
            if (sp.shard) { req(p.shards >= 1, 'it needs a lantern shard'); p.shards--; }
            t.species = sp.evo; p.book = this._bookAdd(p.book, sp.evo); if (SP[sp.evo].rar === 3) badges.push('legend_tamer');
            break;
          }
          case 'ConfirmWallet': req(this.links[c] === a.wallet, 'ask from your wallet first'); delete this.links[c]; p.wallet = a.wallet; badges.push('wallet_linked'); break;
          case 'UnlinkWallet': p.wallet = null; break;
          case 'DrawFate': {
            req(p.fate_day !== p.day, 'Madame Vey: come back tomorrow, dear'); p.fate_day = p.day;
            p.fate = [roll('fate', 0) % 6, roll('fate', 1) % 5, roll('fate', 2) % 4];
            if (p.fate[0] === 3) p.energy = Math.min(ENERGY_MAX + 20, p.energy + 20); if (p.fate[0] === 4) p.coins += 3000; if (p.fate[0] === 5) p.seeds[roll('fate', 3) % 7] += 3;
            break;
          }
          case 'ClaimQuest': {
            req(a.slot >= 0 && a.slot < 3, 'no such quest'); req(!(p.quests_claimed & (1 << a.slot)), 'already claimed');
            const q = R.QUESTS[this.daily_quest(commit, c, a.slot)]; req(p.daily[q[0]] >= q[1], 'not done yet');
            p.quests_claimed |= 1 << a.slot; p.coins += q[2] * 100; if (p.lead && this.owners[p.lead] === c) this._xp(p.lead, 5);
            break;
          }
          case 'AdvanceStory': {
            req(p.chapter <= 5, 'the story is complete');
            const done = [null, p.book && p.sold > 0, p.clues & 1, p.clues & 2, p.clues & 4, p.boss_wins & 1][p.chapter];
            req(done, 'this chapter is not finished yet'); p.chapter++;
            if (p.chapter >= 2 && p.chapter <= 4) { p.shards++; p.coins += 10000; } if (p.chapter === 5) { p.shards += 2; p.coins += 20000; }
            if (p.chapter > 5) { badges.push('lantern_keeper'); this._mintSpirit(c, 37, false); p.book = this._bookAdd(p.book, 37); if ([0, 1, 2, 3, 4].every(k => this._stall(c, k))) badges.push('bazaar_keeper'); }
            break;
          }
          case 'Duel': {
            const f = a.foe; req(f >= 0 && f < R.FOES.length, 'no such rival');
            req(Array.isArray(a.team) && a.team.length >= 1 && a.team.length <= 3, 'pick one to three spirits');
            req(p.duel_day[f] !== p.day, 'one duel a day with each rival');
            if (f === 2) req(p.chapter >= 5, 'the Great Spirit is still asleep');
            energy(R.DUEL_ENERGY);
            const mine = a.team.map((t, i) => { req(!a.team.slice(0, i).includes(t), 'each spirit fights once'); this._ownsSpirit(c, t); const k = this.tokens[t]; return [k.species, R.spiritLevel(k.xp)]; });
            p.duel_day[f] = p.day;
            const seed = this._seed8(); let n = 0;
            const won = R.duel(mine, R.FOES[f].team, () => this._roll(seed, c, 'duel' + f, n++)).won;
            p.duel_seed = seed; p.duel_last = f | (won ? 0x80 : 0);
            a.team.forEach(t => this._xp(t, won ? 20 : 6));
            if (won) p.crew.forEach(t => { if (!a.team.includes(t) && this.owners[t] === c) this._xp(t, 10); });
            if (won) { p.coins += R.FOES[f].coins * 100; p.duel_wins++; if (f === 2) { p.boss_wins |= 1; p.shards++; badges.push('spirit_champion'); } this._post(c, `beat ${R.FOES[f].name} in a spirit duel`); }
            break;
          }
          case 'LeaveNote': {
            req(a.world >= 0 && a.world < 5 && a.line >= 0 && a.line < R.ISLAND.NOTE_LINES.length && a.x >= 0 && a.x < 1200 && a.y >= 0 && a.y < 1200, 'bad note');
            req(p.note_day !== p.day, 'one ghost note a day'); p.note_day = p.day;
            this.notes.push({ id: ++this.nextNote, author: c, world: a.world, x: a.x, y: a.y, line: a.line, arg: a.arg | 0, at: this.now(), truth: 0, liar: 0 });
            if (this.notes.length > R.ISLAND.NOTES_KEPT) this.notes.shift();
            break;
          }
          case 'VoteNote': {
            req(p.votes_today < R.ISLAND.VOTES_A_DAY, 'you have voted enough today'); req(!p.voted.includes(a.id), 'you already voted on that note');
            const n = this.notes.find(n => n.id === a.id) || fail('the note faded away'); req(n.author !== c, 'not your own note');
            if (a.truth) n.truth++; else n.liar++;
            p.votes_today++; p.voted.push(a.id); if (p.voted.length > 60) p.voted.shift();
            const au = this.players[n.author];
            if (au) { au.rep += a.truth ? 1 : -1; if (a.truth) au.coins += 500; if (au.rep === 10 && a.truth) this._badge('island_oracle', n.author); }
            break;
          }
          case 'Curse': {
            req(a.kind >= 0 && a.kind < 3, 'no such curse'); req(a.target !== c, 'you cannot curse yourself');
            req(p.curse_day !== p.day, 'one curse a day'); req(p.coins >= R.ISLAND.CURSE_COST * 100, 'a curse costs 40 coins');
            const t = this.players[a.target] || fail('no such player');
            req(t.cursed_day !== t.day || t.cursed_season !== t.season, 'someone already cursed them today');
            t.cursed_day = t.day; t.cursed_season = t.season;
            p.coins -= R.ISLAND.CURSE_COST * 100; p.curse_day = p.day;
            const blocked = t.charms > 0, name = R.ISLAND.CURSES[a.kind].name;
            if (blocked) { t.charms--; t.last_hex = { from: c, kind: a.kind, blocked: true }; } else t.hex = { from: c, kind: a.kind, blocked: false };
            this._post(c, blocked ? `cursed ${a.target} with ${name}, but a charm blocked it` : `cursed ${a.target} with ${name}`);
            break;
          }
          case 'Forage': {
            const w = a.world; req(w >= 1 && w < 5, 'no chest there'); req(p.forage_day[w] !== p.day, 'you already opened this chest today');
            p.forage_day[w] = p.day; const r = roll('forage', w);
            if (r < 10) p.shards++; else if (r < 60) p.coins += 4000; else p.coins += (15 + r % 16) * 100;
            break;
          }
          case 'BuyCharm': req(p.charms < 3, 'you can carry three charms'); req(p.coins >= R.ISLAND.CHARM_COST * 100, 'a charm costs 25 coins'); p.coins -= R.ISLAND.CHARM_COST * 100; p.charms++; break;
          case 'BossHit': {
            const now = this.now(); this._maybeSpawnBoss(now);
            const b = this.boss && this.boss.hp > 0 && now < this.boss.ends ? this.boss : fail('the sky is calm. no world boss right now');
            if (p.boss_seen !== b.id) { p.boss_seen = b.id; p.boss_hits = 0; }
            req(p.boss_hits < R.ISLAND.BOSS_HITS, 'you have hit it three times. let the others try');
            const lead = p.lead && this.owners[p.lead] === c ? p.lead : fail('you need a companion spirit to fight');
            energy(15);
            const t = this.tokens[lead], f = R.fighter(t.species, R.spiritLevel(t.xp));
            let dmg = Math.trunc(f.atk * (100 + roll('boss', p.boss_hits) % 60) / 100) * 3;
            if (R.beats(f.el, SP[b.species].el)) dmg = Math.trunc(dmg * 3 / 2);
            p.boss_hits++; b.hp -= dmg; if (!b.hitters.includes(c) && b.hitters.length < 500) b.hitters.push(c);
            const killed = b.hp <= 0; if (killed) b.killed_by = c; this._xp(lead, 15);
            this._post(c, killed ? `landed the final blow on the ${SP[b.species].name}!` : `hit the ${SP[b.species].name} for ${dmg}`);
            break;
          }
          case 'BossClaim': {
            const b = this.boss || fail('no world boss'); req(b.killed_by, 'the boss still stands'); req(b.hitters.includes(c), 'you did not fight it');
            req(p.boss_claimed !== b.id, 'already claimed'); p.boss_claimed = b.id; p.coins += 25000; p.shards++; if (b.killed_by === c) p.coins += 10000;
            badges.push('boss_slayer'); break;
          }
          case 'Solve': {
            req(a.puzzle >= 0 && a.puzzle < PUZZLES.length, 'no such puzzle');
            if (a.puzzle === 1) req(this._ownsEl(c, WATER), 'the shrine is under water');
            if (a.puzzle === 2) req(this._ownsEl(c, WIND), 'the sky is out of reach');
            req(p.solved_day[a.puzzle] !== p.day, 'already solved today');
            req(JSON.stringify(a.answer) === JSON.stringify(this.puzzle_order(commit, c, a.puzzle)), 'that is not the right order');
            p.solved_day[a.puzzle] = p.day; p.shards += fate(2, 1) ? 2 : 1; inc(5);
            const first = !(p.clues & (1 << a.puzzle)); p.clues |= 1 << a.puzzle;
            if (first && (p.clues & 7) === 7) badges.push('lantern_seeker');
            break;
          }
          case 'SendToWallet': {
            const to = p.wallet || fail('link a wallet first'); req(this.owners[a.token] === c, 'not yours');
            if (p.lead === a.token) p.lead = null; this._move(a.token, c, to); break;
          }
          case 'SendTo': {
            req(a.to && a.to !== c, 'that is you'); req(this.owners[a.token] === c, 'not yours');
            if (p.lead === a.token) p.lead = null; this._move(a.token, c, a.to); break;
          }
          case 'SetCrew': {
            req(Array.isArray(a.tokens) && a.tokens.length <= R.CREW.MAX, 'a crew is three spirits at most');
            a.tokens.forEach((t, i) => { req(!a.tokens.slice(0, i).includes(t), 'each spirit works one shift'); this._ownsSpirit(c, t); });
            p.crew = a.tokens.slice(); break;
          }
          case 'Peek': {
            const k = a.agent; req(k >= 0 && k < 5, 'no such trader'); req(!(p.peeked & (1 << k)), 'you already know that call');
            const cost = R.AGENTS[k].peek * 100; req(p.coins >= cost, 'not enough coins to peek'); p.coins -= cost; p.peeked |= 1 << k;
            const acc = R.AGENTS[k].id + '.' + this.contractId; if (this.npcs[acc] !== undefined) this.npcs[acc] += cost; break;
          }
          case 'PostCall': {
            req(a.good >= 0 && a.good < NG && a.good !== 3 && a.good !== 12, 'you cannot call that'); req(!p.call, 'one call a day');
            p.call = { good: a.good, long: !!a.long };
            this.calls.push({ who: c, season: p.season, day: p.day, good: a.good, long: !!a.long, at: this.now(), right: null }); if (this.calls.length > 120) this.calls.shift();
            break;
          }
          default: fail('unknown action');
        }
      }
      for (const b of badges) this._badge(b, c);
    }
    sleep(c, { passed_out }) { const p = this._p(c); req(!p.finished && !p.asleep, 'already asleep'); req(p.commitment, 'the day has not started yet'); p.asleep = true; p.passed_out = !!passed_out; }
    pay_debt(c) {
      const p = this._p(c); req(!p.finished && p.coins >= DEBT, 'not enough coins');
      p.coins -= DEBT; p.finished = true; p.won = true; p.seasons_won++; p.best_score = Math.max(p.best_score, p.coins + DEBT);
      this._badge('debt_free', c); this._post(c, `paid off the 3,000 coin debt on day ${p.day}`); if (p.day <= 6) this._badge('early_bird', c);
      if (p.coins + DEBT - p.start_coins > p.kaito_pnl) this._badge('beat_kaito', c);
      this._rank({ account: c, season: p.season, score: p.coins + DEBT, day: p.day, won: true });
      for (const b of this._resolveStalls(c, p)) this._badge(b, c);
    }
    commit_day(c, { player, day, commitment }) {
      this._op(c); const p = this._p(player);
      req(commitment && commitment.length === 64, 'commitment must be a sha256 hex'); req(!p.finished && p.day === day, 'wrong day'); req(!p.commitment, 'already committed');
      if (p.mined_day !== day) p.mined = 0; p.catches_today = 0;
      p.commitment = commitment; p.npc_moves = [];
    }
    settle_day(c, { player, day, event, rumors, salt, npc_moves }) {
      this._op(c); const p = this._p(player); npc_moves = npc_moves || [];
      req(p.day === day && p.asleep && !p.finished, 'nothing to settle'); req(p.commitment, 'no commitment'); req(npc_moves.length <= 8, 'too many agent moves');
      if (this.sha && this.sha(preimage(player, p.season, day, event, rumors, salt, R.encodeMoves(npc_moves))) !== p.commitment) fail('reveal does not match the commitment');
      p.npc_moves = npc_moves; const secret = p.commitment + '|' + salt;
      const prices = p.prices.map((x, i) => { x = x + Math.trunc((BASE[i] - x) * 40 / 100); x = Math.trunc(x * (1000 + (rnd() % 101) - 50) / 1000); return Math.max(1, x); });
      const pre = prices.slice(); // trades pay on the event only
      for (const [g, m] of EVENTS[event]) prices[g] = Math.max(1, Math.trunc(prices[g] * m / 1000));
      const badges = [], rita = p.npc_moves.find(m => m.npc.startsWith('rita.'));
      const results = p.positions.map(pos => {
        let pnl = settle({ ...pos, entry: pre[pos.good] }, prices[pos.good]); const liquidated = pnl <= -pos.stake; if (liquidated) pnl = -pos.stake;
        p.coins = Math.max(0, p.coins + pos.stake + pnl);
        if (pos.lev === 10 && pnl > 0) badges.push('x10_survivor');
        if (rita && rita.good === pos.good && !pos.long && pnl > 0) badges.push('faded_rita');
        const k = R.AGENTS.findIndex(x => x.stall === pos.good); if (k >= 0) p.stall_score[k] += pnl;
        return { good: pos.good, long: pos.long, lev: pos.lev, stake: pos.stake, pnl, liquidated };
      });
      p.positions = [];
      let killed = 0, grew = 0;
      p.plots = p.plots.map(pl => {
        if (pl.crop === null) return pl;
        const [, days, , , , water] = CROPS[pl.crop];
        if (pl.grown < days) {
          if ((event === EV_BLIGHT && pl.crop === 6) || (event === EV_COLD && (pl.crop === 1 || pl.crop === 3))) { killed++; return emptyPlot(); }
          if (!water || pl.watered_day === day || event === EV_STORM) { grew++; return { ...pl, grown: pl.grown + 1 }; }
        }
        return pl;
      });
      let stall_sold = 0;
      if (this._bal('stall', player)) for (let i = 0; i < 3; i++) {
        let best = -1; for (let g = 0; g < NG; g++) if (g !== 3 && this._bal(GOODS[g], player) > 0 && (best < 0 || prices[g] > prices[best])) best = g;
        if (best >= 0) { this._burn(GOODS[best], player, 1); const v = Math.trunc(Math.trunc(prices[best] / 10) * 110 / 100); p.coins += v; stall_sold += v; }
      }
      const loss = 0, npc = []; let grudge = null;
      for (const m of p.npc_moves) {
        const stake = m.npc.startsWith('kaito.') ? 20000 : 10000, pos = { good: m.good, long: m.long, lev: 5, stake, entry: pre[m.good] };
        const pnl = Math.max(-stake, settle(pos, prices[m.good])); if (this.npcs[m.npc] !== undefined) this.npcs[m.npc] += pnl;
        if (m.npc.startsWith('kaito.')) p.kaito_pnl += pnl;
        const a = R.agentOf(m.npc); if (a < 0) continue;
        p.npc_total[a]++; if (pnl > 0) p.npc_right[a]++;
        if (m.good === R.AGENTS[a].stall) p.baron_score[a] += pnl;
        npc.push({ agent: a, good: m.good, long: m.long, pnl });
        const faded = results.some(r => r.good === m.good && r.long !== m.long && r.pnl > 0);
        if (faded && !grudge && this._roll(secret, player, 'grudge', a) < R.CREW.GRUDGE_CHANCE) {
          const kind = this._roll(secret, player, 'grudge-kind', a) % 2, blocked = p.charms > 0; if (blocked) p.charms--;
          grudge = { from: m.npc, kind, blocked }; if (blocked) p.last_hex = clone(grudge); else p.hex = clone(grudge);
        }
      }
      let call = null;
      if (p.call) {
        const cl = p.call, right = cl.long ? prices[cl.good] > pre[cl.good] : prices[cl.good] < pre[cl.good]; p.call = null; p.call_total++;
        if (right) { p.call_right++; p.coins += R.CREW.CALL_REWARD * 100; p.rep++; }
        const cp = this.calls.slice().reverse().find(x => x.who === player && x.season === p.season && x.day === day); if (cp) cp.right = right;
        call = right;
      }
      const crew = this._crewNight(player, p, secret, event);
      let rent = 0; for (let k = 0; k < 5; k++) { const t = this._stall(player, k); if (t) rent += (R.CREW.STALL_RENT + 5 * this.tokens[t].level) * 100; }
      p.coins += rent;
      p.prices = prices; p.commitment = null; p.npc_moves = []; p.asleep = false; p.passed_out = false; p.energy = ENERGY_MAX; p.catches_today = 0;
      p.enc_today = 0; p.fed_today = 0; p.wild = null; p.daily = [0, 0, 0, 0, 0, 0, 0]; p.quests_claimed = 0; p.votes_today = 0; p.fed = []; p.peeked = 0;
      if (p.lead && this.owners[p.lead] === player) this._xp(p.lead, 10);
      if (day >= SEASON_DAYS) {
        p.finished = true; p.won = p.coins >= DEBT; if (p.won) { p.coins -= DEBT; badges.push('debt_free'); }
        const score = p.won ? p.coins + DEBT : p.coins;
        if (p.won) p.seasons_won++; p.best_score = Math.max(p.best_score, score);
        if (score - p.start_coins > p.kaito_pnl) badges.push('beat_kaito');
        this._rank({ account: player, season: p.season, score, day, won: p.won });
        badges.push(...this._resolveStalls(player, p));
      } else p.day += 1;
      const minted = badges.filter(b => this._badge(b, player));
      const log = { day, event, prices: prices.slice(), results, coins_after: p.coins, passed_out_loss: loss, rumors, killed, grew, stall_sold, badges: minted, crew, npc, call, rent, grudge };
      p.history.push(log); if (p.history.length > SEASON_DAYS) p.history.shift();
      return log;
    }
    void_day(c, { player }) {
      this._op(c); const p = this._p(player); req(!p.finished && p.commitment, 'nothing to cancel');
      p.coins += p.positions.reduce((s, x) => s + x.stake, 0); p.positions = []; p.commitment = null; p.npc_moves = []; p.asleep = false; p.passed_out = false; p.call = null;
    }
    // views
    mt_balance_of(account_id, token_id) { return this._bal(token_id, account_id); }
    get_player(account_id) { const p = this.players[account_id]; return p ? clone(p) : null; }
    get_inventory(account_id) {
      const barn = GOODS.map(g => this._bal(g, account_id));
      const owned = Object.keys(ITEMS).filter(t => this._bal(t, account_id)).concat(BADGES.map(b => 'badge_' + b).filter(t => this._bal(t, account_id)));
      return [barn, owned];
    }
    get_leaderboard() { return this.leaderboard.slice(); }
    get_npcs() { return Object.entries(this.npcs); }
  }
  const api = { Engine, preimage, START_COINS, DEBT, SEASON_DAYS, ITEMS, GOODS, BARN_CAP, MAX_PLOTS, PLOT_COST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BazaarEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
