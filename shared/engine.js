// JavaScript mirror of the NEAR contract (contract/src/lib.rs v2). Same units, same rules.
// Used for the offline build in the browser and as a stand-in contract when testing the server.
(function (root) {
  'use strict';
  const START_COINS = 300 * 100, DEBT = 5000 * 100, SEASON_DAYS = 10, NG = 13;
  const GOODS = ['tea', 'fish', 'honey', 'sushi', 'carrot', 'strawberry', 'pumpkin', 'tomato', 'corn', 'eggplant', 'apple', 'jade', 'ore'];
  const BASE = [20000, 35000, 50000, 80000, 15000, 30000, 60000, 25000, 20000, 35000, 40000, 120000, 12000];
  const EVENTS = [[[1, 1500]], [[1, 620]], [[0, 620]], [[0, 1500]], [[2, 620]], [[2, 1500]], [[3, 1500], [6, 1300]], [[6, 1500], [8, 1400]], [[5, 600]], [[4, 1450], [7, 1450], [9, 1300]]];
  const EV_STORM = 0, EV_BLIGHT = 3, EV_COLD = 5;
  // good, days, seed cost, yield, regrow, needs water
  const CROPS = [[4, 2, 6, 2, 0, true], [5, 3, 10, 3, 0, true], [6, 4, 22, 2, 0, true], [7, 3, 8, 3, 0, true], [8, 2, 6, 2, 0, true], [9, 3, 12, 2, 0, true], [0, 2, 5, 3, 0, true], [10, 4, 80, 3, 2, true], [2, 2, 60, 2, 2, false]];
  const ITEMS = { license_x5: 250, license_x10: 900, bridge: 600, boat: 300, stall: 1500 };
  const PROJECTS = [[[[1, 30], [11, 5]], 400], [[[12, 10], [11, 8]], 0], [[[0, 40]], 600]];
  const BADGES = ['first_harvest', 'green_thumb', 'jade_hunter', 'angler', 'x10_survivor', 'faded_rita', 'beat_kaito', 'debt_free', 'early_bird', 'restorer', 'best_friend'];
  const PLOT_COST = 120, MAX_PLOTS = 18, START_PLOTS = 6, BARN_CAP = 40, NPCS = 8, ROCKS = 8, ENERGY_MAX = 100;

  const fail = m => { throw new Error(m); };
  const req = (c, m) => { if (!c) fail(m); };
  const emptyPlot = () => ({ crop: null, grown: 0, watered_day: 0 });
  const newPlayer = season => {
    const seeds = new Array(CROPS.length).fill(0); seeds[0] = 4; seeds[4] = 2;
    return { season, day: 1, coins: START_COINS, prices: BASE.slice(), positions: [], commitment: null, weather: null, npc_moves: [],
      asleep: false, passed_out: false, fish_day: 0, seer_day: 0, chest: false, finished: false, won: false, history: [],
      energy: ENERGY_MAX, plots: Array.from({ length: START_PLOTS }, emptyPlot), seeds, friendship: new Array(NPCS).fill(0), gift_day: new Array(NPCS).fill(0),
      projects: PROJECTS.map(() => false), donated: PROJECTS.map(() => new Array(NG + 1).fill(0)), mined_day: 0, mined: 0, catches_today: 0, cat_day: 0,
      harvested: 0, jade_found: 0, fish_caught: 0, kaito_start: 0, start_coins: START_COINS, seasons_won: 0, best_score: 0 };
  };
  const preimage = (player, season, day, event, rumors, salt) => `${player}|${season}|${day}|${event}|${rumors}|${salt}`;
  function settle(pos, price) { const mv = Math.trunc((price - pos.entry) * 1e6 / pos.entry); return Math.trunc(pos.stake * pos.lev * mv * (pos.long ? 1 : -1) / 1e6); }
  const ripe = pl => pl.crop !== null && pl.grown >= CROPS[pl.crop][1];
  const rnd = () => Math.floor(Math.random() * 256);
  const clone = o => JSON.parse(JSON.stringify(o));

  class Engine {
    constructor(operator, contractId, sha256hex) {
      this.operator = operator; this.contractId = contractId; this.sha = sha256hex || null;
      this.players = {}; this.balances = {}; this.supply = {}; this.npcs = {}; this.leaderboard = [];
    }
    _p(a) { return this.players[a] || fail('not a player'); }
    _op(c) { if (c !== this.operator) fail('operator only'); }
    _bal(t, a) { return this.balances[t + '|' + a] || 0; }
    _mint(t, a, n) { const k = t + '|' + a; this.balances[k] = (this.balances[k] || 0) + n; this.supply[t] = (this.supply[t] || 0) + n; }
    _burn(t, a, n) { const k = t + '|' + a; req((this.balances[k] || 0) >= n, 'not enough balance'); this.balances[k] -= n; this.supply[t] -= n; }
    _maxLev(a) { return this._bal('license_x10', a) ? 10 : this._bal('license_x5', a) ? 5 : 2; }
    _barnAdd(a, g, n) { const tot = GOODS.reduce((s, t) => s + this._bal(t, a), 0); req(tot + n <= BARN_CAP, 'your barn is full'); this._mint(GOODS[g], a, n); }
    _badge(name, a) { const t = 'badge_' + name; if (this._bal(t, a)) return false; this._mint(t, a, 1); return true; }
    _kaito() { return this.npcs['kaito.' + this.contractId] || 0; }
    _rank(e) { this.leaderboard.push(e); this.leaderboard.sort((x, y) => (y.won - x.won) || (y.score - x.score) || (x.day - y.day)); this.leaderboard.length = Math.min(20, this.leaderboard.length); }

    register_player(c, name) { this._op(c); const id = `${name}.${this.contractId}`; req(!this.players[id], 'name taken'); const p = newPlayer(1); p.kaito_start = this._kaito(); this.players[id] = p; return id; }
    join(c) { if (!this.players[c]) { const p = newPlayer(1); p.kaito_start = this._kaito(); this.players[c] = p; } }
    create_npc(c, name) { this._op(c); this.npcs[`${name}.${this.contractId}`] = 1000 * 100; }

    start_season(c) {
      const old = this._p(c), p = newPlayer(old.season + 1);
      p.plots = old.plots.map(pl => ({ ...pl, watered_day: 0 })); p.seeds = old.seeds; p.friendship = old.friendship; p.projects = old.projects; p.donated = old.donated;
      p.harvested = old.harvested; p.jade_found = old.jade_found; p.fish_caught = old.fish_caught; p.kaito_start = this._kaito();
      p.seasons_won = old.seasons_won; p.best_score = old.best_score;
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
      const before = clone(this._p(c)), balBefore = { ...this.balances }, supBefore = { ...this.supply };
      try { this._act(c, actions); }
      catch (e) { this.players[c] = before; this.balances = balBefore; this.supply = supBefore; throw e; }
    }
    _act(c, actions) {
      const p = this._p(c); req(!p.finished && !p.asleep, 'day is over');
      const energy = n => { req(p.energy >= n, 'you are too tired'); p.energy -= n; };
      const badges = [];
      for (const a of actions) {
        switch (a.t) {
          case 'Plant': { energy(2); req(a.crop < CROPS.length && p.seeds[a.crop] > 0, 'no seeds of that kind'); const pl = p.plots[a.plot] || fail('no such plot'); req(pl.crop === null, 'plot is not empty'); p.plots[a.plot] = { crop: a.crop, grown: 0, watered_day: 0 }; p.seeds[a.crop]--; break; }
          case 'Water': { energy(1); const pl = p.plots[a.plot] || fail('no such plot'); req(pl.crop !== null && pl.watered_day !== p.day, 'nothing to water'); pl.watered_day = p.day; break; }
          case 'Harvest': {
            energy(1); const pl = p.plots[a.plot] || fail('no such plot'); req(ripe(pl), 'not ripe yet');
            const [good, days, , yld, regrow] = CROPS[pl.crop];
            this._barnAdd(c, good, yld);
            p.plots[a.plot] = regrow ? { crop: pl.crop, grown: days - regrow, watered_day: pl.watered_day } : emptyPlot();
            p.harvested += yld;
            if (p.harvested === yld) badges.push('first_harvest');
            if (p.harvested >= 50 && p.harvested - yld < 50) badges.push('green_thumb');
            break;
          }
          case 'Mine': {
            energy(8); req(a.rock < ROCKS, 'no such rock');
            if (p.mined_day !== p.day) { p.mined_day = p.day; p.mined = 0; }
            req(!(p.mined & (1 << a.rock)), 'already mined today'); p.mined |= 1 << a.rock;
            const r = rnd();
            if (r < 64) { this._barnAdd(c, 11, 1); p.jade_found++; if (p.jade_found === 5) badges.push('jade_hunter'); }
            else if (r < 200) this._barnAdd(c, 12, 1);
            else p.seeds[r % 7] += 2;
            break;
          }
          case 'Fish': {
            energy(4); req(p.catches_today < 6, 'the fish stopped biting for today'); p.catches_today++;
            if (a.ok) { const n = p.projects[0] ? 2 : 1; this._barnAdd(c, 1, n); p.fish_caught += n; if (p.fish_caught >= 10 && p.fish_caught - n < 10) badges.push('angler'); }
            break;
          }
          case 'Cat': { req(p.cat_day !== p.day, 'Mochi already found something today'); p.cat_day = p.day; const r = rnd(); if (r < 128) p.coins += 1000; else p.seeds[r % 7] += 1; break; }
          case 'Sell': {
            const g = a.good; req(g >= 0 && g < NG && g !== 3 && a.qty > 0, 'cannot sell that'); req(this._bal(GOODS[g], c) >= a.qty, 'not enough in your barn');
            this._burn(GOODS[g], c, a.qty); const bonus = g === 0 && p.projects[2] ? 115 : 100;
            for (let i = 0; i < a.qty; i++) { p.coins += Math.trunc(Math.trunc(p.prices[g] / 10) * bonus / 100); p.prices[g] = Math.trunc(p.prices[g] * 98 / 100); }
            break;
          }
          case 'Gift': {
            const n = a.npc; req(n >= 0 && n < NPCS, 'no such person'); req(p.gift_day[n] !== p.day, 'one gift a day'); req(this._bal(GOODS[a.good], c) >= 1, "you don't have that");
            this._burn(GOODS[a.good], c, 1); p.gift_day[n] = p.day;
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
          default: fail('unknown action');
        }
      }
      for (const b of badges) this._badge(b, c);
    }
    sleep(c, { passed_out }) { const p = this._p(c); req(!p.finished && !p.asleep, 'already asleep'); req(p.commitment, 'the day has not started yet'); p.asleep = true; p.passed_out = !!passed_out; }
    pay_debt(c) {
      const k = this._kaito(), p = this._p(c); req(!p.finished && p.coins >= DEBT, 'not enough coins');
      p.coins -= DEBT; p.finished = true; p.won = true; p.seasons_won++; p.best_score = Math.max(p.best_score, p.coins + DEBT);
      this._badge('debt_free', c); if (p.day <= 6) this._badge('early_bird', c);
      if (p.coins + DEBT - p.start_coins > k - p.kaito_start) this._badge('beat_kaito', c);
      this._rank({ account: c, season: p.season, score: p.coins + DEBT, day: p.day, won: true });
    }
    commit_day(c, { player, day, commitment, weather, npc_moves }) {
      this._op(c); const p = this._p(player);
      req(commitment && commitment.length === 64, 'commitment must be a sha256 hex'); req(!p.finished && p.day === day, 'wrong day'); req(!p.commitment, 'already committed');
      if (p.mined_day !== day) p.mined = 0; p.catches_today = 0;
      p.commitment = commitment; p.weather = weather || null; p.npc_moves = npc_moves || [];
    }
    settle_day(c, { player, day, event, rumors, salt }) {
      this._op(c); const p = this._p(player);
      req(p.day === day && p.asleep && !p.finished, 'nothing to settle'); req(p.commitment, 'no commitment');
      if (this.sha && this.sha(preimage(player, p.season, day, event, rumors, salt)) !== p.commitment) fail('reveal does not match the commitment');
      const prices = p.prices.map((x, i) => { x = x + Math.trunc((BASE[i] - x) * 40 / 100); x = Math.trunc(x * (1000 + (rnd() % 101) - 50) / 1000); return Math.max(1, x); });
      for (const [g, m] of EVENTS[event]) prices[g] = Math.trunc(prices[g] * m / 1000);
      const badges = [], rita = p.npc_moves.find(m => m.npc.startsWith('rita.'));
      const results = p.positions.map(pos => {
        let pnl = settle(pos, prices[pos.good]); const liquidated = pnl <= -pos.stake; if (liquidated) pnl = -pos.stake;
        p.coins = Math.max(0, p.coins + pos.stake + pnl);
        if (pos.lev === 10 && pnl > 0) badges.push('x10_survivor');
        if (rita && rita.good === pos.good && !pos.long && pnl > 0) badges.push('faded_rita');
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
      const loss = p.passed_out ? Math.floor(p.coins / 10) : 0; p.coins -= loss;
      for (const m of p.npc_moves) if (this.npcs[m.npc] !== undefined) {
        const stake = m.npc.startsWith('kaito.') ? 20000 : 10000, pos = { good: m.good, long: m.long, lev: 5, stake, entry: p.prices[m.good] };
        this.npcs[m.npc] += Math.max(-stake, settle(pos, prices[m.good]));
      }
      p.prices = prices; p.commitment = null; p.weather = null; p.npc_moves = []; p.asleep = false; p.passed_out = false; p.energy = ENERGY_MAX;
      if (day >= SEASON_DAYS) {
        p.finished = true; p.won = p.coins >= DEBT; if (p.won) { p.coins -= DEBT; badges.push('debt_free'); }
        const score = p.won ? p.coins + DEBT : p.coins;
        if (p.won) p.seasons_won++; p.best_score = Math.max(p.best_score, score);
        if (score - p.start_coins > this._kaito() - p.kaito_start) badges.push('beat_kaito');
        this._rank({ account: player, season: p.season, score, day, won: p.won });
      } else p.day += 1;
      const minted = badges.filter(b => this._badge(b, player));
      const log = { day, event, prices: prices.slice(), results, coins_after: p.coins, passed_out_loss: loss, rumors, killed, grew, stall_sold, badges: minted };
      p.history.push(log); if (p.history.length > SEASON_DAYS) p.history.shift();
      return log;
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
