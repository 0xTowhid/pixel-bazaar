// JavaScript mirror of the NEAR contract (contract/src/lib.rs). Same units, same rules.
// Used for the offline build in the browser and as a stand-in contract for local testing of the server.
(function (root) {
  'use strict';
  const START_COINS = 300 * 100, DEBT = 5000 * 100, SEASON_DAYS = 10;
  const BASE = [20000, 35000, 50000, 80000];
  const EVENTS = [[1, 1500], [1, 620], [0, 620], [0, 1500], [2, 620], [2, 1500], [3, 1500]];
  const ITEMS = { license_x5: 250, license_x10: 900, bridge: 600, boat: 300 };

  const fail = m => { throw new Error(m); };
  const newPlayer = season => ({ season, day: 1, coins: START_COINS, prices: BASE.slice(), positions: [], commitment: null, weather: null, npc_move: null,
    asleep: false, passed_out: false, fish_day: 0, seer_day: 0, chest: false, finished: false, won: false, history: [] });
  const preimage = (player, season, day, event, rumors, salt) => `${player}|${season}|${day}|${event}|${rumors}|${salt}`;
  function settle(pos, price) {
    const mv = Math.trunc((price - pos.entry) * 1e6 / pos.entry);
    return Math.trunc(pos.stake * pos.lev * mv * (pos.long ? 1 : -1) / 1e6);
  }

  class Engine {
    constructor(operator, contractId, sha256hex) {
      this.operator = operator; this.contractId = contractId; this.sha = sha256hex || null;
      this.players = {}; this.balances = {}; this.supply = {}; this.npcs = {}; this.leaderboard = [];
    }
    _p(a) { return this.players[a] || fail('not a player'); }
    _op(caller) { if (caller !== this.operator) fail('operator only'); }
    _maxLev(a) { return this.mt_balance_of(a, 'license_x10') > 0 ? 10 : this.mt_balance_of(a, 'license_x5') > 0 ? 5 : 2; }
    // accounts
    register_player(caller, name) { this._op(caller); const id = `${name}.${this.contractId}`; if (this.players[id]) fail('name taken'); this.players[id] = newPlayer(1); return id; }
    join(caller) { if (!this.players[caller]) this.players[caller] = newPlayer(1); }
    create_npc(caller, name) { this._op(caller); this.npcs[`${name}.${this.contractId}`] = 1000 * 100; }
    // player actions
    start_season(caller) { const p = this._p(caller); this.players[caller] = newPlayer(p.season + 1); }
    open_position(caller, { good, long, lev, stake }) {
      const max = this._maxLev(caller), p = this._p(caller);
      if (p.finished || p.asleep) fail('day is over');
      if (!p.commitment) fail('the day has not started yet');
      if (!(good >= 0 && good < 4)) fail('bad good');
      if (![1, 2, 5, 10].includes(lev)) fail('bad leverage');
      if (lev > max) fail('you need a license for that leverage');
      if (!(stake > 0 && stake <= p.coins)) fail('not enough coins');
      p.coins -= stake; p.positions.push({ good, long, lev, stake, entry: p.prices[good] });
    }
    buy_item(caller, { token_id }) {
      const cost = ITEMS[token_id]; if (cost === undefined) fail('unknown item');
      if (this.mt_balance_of(caller, token_id) > 0) fail('already owned');
      const p = this._p(caller); if (p.finished) fail('season over'); if (p.coins < cost * 100) fail('not enough coins');
      p.coins -= cost * 100; this._mint(token_id, caller, 1);
    }
    claim(caller, { kind }) {
      const boat = this.mt_balance_of(caller, 'boat') > 0, p = this._p(caller);
      if (p.finished || p.asleep) fail('day is over');
      if (kind === 'fish') { if (p.fish_day === p.day) fail('already claimed today'); p.fish_day = p.day; p.coins += 3000; }
      else if (kind === 'chest') { if (!boat || p.chest) fail('no chest for you'); p.chest = true; p.coins += 40000; }
      else if (kind === 'seer') { if (p.seer_day === p.day || p.coins < 4000) fail('cannot pay the seer'); p.seer_day = p.day; p.coins -= 4000; }
      else fail('unknown claim');
    }
    sleep(caller, { passed_out }) { const p = this._p(caller); if (p.finished || p.asleep) fail('already asleep'); if (!p.commitment) fail('the day has not started yet'); p.asleep = true; p.passed_out = !!passed_out; }
    pay_debt(caller) {
      const p = this._p(caller); if (p.finished || p.coins < DEBT) fail('not enough coins');
      p.coins -= DEBT; p.finished = true; p.won = true;
      this._rank({ account: caller, season: p.season, score: p.coins + DEBT, day: p.day, won: true });
    }
    // operator
    commit_day(caller, { player, day, commitment, weather, npc_move }) {
      this._op(caller); const p = this._p(player);
      if (!commitment || commitment.length !== 64) fail('commitment must be a sha256 hex');
      if (p.finished || p.day !== day) fail('wrong day'); if (p.commitment) fail('already committed');
      p.commitment = commitment; p.weather = weather || null; p.npc_move = npc_move || null;
    }
    settle_day(caller, { player, day, event, rumors, salt }) {
      this._op(caller); const p = this._p(player);
      if (!(p.day === day && p.asleep && !p.finished)) fail('nothing to settle');
      if (!p.commitment) fail('no commitment');
      if (this.sha && this.sha(preimage(player, p.season, day, event, rumors, salt)) !== p.commitment) fail('reveal does not match the commitment');
      const [eg, em] = EVENTS[event];
      const prices = p.prices.map((x, i) => {
        x = x + Math.trunc((BASE[i] - x) * 40 / 100);
        const noise = Math.floor(Math.random() * 101) - 50; x = Math.trunc(x * (1000 + noise) / 1000);
        if (i === eg) x = Math.trunc(x * em / 1000);
        return Math.max(1, x);
      });
      const results = p.positions.map(pos => {
        let pnl = settle(pos, prices[pos.good]); const liquidated = pnl <= -pos.stake; if (liquidated) pnl = -pos.stake;
        p.coins = Math.max(0, p.coins + pos.stake + pnl);
        return { good: pos.good, long: pos.long, lev: pos.lev, stake: pos.stake, pnl, liquidated };
      });
      p.positions = [];
      const loss = p.passed_out ? Math.floor(p.coins / 10) : 0; p.coins -= loss;
      if (p.npc_move && this.npcs[p.npc_move.npc] !== undefined) {
        const m = p.npc_move, pos = { good: m.good, long: m.long, lev: 5, stake: 10000, entry: p.prices[m.good] };
        this.npcs[m.npc] += Math.max(-pos.stake, settle(pos, prices[m.good]));
      }
      const log = { day, event, prices, results, coins_after: p.coins, passed_out_loss: loss, rumors };
      p.history.push(log); p.prices = prices; p.commitment = null; p.weather = null; p.npc_move = null; p.asleep = false; p.passed_out = false;
      if (day >= SEASON_DAYS) {
        p.finished = true; p.won = p.coins >= DEBT; if (p.won) p.coins -= DEBT;
        this._rank({ account: player, season: p.season, score: p.won ? p.coins + DEBT : p.coins, day, won: p.won });
      } else p.day += 1;
      return log;
    }
    _rank(e) { this.leaderboard.push(e); this.leaderboard.sort((a, b) => (b.won - a.won) || (b.score - a.score) || (a.day - b.day)); this.leaderboard.length = Math.min(20, this.leaderboard.length); }
    _mint(t, owner, n) { const k = t + '|' + owner; this.balances[k] = (this.balances[k] || 0) + n; this.supply[t] = (this.supply[t] || 0) + n; }
    // views
    mt_balance_of(account_id, token_id) { return this.balances[token_id + '|' + account_id] || 0; }
    get_player(account_id) { const p = this.players[account_id]; return p ? JSON.parse(JSON.stringify(p)) : null; }
    get_leaderboard() { return this.leaderboard.slice(); }
    get_npcs() { return Object.entries(this.npcs); }
  }
  const api = { Engine, preimage, START_COINS, DEBT, SEASON_DAYS, ITEMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BazaarEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
