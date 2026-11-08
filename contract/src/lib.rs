//! Pixel Bazaar game contract (v2: farming, mining, fishing, friends, Kaito, town projects, badges).
//!
//! On chain:
//! - Player accounts `name.<contract>` with a browser-held function-call key (created by the operator).
//! - Each day's event is committed (sha256 of event + rumors + salt) before the player can act, and revealed
//!   at settlement; the contract rejects a reveal that does not match.
//! - Coins, prices, leverage positions, liquidations, farm plots, seeds, energy, friendships, town projects.
//! - Goods in your barn, items (licenses, bridge, boat, stall) and achievement badges are NEP-245 tokens.
//! - NPC accounts (`rita.<contract>`, `kaito.<contract>`) with their own trades and ledgers.
//! Numbers match shared/rules.js and shared/engine.js.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, log, near, require, AccountId, Allowance, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey};

pub const START_COINS: u64 = 300 * 100; // coins are stored in cents
pub const DEBT: u64 = 5000 * 100;
pub const SEASON_DAYS: u8 = 10;
pub const NG: usize = 13;
pub const GOODS: [&str; NG] = ["tea", "fish", "honey", "sushi", "carrot", "strawberry", "pumpkin", "tomato", "corn", "eggplant", "apple", "jade", "ore"];
pub const BASE: [u64; NG] = [20_000, 35_000, 50_000, 80_000, 15_000, 30_000, 60_000, 25_000, 20_000, 35_000, 40_000, 120_000, 12_000]; // milli-coins
/// Event effects: (good, multiplier per-mille).
pub const EVENTS: [&[(usize, u64)]; 10] = [
    &[(1, 1500)], &[(1, 620)], &[(0, 620)], &[(0, 1500)], &[(2, 620)], &[(2, 1500)],
    &[(3, 1500), (6, 1300)], &[(6, 1500), (8, 1400)], &[(5, 600)], &[(4, 1450), (7, 1450), (9, 1300)],
];
pub const EV_STORM: u8 = 0;
pub const EV_BLIGHT: u8 = 3;
pub const EV_COLD: u8 = 5;
/// Crops: (good, watered days to ripen, seed cost in coins, yield, regrow days (0 = one harvest), needs water)
pub const CROPS: [(usize, u8, u64, u32, u8, bool); 9] = [
    (4, 2, 6, 2, 0, true), (5, 3, 10, 3, 0, true), (6, 4, 22, 2, 0, true), (7, 3, 8, 3, 0, true), (8, 2, 6, 2, 0, true),
    (9, 3, 12, 2, 0, true), (0, 2, 5, 3, 0, true), (10, 4, 80, 3, 2, true), (2, 2, 60, 2, 2, false),
];
pub const ITEMS: [(&str, u64); 5] = [("license_x5", 250), ("license_x10", 900), ("bridge", 600), ("boat", 300), ("stall", 1500)];
pub const PLOT_COST: u64 = 120;
pub const MAX_PLOTS: usize = 18;
pub const START_PLOTS: usize = 6;
pub const BARN_CAP: u128 = 40;
pub const NPCS: usize = 8;
pub const ROCKS: u8 = 8;
pub const ENERGY_MAX: u16 = 100;
/// Town projects: (goods needed, coins needed)
pub const PROJECTS: [(&[(usize, u32)], u64); 3] = [(&[(1, 30), (11, 5)], 400), (&[(12, 10), (11, 8)], 0), (&[(0, 40)], 600)];
const PLAYER_METHODS: &str = "start_season,open_position,buy_item,claim,sleep,pay_debt,act";

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
#[derive(Clone, Default)]
pub struct Plot { pub crop: Option<u8>, pub grown: u8, pub watered_day: u8 }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct DayLog {
    pub day: u8, pub event: u8, pub prices: Vec<u64>, pub results: Vec<Settled>, pub coins_after: u64, pub passed_out_loss: u64,
    pub rumors: String, pub killed: u8, pub grew: u8, pub stall_sold: u64, pub badges: Vec<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Player {
    pub season: u32, pub day: u8, pub coins: u64, pub prices: Vec<u64>, pub positions: Vec<Position>,
    pub commitment: Option<String>, pub weather: Option<String>, pub npc_moves: Vec<NpcMove>,
    pub asleep: bool, pub passed_out: bool, pub fish_day: u8, pub seer_day: u8, pub chest: bool, pub finished: bool, pub won: bool,
    pub history: Vec<DayLog>,
    // farm and life sim (kept between seasons)
    pub energy: u16, pub plots: Vec<Plot>, pub seeds: Vec<u16>, pub friendship: Vec<u8>, pub gift_day: Vec<u8>,
    pub projects: Vec<bool>, pub donated: Vec<Vec<u32>>, pub mined_day: u8, pub mined: u32, pub catches_today: u8, pub cat_day: u8,
    pub harvested: u32, pub jade_found: u32, pub fish_caught: u32, pub kaito_start: i64, pub start_coins: u64,
}

#[near(serializers = [json])]
#[derive(Clone)]
#[serde(tag = "t")]
pub enum Action {
    Plant { plot: u8, crop: u8 }, Water { plot: u8 }, Harvest { plot: u8 }, Mine { rock: u8 }, Fish { ok: bool }, Cat,
    Sell { good: u8, qty: u32 }, Gift { npc: u8, good: u8 }, Donate { project: u8, coins: u64 }, BuySeed { crop: u8, qty: u16 }, BuyPlot,
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
        season, day: 1, coins: START_COINS, prices: BASE.to_vec(), positions: vec![], commitment: None, weather: None, npc_moves: vec![],
        asleep: false, passed_out: false, fish_day: 0, seer_day: 0, chest: false, finished: false, won: false, history: vec![],
        energy: ENERGY_MAX, plots: vec![Plot::default(); START_PLOTS], seeds: {
            let mut s = vec![0u16; CROPS.len()]; s[0] = 4; s[4] = 2; s // a few carrot and corn seeds to start
        },
        friendship: vec![0; NPCS], gift_day: vec![0; NPCS], projects: vec![false; PROJECTS.len()], donated: vec![vec![0; NG + 1]; PROJECTS.len()],
        mined_day: 0, mined: 0, catches_today: 0, cat_day: 0, harvested: 0, jade_found: 0, fish_caught: 0, kaito_start: 0, start_coins: START_COINS,
    }
}
/// Commitment string the operator hashes on day start and reveals at settlement.
pub fn commit_preimage(player: &AccountId, season: u32, day: u8, event: u8, rumors: &str, salt: &str) -> String {
    format!("{player}|{season}|{day}|{event}|{rumors}|{salt}")
}
/// Profit or loss of a position at a new price (cents, before liquidation clamp).
pub fn settle(p: &Position, price: u64) -> i64 {
    let mv = (price as i128 - p.entry as i128) * 1_000_000 / p.entry as i128;
    let dir = if p.long { 1 } else { -1 };
    (p.stake as i128 * p.lev as i128 * mv * dir / 1_000_000) as i64
}
fn ripe(pl: &Plot) -> bool { pl.crop.map(|c| pl.grown >= CROPS[c as usize].1).unwrap_or(false) }

#[near]
impl Contract {
    #[init]
    pub fn new(operator: AccountId) -> Self {
        Self { operator, players: LookupMap::new(Key::Players), balances: LookupMap::new(Key::Balances), supply: LookupMap::new(Key::Supply), npcs: IterableMap::new(Key::Npcs), leaderboard: vec![] }
    }
    fn assert_operator(&self) { require!(env::predecessor_account_id() == self.operator, "operator only"); }
    fn kaito(&self) -> AccountId { format!("kaito.{}", env::current_account_id()).parse().unwrap() }
    fn kaito_ledger(&self) -> i64 { self.npcs.get(&self.kaito()).copied().unwrap_or(0) }

    // ---------------- accounts ----------------
    #[payable]
    pub fn register_player(&mut self, name: String, public_key: PublicKey) -> Promise {
        self.assert_operator();
        let id: AccountId = format!("{name}.{}", env::current_account_id()).parse().unwrap_or_else(|_| env::panic_str("bad name"));
        require!(!self.players.contains_key(&id), "name taken");
        Promise::new(id.clone()).create_account().transfer(env::attached_deposit())
            .add_access_key_allowance(public_key, Allowance::Unlimited, env::current_account_id(), PLAYER_METHODS.to_string())
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(10)).on_register(id))
    }
    #[private]
    pub fn on_register(&mut self, id: AccountId, #[callback_result] created: Result<(), PromiseError>) -> bool {
        let ok = created.is_ok();
        if ok { let mut p = new_player(1); p.kaito_start = self.kaito_ledger(); self.players.insert(id.clone(), p); log!("player {} joined", id); }
        ok
    }
    pub fn join(&mut self) {
        let id = env::predecessor_account_id();
        if !self.players.contains_key(&id) { let mut p = new_player(1); p.kaito_start = self.kaito_ledger(); self.players.insert(id, p); }
    }
    #[payable]
    pub fn create_npc(&mut self, name: String) -> Promise {
        self.assert_operator();
        let id: AccountId = format!("{name}.{}", env::current_account_id()).parse().unwrap();
        self.npcs.insert(id.clone(), 1000 * 100);
        Promise::new(id).create_account().transfer(env::attached_deposit())
    }

    // ---------------- player actions ----------------
    /// New season: coins, debt and prices reset. Farm, seeds, friends, projects, items and badges are kept.
    pub fn start_season(&mut self) {
        let id = env::predecessor_account_id();
        let k = self.kaito_ledger();
        let old = self.players.get(&id).cloned().unwrap_or_else(|| env::panic_str("not a player"));
        let mut p = new_player(old.season + 1);
        p.plots = old.plots.into_iter().map(|mut pl| { pl.watered_day = 0; pl }).collect();
        p.seeds = old.seeds; p.friendship = old.friendship; p.projects = old.projects; p.donated = old.donated;
        p.harvested = old.harvested; p.jade_found = old.jade_found; p.fish_caught = old.fish_caught; p.kaito_start = k;
        self.players.insert(id, p);
    }

    pub fn open_position(&mut self, good: u8, long: bool, lev: u8, stake: u64) {
        let id = env::predecessor_account_id();
        let max = self.max_lev(&id);
        let p = self.player_mut(&id);
        require!(!p.finished && !p.asleep, "day is over");
        require!(p.commitment.is_some(), "the day has not started yet");
        require!((good as usize) < NG, "bad good");
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
        require!(self.bal(&token_id, &id) == 0, "already owned");
        let p = self.player_mut(&id);
        require!(!p.finished, "season over");
        require!(p.coins >= cost * 100, "not enough coins");
        p.coins -= cost * 100;
        self.mint(&token_id, &id, 1);
    }

    /// "fisherman" (+30 once a day), "chest" (+400 once a season, needs the boat), "seer" (-40 once a day).
    pub fn claim(&mut self, kind: String) {
        let id = env::predecessor_account_id();
        let has_boat = self.bal("boat", &id) > 0;
        let p = self.player_mut(&id);
        require!(!p.finished && !p.asleep, "day is over");
        match kind.as_str() {
            "fisherman" | "fish" => { require!(p.fish_day != p.day, "already claimed today"); p.fish_day = p.day; p.coins += 30 * 100; }
            "chest" => { require!(has_boat && !p.chest, "no chest for you"); p.chest = true; p.coins += 400 * 100; }
            "seer" => { require!(p.seer_day != p.day && p.coins >= 40 * 100, "cannot pay the seer"); p.seer_day = p.day; p.coins -= 40 * 100; }
            _ => env::panic_str("unknown claim"),
        }
    }

    /// Farm, mine, fish, sell, gift, donate: many small moves in one transaction, all or nothing.
    pub fn act(&mut self, actions: Vec<Action>) {
        let id = env::predecessor_account_id();
        require!(!actions.is_empty() && actions.len() <= 60, "1 to 60 actions");
        let mut p = self.players.get(&id).cloned().unwrap_or_else(|| env::panic_str("not a player"));
        require!(!p.finished && !p.asleep, "day is over");
        let seed = env::random_seed();
        let mut badges: Vec<&str> = vec![];
        for (i, a) in actions.into_iter().enumerate() {
            match a {
                Action::Plant { plot, crop } => {
                    use_energy(&mut p, 2);
                    let c = crop as usize; require!(c < CROPS.len() && p.seeds[c] > 0, "no seeds of that kind");
                    let pl = p.plots.get_mut(plot as usize).unwrap_or_else(|| env::panic_str("no such plot"));
                    require!(pl.crop.is_none(), "plot is not empty");
                    *pl = Plot { crop: Some(crop), grown: 0, watered_day: 0 }; p.seeds[c] -= 1;
                }
                Action::Water { plot } => {
                    use_energy(&mut p, 1);
                    let day = p.day;
                    let pl = p.plots.get_mut(plot as usize).unwrap_or_else(|| env::panic_str("no such plot"));
                    require!(pl.crop.is_some() && pl.watered_day != day, "nothing to water");
                    pl.watered_day = day;
                }
                Action::Harvest { plot } => {
                    use_energy(&mut p, 1);
                    let pl = p.plots.get(plot as usize).cloned().unwrap_or_else(|| env::panic_str("no such plot"));
                    require!(ripe(&pl), "not ripe yet");
                    let (good, days, _, yld, regrow, _) = CROPS[pl.crop.unwrap() as usize];
                    self.barn_add(&id, good, yld);
                    p.plots[plot as usize] = if regrow > 0 { Plot { crop: pl.crop, grown: days - regrow, watered_day: pl.watered_day } } else { Plot::default() };
                    p.harvested += yld;
                    if p.harvested == yld { badges.push("first_harvest"); }
                    if p.harvested >= 50 && p.harvested - yld < 50 { badges.push("green_thumb"); }
                }
                Action::Mine { rock } => {
                    use_energy(&mut p, 8);
                    require!(rock < ROCKS, "no such rock");
                    if p.mined_day != p.day { p.mined_day = p.day; p.mined = 0; }
                    require!(p.mined & (1 << rock) == 0, "already mined today");
                    p.mined |= 1 << rock;
                    let r = seed[(rock as usize + i) % 32];
                    if r < 64 { self.barn_add(&id, 11, 1); p.jade_found += 1; if p.jade_found == 5 { badges.push("jade_hunter"); } }
                    else if r < 200 { self.barn_add(&id, 12, 1); }
                    else { p.seeds[(r % 7) as usize] += 2; }
                }
                Action::Fish { ok } => {
                    use_energy(&mut p, 4);
                    require!(p.catches_today < 6, "the fish stopped biting for today");
                    p.catches_today += 1;
                    if ok {
                        let n = if p.projects[0] { 2 } else { 1 };
                        self.barn_add(&id, 1, n); p.fish_caught += n;
                        if p.fish_caught >= 10 && p.fish_caught - n < 10 { badges.push("angler"); }
                    }
                }
                Action::Cat => {
                    require!(p.cat_day != p.day, "Mochi already found something today");
                    p.cat_day = p.day;
                    let r = seed[(i + 7) % 32];
                    if r < 128 { p.coins += 10 * 100; } else { p.seeds[(r % 7) as usize] += 1; }
                }
                Action::Sell { good, qty } => {
                    let g = good as usize; require!(g < NG && g != 3 && qty > 0, "cannot sell that");
                    let have = self.bal(GOODS[g], &id); require!(have >= qty as u128, "not enough in your barn");
                    self.burn(GOODS[g], &id, qty as u128);
                    let bonus = if g == 0 && p.projects[2] { 115 } else { 100 };
                    for _ in 0..qty {
                        p.coins += p.prices[g] / 10 * bonus / 100; // milli-coins -> cents
                        p.prices[g] = p.prices[g] * 98 / 100;
                    }
                }
                Action::Gift { npc, good } => {
                    let n = npc as usize; require!(n < NPCS, "no such person");
                    require!(p.gift_day[n] != p.day, "one gift a day");
                    require!(self.bal(GOODS[good as usize], &id) >= 1, "you don't have that");
                    self.burn(GOODS[good as usize], &id, 1);
                    p.gift_day[n] = p.day;
                    let liked = if good >= 4 && good <= 10 { 15 } else { 10 };
                    let before = p.friendship[n];
                    p.friendship[n] = (p.friendship[n] as u16 + liked).min(100) as u8;
                    if before < 100 && p.friendship[n] >= 100 { badges.push("best_friend"); }
                }
                Action::Donate { project, coins: give_coins } => {
                    let j = project as usize; require!(j < PROJECTS.len() && !p.projects[j], "nothing to donate to");
                    let (need, coins) = PROJECTS[j];
                    for &(g, n) in need.iter() {
                        let missing = n.saturating_sub(p.donated[j][g]);
                        let give = (self.bal(GOODS[g], &id) as u32).min(missing);
                        if give > 0 { self.burn(GOODS[g], &id, give as u128); p.donated[j][g] += give; }
                    }
                    let cmissing = (coins * 100).saturating_sub(p.donated[j][NG] as u64);
                    let cgive = (give_coins * 100).min(cmissing); require!(p.coins >= cgive, "not enough coins");
                    p.coins -= cgive; p.donated[j][NG] += cgive as u32;
                    if need.iter().all(|&(g, n)| p.donated[j][g] >= n) && p.donated[j][NG] as u64 >= coins * 100 { p.projects[j] = true; badges.push("restorer"); }
                }
                Action::BuySeed { crop, qty } => {
                    let c = crop as usize; require!(c < CROPS.len() && qty > 0 && qty <= 50, "bad seed order");
                    let cost = CROPS[c].2 * 100 * qty as u64; require!(p.coins >= cost, "not enough coins");
                    p.coins -= cost; p.seeds[c] += qty;
                }
                Action::BuyPlot => {
                    require!(p.plots.len() < MAX_PLOTS, "no more land"); require!(p.coins >= PLOT_COST * 100, "not enough coins");
                    p.coins -= PLOT_COST * 100; p.plots.push(Plot::default());
                }
            }
        }
        for b in badges { self.badge(b, &id); }
        self.players.insert(id, p);
    }

    pub fn sleep(&mut self, passed_out: bool) {
        let id = env::predecessor_account_id();
        let p = self.player_mut(&id);
        require!(!p.finished && !p.asleep, "already asleep");
        require!(p.commitment.is_some(), "the day has not started yet");
        p.asleep = true; p.passed_out = passed_out;
    }

    pub fn pay_debt(&mut self) {
        let id = env::predecessor_account_id();
        let k = self.kaito_ledger();
        let p = self.player_mut(&id);
        require!(!p.finished && p.coins >= DEBT, "not enough coins");
        p.coins -= DEBT; p.finished = true; p.won = true;
        let (season, coins, day, beat) = (p.season, p.coins, p.day, (p.coins + DEBT) as i64 - p.start_coins as i64 > k - p.kaito_start);
        self.badge("debt_free", &id);
        if day <= 6 { self.badge("early_bird", &id); }
        if beat { self.badge("beat_kaito", &id); }
        self.rank(Entry { account: id, season, score: coins + DEBT, day, won: true });
    }

    // ---------------- operator: commit and reveal ----------------
    pub fn commit_day(&mut self, player: AccountId, day: u8, commitment: String, weather: Option<String>, npc_moves: Vec<NpcMove>) {
        self.assert_operator();
        require!(commitment.len() == 64, "commitment must be a sha256 hex");
        let p = self.player_mut(&player);
        require!(!p.finished && p.day == day, "wrong day");
        require!(p.commitment.is_none(), "already committed");
        if p.mined_day != day { p.mined = 0; }
        p.catches_today = 0;
        p.commitment = Some(commitment); p.weather = weather; p.npc_moves = npc_moves;
    }

    pub fn settle_day(&mut self, player: AccountId, day: u8, event: u8, rumors: String, salt: String) -> DayLog {
        self.assert_operator();
        let seed = env::random_seed();
        let mut p = self.players.get(&player).cloned().unwrap_or_else(|| env::panic_str("not a player"));
        require!(p.day == day && p.asleep && !p.finished, "nothing to settle");
        let c = p.commitment.clone().unwrap_or_else(|| env::panic_str("no commitment"));
        let hash = hex::encode(env::sha256(commit_preimage(&player, p.season, day, event, &rumors, &salt).as_bytes()));
        require!(hash == c, "reveal does not match the commitment");
        require!((event as usize) < EVENTS.len(), "bad event");

        // prices: drift back toward normal, a little noise, then the event
        let mut prices = p.prices.clone();
        for i in 0..NG {
            let b = BASE[i] as i128; let mut x = prices[i] as i128;
            x += (b - x) * 40 / 100;
            x = x * (1000 + (seed[i % 32] as i128 % 101) - 50) / 1000;
            prices[i] = x.max(1) as u64;
        }
        for &(g, m) in EVENTS[event as usize] { prices[g] = prices[g] * m / 1000; }

        // positions
        let mut results = vec![]; let mut badges: Vec<&str> = vec![];
        let rita: Option<NpcMove> = p.npc_moves.iter().find(|m| m.npc.as_str().starts_with("rita.")).cloned();
        for pos in p.positions.drain(..) {
            let pnl = settle(&pos, prices[pos.good as usize]);
            let liquidated = pnl <= -(pos.stake as i64);
            let pnl = if liquidated { -(pos.stake as i64) } else { pnl };
            p.coins = (p.coins as i64 + pos.stake as i64 + pnl).max(0) as u64;
            if pos.lev == 10 && pnl > 0 { badges.push("x10_survivor"); }
            if let Some(r) = &rita { if r.good == pos.good && !pos.long && pnl > 0 { badges.push("faded_rita"); } }
            results.push(Settled { good: pos.good, long: pos.long, lev: pos.lev, stake: pos.stake, pnl, liquidated });
        }
        // farm: water, rain, frost and blight
        let mut killed = 0u8; let mut grew = 0u8;
        for pl in p.plots.iter_mut() {
            let Some(cr) = pl.crop else { continue };
            let (_, days, _, _, _, needs_water) = CROPS[cr as usize];
            if pl.grown < days {
                if (event == EV_BLIGHT && cr == 6) || (event == EV_COLD && (cr == 1 || cr == 3)) { *pl = Plot::default(); killed += 1; continue; }
                if !needs_water || pl.watered_day == day || event == EV_STORM { pl.grown += 1; grew += 1; }
            }
        }
        // your stall sells up to 3 of your most valuable goods at 110%
        let mut stall_sold = 0u64;
        if self.bal("stall", &player) > 0 {
            for _ in 0..3 {
                let best = (0..NG).filter(|&g| g != 3 && self.bal(GOODS[g], &player) > 0).max_by_key(|&g| prices[g]);
                if let Some(g) = best { self.burn(GOODS[g], &player, 1); let v = prices[g] / 10 * 110 / 100; p.coins += v; stall_sold += v; }
            }
        }
        let loss = if p.passed_out { p.coins / 10 } else { 0 };
        p.coins -= loss;
        // NPC trades settle against the same prices
        for m in p.npc_moves.clone() {
            let stake = if m.npc.as_str().starts_with("kaito.") { 200 * 100 } else { 100 * 100 };
            if let Some(led) = self.npcs.get_mut(&m.npc) {
                let pos = Position { good: m.good, long: m.long, lev: 5, stake, entry: p.prices[m.good as usize] };
                *led += settle(&pos, prices[m.good as usize]).max(-(pos.stake as i64));
            }
        }
        p.prices = prices.clone(); p.commitment = None; p.weather = None; p.npc_moves = vec![]; p.asleep = false; p.passed_out = false;
        p.energy = ENERGY_MAX;
        if day >= SEASON_DAYS {
            p.finished = true; p.won = p.coins >= DEBT;
            if p.won { p.coins -= DEBT; badges.push("debt_free"); }
            let score = if p.won { p.coins + DEBT } else { p.coins };
            if score as i64 - p.start_coins as i64 > self.kaito_ledger() - p.kaito_start { badges.push("beat_kaito"); }
            self.rank(Entry { account: player.clone(), season: p.season, score, day, won: p.won });
        } else { p.day += 1; }
        let mut minted = vec![];
        for b in badges { if self.badge(b, &player) { minted.push(b.to_string()); } }
        let log = DayLog { day, event, prices: prices.to_vec(), results, coins_after: p.coins, passed_out_loss: loss, rumors, killed, grew, stall_sold, badges: minted };
        p.history.push(log.clone());
        if p.history.len() > SEASON_DAYS as usize { p.history.remove(0); }
        self.players.insert(player, p);
        log
    }

    fn rank(&mut self, e: Entry) {
        self.leaderboard.push(e);
        self.leaderboard.sort_by(|a, b| b.won.cmp(&a.won).then(b.score.cmp(&a.score)).then(a.day.cmp(&b.day)));
        self.leaderboard.truncate(20);
    }
    fn max_lev(&self, id: &AccountId) -> u8 {
        if self.bal("license_x10", id) > 0 { 10 } else if self.bal("license_x5", id) > 0 { 5 } else { 2 }
    }
    fn player_mut(&mut self, a: &AccountId) -> &mut Player { self.players.get_mut(a).unwrap_or_else(|| env::panic_str("not a player")) }
    fn barn_add(&mut self, id: &AccountId, good: usize, n: u32) {
        let total: u128 = (0..NG).map(|g| self.bal(GOODS[g], id)).sum();
        require!(total + n as u128 <= BARN_CAP, "your barn is full");
        self.mint(GOODS[good], id, n as u128);
    }
    /// Mint a badge once. Returns true if it was new.
    fn badge(&mut self, name: &str, id: &AccountId) -> bool {
        let t = format!("badge_{name}");
        if self.bal(&t, id) > 0 { return false; }
        self.mint(&t, id, 1); true
    }

    // ---------------- NEP-245 multi-token (goods, items, badges) ----------------
    fn bal(&self, token: &str, owner: &AccountId) -> u128 { *self.balances.get(&format!("{token}|{owner}")).unwrap_or(&0) }
    fn mint(&mut self, token: &str, owner: &AccountId, amount: u128) {
        *self.balances.entry(format!("{token}|{owner}")).or_insert(0) += amount;
        *self.supply.entry(token.to_string()).or_insert(0) += amount;
        log!(r#"EVENT_JSON:{{"standard":"nep245","version":"1.0.0","event":"mt_mint","data":[{{"owner_id":"{}","token_ids":["{}"],"amounts":["{}"]}}]}}"#, owner, token, amount);
    }
    fn burn(&mut self, token: &str, owner: &AccountId, amount: u128) {
        let k = format!("{token}|{owner}"); let b = *self.balances.get(&k).unwrap_or(&0);
        require!(b >= amount, "not enough balance");
        self.balances.insert(k, b - amount);
        *self.supply.entry(token.to_string()).or_insert(0) -= amount;
        log!(r#"EVENT_JSON:{{"standard":"nep245","version":"1.0.0","event":"mt_burn","data":[{{"owner_id":"{}","token_ids":["{}"],"amounts":["{}"]}}]}}"#, owner, token, amount);
    }
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 { U128(self.bal(&token_id, &account_id)) }
    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> {
        token_ids.into_iter().map(|t| U128(self.bal(&t, &account_id))).collect()
    }
    pub fn mt_supply(&self, token_id: String) -> Option<U128> { self.supply.get(&token_id).map(|s| U128(*s)) }
    /// Goods, items and badges are tradeable (badges too, if you insist). Needs 1 yoctoNEAR (wallet signature).
    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        require!(env::attached_deposit() == NearToken::from_yoctonear(1), "requires 1 yoctoNEAR");
        require!(approval.is_none(), "approvals not supported");
        let from = env::predecessor_account_id();
        let k = format!("{token_id}|{from}"); let bal = *self.balances.get(&k).unwrap_or(&0);
        require!(bal >= amount.0 && amount.0 > 0, "not enough balance");
        self.balances.insert(k, bal - amount.0);
        *self.balances.entry(format!("{token_id}|{receiver_id}")).or_insert(0) += amount.0;
        log!(r#"EVENT_JSON:{{"standard":"nep245","version":"1.0.0","event":"mt_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","token_ids":["{}"],"amounts":["{}"]{}}}]}}"#,
            from, receiver_id, token_id, amount.0, memo.map(|m| format!(r#","memo":"{}""#, m.replace('"', "'"))).unwrap_or_default());
    }

    // ---------------- views ----------------
    pub fn get_player(&self, account_id: AccountId) -> Option<Player> { self.players.get(&account_id).cloned() }
    /// Barn goods (same order as GOODS), items and badges in one call.
    pub fn get_inventory(&self, account_id: AccountId) -> (Vec<u32>, Vec<String>) {
        let barn = (0..NG).map(|g| self.bal(GOODS[g], &account_id) as u32).collect();
        let mut owned = vec![];
        for (t, _) in ITEMS.iter() { if self.bal(t, &account_id) > 0 { owned.push(t.to_string()); } }
        for b in ["first_harvest", "green_thumb", "jade_hunter", "angler", "x10_survivor", "faded_rita", "beat_kaito", "debt_free", "early_bird", "restorer", "best_friend"] {
            if self.bal(&format!("badge_{b}"), &account_id) > 0 { owned.push(format!("badge_{b}")); }
        }
        (barn, owned)
    }
    pub fn get_leaderboard(&self) -> Vec<Entry> { self.leaderboard.clone() }
    pub fn get_npcs(&self) -> Vec<(AccountId, i64)> { self.npcs.iter().map(|(a, c)| (a.clone(), *c)).collect() }
    pub fn get_operator(&self) -> AccountId { self.operator.clone() }
}

fn use_energy(p: &mut Player, n: u16) { require!(p.energy >= n, "you are too tired"); p.energy -= n; }

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
        ctx(op()); c.commit_day(pl(), day, h, None, vec![]); ctx(pl());
    }
    fn night(c: &mut Contract, day: u8, event: u8) -> DayLog { c.sleep(false); ctx(op()); let l = c.settle_day(pl(), day, event, "r".into(), "s".into()); ctx(pl()); l }

    #[test]
    fn long_wins_on_storm() {
        let mut c = setup(); commit(&mut c, 1, 0, "s");
        c.open_position(1, true, 2, 100 * 100);
        let log = night(&mut c, 1, 0);
        assert!(log.results[0].pnl > 0 && !log.results[0].liquidated);
        assert_eq!(c.get_player(pl()).unwrap().day, 2);
    }
    #[test]
    fn high_leverage_wrong_way_is_liquidated() {
        let mut c = setup(); c.players.get_mut(&pl()).unwrap().coins = 2000 * 100;
        c.buy_item("license_x5".into()); c.buy_item("license_x10".into());
        commit(&mut c, 1, 1, "s"); c.open_position(1, true, 10, 100 * 100);
        let log = night(&mut c, 1, 1);
        assert!(log.results[0].liquidated); assert_eq!(log.results[0].pnl, -10000);
    }
    #[test]
    #[should_panic(expected = "reveal does not match")]
    fn operator_cannot_change_the_event() {
        let mut c = setup(); commit(&mut c, 1, 0, "s"); c.open_position(1, false, 2, 100 * 100); c.sleep(false);
        ctx(op()); c.settle_day(pl(), 1, 1, "r".into(), "s".into());
    }
    #[test]
    #[should_panic(expected = "license")]
    fn leverage_needs_license() { let mut c = setup(); commit(&mut c, 1, 0, "s"); c.open_position(1, true, 5, 100); }
    #[test]
    #[should_panic(expected = "not started")]
    fn cannot_trade_before_commit() { let mut c = setup(); c.open_position(1, true, 2, 100); }

    #[test]
    fn plant_water_grow_harvest_sell() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.act(vec![Action::Plant { plot: 0, crop: 0 }, Action::Water { plot: 0 }, Action::Plant { plot: 1, crop: 0 }]);
        let log = night(&mut c, 1, 2); assert_eq!(log.grew, 1); // plot 1 was not watered
        commit(&mut c, 2, 2, "s"); c.act(vec![Action::Water { plot: 0 }]); night(&mut c, 2, 2);
        commit(&mut c, 3, 2, "s");
        c.act(vec![Action::Harvest { plot: 0 }]);
        assert_eq!(c.mt_balance_of(pl(), "carrot".into()).0, 2);
        assert_eq!(c.mt_balance_of(pl(), "badge_first_harvest".into()).0, 1);
        let before = c.get_player(pl()).unwrap().coins;
        c.act(vec![Action::Sell { good: 4, qty: 2 }]);
        assert!(c.get_player(pl()).unwrap().coins > before);
        assert_eq!(c.mt_balance_of(pl(), "carrot".into()).0, 0);
    }
    #[test]
    #[should_panic(expected = "not ripe")]
    fn cannot_harvest_early() { let mut c = setup(); commit(&mut c, 1, 2, "s"); c.act(vec![Action::Plant { plot: 0, crop: 0 }, Action::Harvest { plot: 0 }]); }

    #[test]
    fn rain_waters_and_cold_kills() {
        let mut c = setup(); c.players.get_mut(&pl()).unwrap().seeds[1] = 1;
        commit(&mut c, 1, 0, "s"); c.act(vec![Action::Plant { plot: 0, crop: 0 }, Action::Plant { plot: 1, crop: 1 }]);
        let log = night(&mut c, 1, 0); assert_eq!(log.grew, 2); // storm rain watered both
        commit(&mut c, 2, 5, "s"); let log = night(&mut c, 2, 5); assert_eq!(log.killed, 1); // the strawberry froze
    }
    #[test]
    #[should_panic(expected = "too tired")]
    fn energy_runs_out() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let mut a: Vec<Action> = (0..8).map(|r| Action::Mine { rock: r }).collect();      // 64
        a.extend([0u8, 0, 0, 0, 4, 4].iter().enumerate().map(|(i, &cr)| Action::Plant { plot: i as u8, crop: cr })); // 76
        a.extend((0..6).map(|_| Action::Fish { ok: false }));                                    // 100
        a.push(Action::Water { plot: 0 });                                                       // 101
        c.act(a);
    }
    #[test]
    fn gifts_build_friendship_and_projects_complete() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.mint("tea", &pl(), 41); c.players.get_mut(&pl()).unwrap().coins = 1000 * 100;
        c.act(vec![Action::Gift { npc: 0, good: 0 }, Action::Donate { project: 2, coins: 600 }]);
        let p = c.get_player(pl()).unwrap();
        assert_eq!(p.friendship[0], 10); assert!(p.projects[2]);
        assert_eq!(c.mt_balance_of(pl(), "badge_restorer".into()).0, 1);
    }
    #[test]
    fn stall_sells_overnight_and_items_are_nep245() {
        let mut c = setup(); c.players.get_mut(&pl()).unwrap().coins = 3000 * 100;
        c.buy_item("stall".into()); assert_eq!(c.mt_balance_of(pl(), "stall".into()).0, 1);
        c.mint("jade", &pl(), 2);
        commit(&mut c, 1, 2, "s"); let log = night(&mut c, 1, 2);
        assert!(log.stall_sold > 0); assert_eq!(c.mt_balance_of(pl(), "jade".into()).0, 0);
    }
    #[test]
    fn season_ends_farm_is_kept() {
        let mut c = setup();
        commit(&mut c, 1, 6, "s"); c.act(vec![Action::BuyPlot]); night(&mut c, 1, 6);
        for d in 2..=SEASON_DAYS { commit(&mut c, d, 6, "s"); night(&mut c, d, 6); }
        let p = c.get_player(pl()).unwrap(); assert!(p.finished && !p.won); assert_eq!(c.get_leaderboard().len(), 1);
        c.start_season(); let p = c.get_player(pl()).unwrap();
        assert_eq!(p.season, 2); assert_eq!(p.plots.len(), 7); assert_eq!(p.coins, START_COINS);
    }
    #[test]
    fn early_payoff_wins_with_badges() {
        let mut c = setup(); c.players.get_mut(&pl()).unwrap().coins = 6000 * 100;
        c.pay_debt();
        let p = c.get_player(pl()).unwrap(); assert!(p.won); assert_eq!(p.coins, 1000 * 100);
        assert_eq!(c.mt_balance_of(pl(), "badge_early_bird".into()).0, 1);
    }
}
