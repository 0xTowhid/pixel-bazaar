//! Pixel Bazaar game contract.
//!
//! What lives on chain:
//! - Player accounts: `name.<contract>` sub-accounts created by the operator, each with a
//!   function-call key limited to this contract, so the browser can play without a wallet.
//! - Each day's event is committed (sha256 of event + rumors + salt) BEFORE the player trades,
//!   and revealed at settlement. The contract checks the hash, so the outcome cannot be picked
//!   after seeing the player's positions.
//! - Leverage positions, coin balances, liquidations and the season log.
//! - Items (leverage licenses, bridge, boat pass) as NEP-245 multi-tokens.
//! - NPC accounts (`rita.<contract>` etc.) with their own on-chain positions and ledger.
//! - A leaderboard of finished seasons.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, log, near, require, AccountId, Allowance, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PublicKey,
};

pub const START_COINS: u64 = 300 * 100; // coins are stored in cents
pub const DEBT: u64 = 5000 * 100;
pub const SEASON_DAYS: u8 = 10;
pub const BASE: [u64; 4] = [20_000, 35_000, 50_000, 80_000]; // tea, fish, honey, sushi (milli-coins)
pub const GOODS: [&str; 4] = ["tea", "fish", "honey", "sushi"];
/// (good index, multiplier in per-mille) for each event id, same order as the game.
pub const EVENTS: [(usize, u64); 7] = [(1, 1500), (1, 620), (0, 620), (0, 1500), (2, 620), (2, 1500), (3, 1500)];
pub const ITEMS: [(&str, u64); 4] = [("license_x5", 250), ("license_x10", 900), ("bridge", 600), ("boat", 300)];
const PLAYER_METHODS: &str = "start_season,open_position,buy_item,claim,sleep,pay_debt";

#[derive(BorshStorageKey)]
#[near]
enum Key { Players, Balances, Supply, Npcs }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Position { pub good: u8, pub long: bool, pub lev: u8, pub stake: u64, pub entry: u64 }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Settled { pub good: u8, pub long: bool, pub lev: u8, pub stake: u64, pub pnl: i64, pub liquidated: bool }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct NpcMove { pub npc: AccountId, pub good: u8, pub long: bool }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct DayLog {
    pub day: u8, pub event: u8, pub prices: [u64; 4], pub results: Vec<Settled>,
    pub coins_after: u64, pub passed_out_loss: u64, pub rumors: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Player {
    pub season: u32, pub day: u8, pub coins: u64, pub prices: [u64; 4],
    pub positions: Vec<Position>, pub commitment: Option<String>, pub weather: Option<String>,
    pub npc_move: Option<NpcMove>, pub asleep: bool, pub passed_out: bool,
    pub fish_day: u8, pub seer_day: u8, pub chest: bool, pub finished: bool, pub won: bool,
    pub history: Vec<DayLog>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Entry { pub account: AccountId, pub season: u32, pub score: u64, pub day: u8, pub won: bool }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    operator: AccountId,
    players: LookupMap<AccountId, Player>,
    balances: LookupMap<String, u128>, // "token_id|account" -> amount (NEP-245)
    supply: LookupMap<String, u128>,
    npcs: IterableMap<AccountId, i64>, // npc account -> coin ledger (cents)
    leaderboard: Vec<Entry>,
}

fn new_player(season: u32) -> Player {
    Player {
        season, day: 1, coins: START_COINS, prices: BASE, positions: vec![], commitment: None, weather: None,
        npc_move: None, asleep: false, passed_out: false, fish_day: 0, seer_day: 0, chest: false,
        finished: false, won: false, history: vec![],
    }
}

/// Commitment string the operator hashes on day start and reveals at settlement.
pub fn commit_preimage(player: &AccountId, season: u32, day: u8, event: u8, rumors: &str, salt: &str) -> String {
    format!("{player}|{season}|{day}|{event}|{rumors}|{salt}")
}

#[near]
impl Contract {
    #[init]
    pub fn new(operator: AccountId) -> Self {
        Self {
            operator, players: LookupMap::new(Key::Players), balances: LookupMap::new(Key::Balances),
            supply: LookupMap::new(Key::Supply), npcs: IterableMap::new(Key::Npcs), leaderboard: vec![],
        }
    }

    fn assert_operator(&self) { require!(env::predecessor_account_id() == self.operator, "operator only"); }
    fn player_mut(&mut self, a: &AccountId) -> &mut Player { self.players.get_mut(a).unwrap_or_else(|| env::panic_str("not a player")) }

    // ---------------- accounts ----------------

    /// Operator creates `name.<contract>` with a function-call key the browser holds. Attach the NEAR the account should get for gas.
    #[payable]
    pub fn register_player(&mut self, name: String, public_key: PublicKey) -> Promise {
        self.assert_operator();
        let id: AccountId = format!("{name}.{}", env::current_account_id()).parse().unwrap_or_else(|_| env::panic_str("bad name"));
        require!(!self.players.contains_key(&id), "name taken");
        let deposit = env::attached_deposit();
        let allowance = Allowance::limited(NearToken::from_millinear(250)).unwrap();
        Promise::new(id.clone())
            .create_account()
            .transfer(deposit)
            .add_access_key_allowance(public_key, allowance, env::current_account_id(), PLAYER_METHODS.to_string())
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(10)).on_register(id))
    }

    #[private]
    pub fn on_register(&mut self, id: AccountId, #[callback_result] created: Result<(), PromiseError>) -> bool {
        let ok = created.is_ok();
        if ok { self.players.insert(id.clone(), new_player(1)); log!("player {} joined", id); }
        ok
    }

    /// Anyone with their own NEAR wallet can join too.
    pub fn join(&mut self) {
        let id = env::predecessor_account_id();
        if !self.players.contains_key(&id) { self.players.insert(id, new_player(1)); }
    }

    /// Operator creates a named NPC account (e.g. `rita.<contract>`) that holds its own ledger.
    #[payable]
    pub fn create_npc(&mut self, name: String) -> Promise {
        self.assert_operator();
        let id: AccountId = format!("{name}.{}", env::current_account_id()).parse().unwrap();
        self.npcs.insert(id.clone(), 1000 * 100);
        Promise::new(id).create_account().transfer(env::attached_deposit())
    }

    // ---------------- player actions ----------------

    pub fn start_season(&mut self) {
        let id = env::predecessor_account_id();
        let season = self.players.get(&id).map(|p| p.season + 1).unwrap_or_else(|| env::panic_str("not a player"));
        self.players.insert(id, new_player(season));
    }

    pub fn open_position(&mut self, good: u8, long: bool, lev: u8, stake: u64) {
        let id = env::predecessor_account_id();
        let max = self.max_lev(&id);
        let p = self.player_mut(&id);
        require!(!p.finished && !p.asleep, "day is over");
        require!(p.commitment.is_some(), "the day has not started yet");
        require!((good as usize) < 4, "bad good");
        require!([1, 2, 5, 10].contains(&lev), "bad leverage");
        require!(lev <= max, "you need a license for that leverage");
        require!(stake > 0 && stake <= p.coins, "not enough coins");
        p.coins -= stake;
        let entry = p.prices[good as usize];
        p.positions.push(Position { good, long, lev, stake, entry });
    }

    pub fn buy_item(&mut self, token_id: String) {
        let id = env::predecessor_account_id();
        let (_, cost) = *ITEMS.iter().find(|(t, _)| *t == token_id).unwrap_or_else(|| env::panic_str("unknown item"));
        require!(self.mt_balance_of(id.clone(), token_id.clone()).0 == 0, "already owned");
        let p = self.player_mut(&id);
        require!(!p.finished, "season over");
        require!(p.coins >= cost * 100, "not enough coins");
        p.coins -= cost * 100;
        self.mint(&token_id, &id, 1);
    }

    /// Small in-world rewards and costs: "fish" (+30 once a day), "chest" (+400 once, needs the boat), "seer" (-40 once a day).
    pub fn claim(&mut self, kind: String) {
        let id = env::predecessor_account_id();
        let has_boat = self.mt_balance_of(id.clone(), "boat".into()).0 > 0;
        let p = self.player_mut(&id);
        require!(!p.finished && !p.asleep, "day is over");
        match kind.as_str() {
            "fish" => { require!(p.fish_day != p.day, "already claimed today"); p.fish_day = p.day; p.coins += 30 * 100; }
            "chest" => { require!(has_boat && !p.chest, "no chest for you"); p.chest = true; p.coins += 400 * 100; }
            "seer" => { require!(p.seer_day != p.day && p.coins >= 40 * 100, "cannot pay the seer"); p.seer_day = p.day; p.coins -= 40 * 100; }
            _ => env::panic_str("unknown claim"),
        }
    }

    /// End the day. The operator then reveals the event and settles.
    pub fn sleep(&mut self, passed_out: bool) {
        let id = env::predecessor_account_id();
        let p = self.player_mut(&id);
        require!(!p.finished && !p.asleep, "already asleep");
        require!(p.commitment.is_some(), "the day has not started yet");
        p.asleep = true; p.passed_out = passed_out;
    }

    /// Pay the 5,000 debt early and win the season.
    pub fn pay_debt(&mut self) {
        let id = env::predecessor_account_id();
        let p = self.player_mut(&id);
        require!(!p.finished && p.coins >= DEBT, "not enough coins");
        p.coins -= DEBT; p.finished = true; p.won = true;
        let e = Entry { account: id, season: p.season, score: p.coins + DEBT, day: p.day, won: true };
        self.rank(e);
    }

    // ---------------- operator: commit and reveal ----------------

    pub fn commit_day(&mut self, player: AccountId, day: u8, commitment: String, weather: Option<String>, npc_move: Option<NpcMove>) {
        self.assert_operator();
        require!(commitment.len() == 64, "commitment must be a sha256 hex");
        let p = self.player_mut(&player);
        require!(!p.finished && p.day == day, "wrong day");
        require!(p.commitment.is_none(), "already committed");
        p.commitment = Some(commitment); p.weather = weather; p.npc_move = npc_move;
    }

    pub fn settle_day(&mut self, player: AccountId, day: u8, event: u8, rumors: String, salt: String) -> DayLog {
        self.assert_operator();
        let seed = env::random_seed();
        let p = self.players.get(&player).cloned().unwrap_or_else(|| env::panic_str("not a player"));
        require!(p.day == day && p.asleep && !p.finished, "nothing to settle");
        let c = p.commitment.clone().unwrap_or_else(|| env::panic_str("no commitment"));
        let hash = hex::encode(env::sha256(commit_preimage(&player, p.season, day, event, &rumors, &salt).as_bytes()));
        require!(hash == c, "reveal does not match the commitment");
        require!((event as usize) < EVENTS.len(), "bad event");
        let mut p = p;

        // prices: drift back toward normal, a little noise, then the event
        let (eg, em) = EVENTS[event as usize];
        let mut prices = p.prices;
        for i in 0..4 {
            let b = BASE[i] as i128; let mut x = prices[i] as i128;
            x += (b - x) * 40 / 100;
            let noise = (seed[i] as i128 % 101) - 50; // -5.0% .. +5.0%
            x = x * (1000 + noise) / 1000;
            if i == eg { x = x * em as i128 / 1000; }
            prices[i] = x.max(1) as u64;
        }
        // settle positions
        let mut results = vec![];
        for pos in p.positions.drain(..) {
            let pnl = settle(&pos, prices[pos.good as usize]);
            let liquidated = pnl <= -(pos.stake as i64);
            let pnl = if liquidated { -(pos.stake as i64) } else { pnl };
            p.coins = (p.coins as i64 + pos.stake as i64 + pnl).max(0) as u64;
            results.push(Settled { good: pos.good, long: pos.long, lev: pos.lev, stake: pos.stake, pnl, liquidated });
        }
        let loss = if p.passed_out { p.coins / 10 } else { 0 };
        p.coins -= loss;
        // NPC trade (e.g. Rita's short) settles against the same prices
        if let Some(m) = p.npc_move.clone() {
            if let Some(led) = self.npcs.get_mut(&m.npc) {
                let pos = Position { good: m.good, long: m.long, lev: 5, stake: 100 * 100, entry: p.prices[m.good as usize] };
                *led += settle(&pos, prices[m.good as usize]).max(-(pos.stake as i64));
            }
        }
        let log = DayLog { day, event, prices, results, coins_after: p.coins, passed_out_loss: loss, rumors };
        p.history.push(log.clone());
        p.prices = prices; p.commitment = None; p.weather = None; p.npc_move = None; p.asleep = false; p.passed_out = false;
        if day >= SEASON_DAYS {
            p.finished = true; p.won = p.coins >= DEBT;
            if p.won { p.coins -= DEBT; }
            let score = if p.won { p.coins + DEBT } else { p.coins };
            self.rank(Entry { account: player.clone(), season: p.season, score, day, won: p.won });
        } else { p.day += 1; }
        self.players.insert(player, p);
        log
    }

    fn rank(&mut self, e: Entry) {
        self.leaderboard.push(e);
        self.leaderboard.sort_by(|a, b| b.won.cmp(&a.won).then(b.score.cmp(&a.score)).then(a.day.cmp(&b.day)));
        self.leaderboard.truncate(20);
    }

    fn max_lev(&self, id: &AccountId) -> u8 {
        if self.mt_balance_of(id.clone(), "license_x10".into()).0 > 0 { 10 }
        else if self.mt_balance_of(id.clone(), "license_x5".into()).0 > 0 { 5 } else { 2 }
    }

    // ---------------- NEP-245 multi-token (items) ----------------

    fn mint(&mut self, token: &str, owner: &AccountId, amount: u128) {
        *self.balances.entry(format!("{token}|{owner}")).or_insert(0) += amount;
        *self.supply.entry(token.to_string()).or_insert(0) += amount;
        log!(r#"EVENT_JSON:{{"standard":"nep245","version":"1.0.0","event":"mt_mint","data":[{{"owner_id":"{}","token_ids":["{}"],"amounts":["{}"]}}]}}"#, owner, token, amount);
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        U128(*self.balances.get(&format!("{token_id}|{account_id}")).unwrap_or(&0))
    }
    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> {
        token_ids.into_iter().map(|t| self.mt_balance_of(account_id.clone(), t)).collect()
    }
    pub fn mt_supply(&self, token_id: String) -> Option<U128> { self.supply.get(&token_id).map(|s| U128(*s)) }

    /// Items are tradeable: hand a license or boat pass to another account. Needs 1 yoctoNEAR (wallet signature).
    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        require!(env::attached_deposit() == NearToken::from_yoctonear(1), "requires 1 yoctoNEAR");
        require!(approval.is_none(), "approvals not supported");
        let from = env::predecessor_account_id();
        let k = format!("{token_id}|{from}");
        let bal = *self.balances.get(&k).unwrap_or(&0);
        require!(bal >= amount.0 && amount.0 > 0, "not enough balance");
        self.balances.insert(k, bal - amount.0);
        *self.balances.entry(format!("{token_id}|{receiver_id}")).or_insert(0) += amount.0;
        log!(r#"EVENT_JSON:{{"standard":"nep245","version":"1.0.0","event":"mt_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","token_ids":["{}"],"amounts":["{}"]{}}}]}}"#,
            from, receiver_id, token_id, amount.0, memo.map(|m| format!(r#","memo":"{}""#, m.replace('"', "'"))).unwrap_or_default());
    }

    // ---------------- views ----------------

    pub fn get_player(&self, account_id: AccountId) -> Option<Player> { self.players.get(&account_id).cloned() }
    pub fn get_leaderboard(&self) -> Vec<Entry> { self.leaderboard.clone() }
    pub fn get_npcs(&self) -> Vec<(AccountId, i64)> { self.npcs.iter().map(|(a, c)| (a.clone(), *c)).collect() }
    pub fn get_operator(&self) -> AccountId { self.operator.clone() }
}

/// Profit or loss of a position at a new price (cents, before liquidation clamp).
pub fn settle(p: &Position, price: u64) -> i64 {
    let mv = (price as i128 - p.entry as i128) * 1_000_000 / p.entry as i128; // per-million
    let dir = if p.long { 1 } else { -1 };
    (p.stake as i128 * p.lev as i128 * mv * dir / 1_000_000) as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(who: AccountId) { testing_env!(VMContextBuilder::new().current_account_id("bazaar.testnet".parse().unwrap()).predecessor_account_id(who).build()); }
    fn op() -> AccountId { accounts(0) }
    fn pl() -> AccountId { accounts(1) }
    fn setup() -> Contract { ctx(op()); let mut c = Contract::new(op()); ctx(pl()); c.join(); c }
    fn commit(c: &mut Contract, day: u8, event: u8, salt: &str) {
        let season = c.get_player(pl()).unwrap().season;
        let h = hex::encode(env::sha256(commit_preimage(&pl(), season, day, event, "r", salt).as_bytes()));
        ctx(op()); c.commit_day(pl(), day, h, None, None); ctx(pl());
    }

    #[test]
    fn long_wins_on_storm() {
        let mut c = setup();
        commit(&mut c, 1, 0, "s1"); // storm: fish x1.5
        c.open_position(1, true, 2, 100 * 100);
        c.sleep(false);
        ctx(op()); let log = c.settle_day(pl(), 1, 0, "r".into(), "s1".into());
        assert!(log.results[0].pnl > 0 && !log.results[0].liquidated);
        let p = c.get_player(pl()).unwrap();
        assert_eq!(p.day, 2); assert!(p.coins > START_COINS);
    }

    #[test]
    fn high_leverage_wrong_way_is_liquidated() {
        let mut c = setup();
        ctx(pl()); c.players.get_mut(&pl()).unwrap().coins = 2000 * 100;
        c.buy_item("license_x5".into()); c.buy_item("license_x10".into());
        commit(&mut c, 1, 1, "s"); // record catch: fish x0.62
        c.open_position(1, true, 10, 100 * 100);
        c.sleep(false);
        ctx(op()); let log = c.settle_day(pl(), 1, 1, "r".into(), "s".into());
        assert!(log.results[0].liquidated); assert_eq!(log.results[0].pnl, -10000);
    }

    #[test]
    #[should_panic(expected = "reveal does not match")]
    fn operator_cannot_change_the_event() {
        let mut c = setup();
        commit(&mut c, 1, 0, "s");
        c.open_position(1, false, 2, 100 * 100);
        c.sleep(false);
        ctx(op()); c.settle_day(pl(), 1, 1, "r".into(), "s".into()); // tries to swap storm for a crash
    }

    #[test]
    #[should_panic(expected = "license")]
    fn leverage_needs_license() {
        let mut c = setup();
        commit(&mut c, 1, 0, "s");
        c.open_position(1, true, 5, 100);
    }

    #[test]
    #[should_panic(expected = "not started")]
    fn cannot_trade_before_commit() { let mut c = setup(); c.open_position(1, true, 2, 100); }

    #[test]
    fn items_are_nep245_balances() {
        let mut c = setup();
        c.buy_item("boat".into());
        assert_eq!(c.mt_balance_of(pl(), "boat".into()).0, 1);
        assert_eq!(c.mt_supply("boat".into()).unwrap().0, 1);
        commit(&mut c, 1, 0, "s"); c.claim("chest".into());
        assert_eq!(c.get_player(pl()).unwrap().coins, START_COINS - 300 * 100 + 400 * 100);
    }

    #[test]
    fn season_ends_and_ranks() {
        let mut c = setup();
        for d in 1..=SEASON_DAYS {
            commit(&mut c, d, 6, "x"); c.sleep(d == 3);
            ctx(op()); c.settle_day(pl(), d, 6, "r".into(), "x".into()); ctx(pl());
        }
        let p = c.get_player(pl()).unwrap();
        assert!(p.finished && !p.won); assert_eq!(c.get_leaderboard().len(), 1);
        assert!(p.history[2].passed_out_loss > 0);
    }

    #[test]
    fn early_payoff_wins() {
        let mut c = setup();
        c.players.get_mut(&pl()).unwrap().coins = 6000 * 100;
        c.pay_debt();
        let p = c.get_player(pl()).unwrap(); assert!(p.won && p.finished); assert_eq!(p.coins, 1000 * 100);
    }
}
