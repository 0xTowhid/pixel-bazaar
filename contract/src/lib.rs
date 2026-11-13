//! Pixel Bazaar game contract (v2: farming, mining, fishing, friends, Kaito, town projects, badges).
//!
//! On chain:
//! - Player accounts `name.<contract>` with a browser-held function-call key (created by the operator).
//! - Each day's event is committed (sha256 of event + rumors + salt) before the player can act, and revealed
//!   at settlement; the contract rejects a reveal that does not match.
//! - Coins, prices, leverage positions, liquidations, farm plots, seeds, energy, friendships, town projects.
//! - Goods in your barn, items (licenses, bridge, boat, stall) and achievement badges are NEP-245 tokens.
//! - Agent trader accounts (`rita.`, `kaito.`, `pell.`, `bolt.`, `luna.<contract>`) with their own trades and ledgers.
//! Numbers match shared/rules.js and shared/engine.js.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, Lazy, LookupMap};
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

// ---------------- spirits ----------------
pub const FIRE: u8 = 0; pub const WATER: u8 = 1; pub const WIND: u8 = 2; pub const EARTH: u8 = 3;
pub const NATURE: u8 = 4; pub const SPIRIT: u8 = 5; pub const DARK: u8 = 6;
/// (sprite, name, element, rarity 0-3, hp, atk, spd, evolves into (-1 none), at level, needs a lantern shard)
pub const SPECIES: [(&str, &str, u8, u8, u16, u16, u16, i8, u8, bool); 39] = [
    ("Flam", "Ember Kit", FIRE, 0, 30, 12, 10, 1, 10, false), ("Flam2", "Blue Blaze", FIRE, 1, 40, 16, 13, 2, 20, true), ("GiantFlam", "Inferno", FIRE, 3, 56, 24, 15, -1, 0, false),
    ("Axolot", "Tide Axolot", WATER, 0, 34, 10, 11, 4, 10, false), ("AxolotBlue", "Deep Axolot", WATER, 1, 44, 14, 14, 5, 20, false), ("KappaGreen", "Kappa Sage", WATER, 2, 58, 18, 16, -1, 0, false),
    ("Owl", "Hoot", WIND, 1, 30, 11, 15, 7, 12, false), ("Owl2", "Storm Owl", WIND, 2, 42, 15, 19, 8, 22, true), ("TenguBlue", "Tengu", WIND, 3, 54, 22, 22, -1, 0, false),
    ("Spirit", "Wisp", SPIRIT, 0, 28, 10, 14, 10, 10, false), ("Spirit2", "Ember Wisp", SPIRIT, 1, 38, 14, 17, 11, 22, true), ("GiantSpirit", "Great Spirit", SPIRIT, 3, 60, 20, 18, -1, 0, false),
    ("Bamboo", "Sprout", NATURE, 0, 32, 10, 9, 13, 10, false), ("BambooYellow", "Bamboo Guard", NATURE, 1, 46, 13, 11, -1, 0, false),
    ("Mole", "Digger", EARTH, 0, 34, 11, 8, 15, 10, false), ("Mole2", "Rock Mole", EARTH, 1, 48, 15, 9, -1, 0, false),
    ("LanternGreen", "Lantern Wisp", SPIRIT, 1, 36, 12, 13, 17, 14, false), ("LanternRed", "Lantern Ghoul", DARK, 2, 48, 17, 14, -1, 0, false),
    ("Mushroom", "Shroomy", NATURE, 0, 30, 9, 8, 19, 10, false), ("Mushroom2", "Sporecap", NATURE, 1, 42, 13, 10, -1, 0, false),
    ("Slime", "Bubble Slime", WATER, 0, 30, 9, 10, 21, 8, false), ("Slime2", "Moss Slime", NATURE, 0, 38, 12, 11, 22, 18, false), ("Slime3", "King Slime", WATER, 1, 50, 15, 12, -1, 0, false),
    ("Butterfly", "Flutter", WIND, 0, 26, 9, 16, 24, 10, false), ("ButterflyBlue", "Gale Moth", WIND, 1, 36, 13, 19, -1, 0, false),
    ("Skull", "Bones", DARK, 1, 32, 13, 12, 26, 14, false), ("SkullBlue", "Frost Bones", DARK, 2, 44, 17, 14, -1, 0, false),
    ("Octopus", "Inky", WATER, 0, 34, 11, 10, 28, 12, false), ("Octopus2", "Kraken Jr", WATER, 2, 50, 17, 12, -1, 0, false),
    ("Racoon", "Racoon", EARTH, 0, 32, 11, 13, 30, 15, false), ("GoldRacoon", "Gold Racoon", EARTH, 2, 44, 15, 17, -1, 0, false),
    ("Lizard", "Salamander", FIRE, 0, 32, 12, 12, 32, 12, false), ("Lizard2", "Magma Lizard", FIRE, 1, 44, 16, 13, -1, 0, false),
    ("Eye", "Seer Eye", SPIRIT, 1, 30, 12, 12, 34, 14, false), ("Eye2", "Night Eye", DARK, 2, 42, 16, 14, -1, 0, false),
    ("Snake", "Hiss", NATURE, 0, 30, 12, 13, 36, 12, false), ("Snake2", "Viper", DARK, 1, 42, 16, 15, -1, 0, false),
    ("Dragon", "Jade Dragon", EARTH, 3, 64, 24, 20, -1, 0, false), ("DragonYellow", "Sun Drake", FIRE, 3, 62, 26, 18, -1, 0, false),
];
/// Where each spirit lives in the wild: (species, weight). Zones: 0 town and farm, 1 Whispering Woods, 2 Sunken Shrine, 3 Clockwork Sky, 4 Moon Market.
pub const SPAWN: [&[(u8, u8)]; 5] = [
    &[(12, 22), (14, 20), (18, 22), (20, 22), (23, 16), (29, 12), (3, 6)],
    &[(0, 26), (9, 26), (31, 20), (35, 20), (6, 8)],
    &[(27, 30), (3, 30), (20, 20), (5, 3)],
    &[(23, 30), (6, 26), (24, 14), (7, 6), (38, 1)],
    &[(16, 34), (25, 28), (33, 22), (17, 4)],
];
pub const CATCH_CHANCE: [u16; 4] = [205, 154, 102, 38]; // out of 256: 80%, 60%, 40%, 15%
pub const ENCOUNTERS_A_DAY: u8 = 12;
pub const FEEDS_A_DAY: u8 = 5;
pub fn spirit_level(xp: u32) -> u8 { (1 + xp / 20).min(40) as u8 }
/// World puzzles: how many pieces each one has (Woods braziers, Shrine bells, Sky gears). The order changes every day.
pub const PUZZLES: [u8; 3] = [4, 3, 4];
/// The order for puzzle `k` today: a shuffle driven by the day's commitment (same for a retry, different tomorrow).
pub fn puzzle_order(commit: &str, who: &AccountId, k: u8) -> Vec<u8> {
    let n = PUZZLES[k as usize]; let mut v: Vec<u8> = (0..n).collect();
    for i in (1..n as usize).rev() { let j = roll(commit, who, &format!("puzzle{k}"), i as u32) as usize % (i + 1); v.swap(i, j); }
    v
}
// ---------------- fate cards, daily quests, the story ----------------
/// Madame Vey's three cards: one blessing, one curse, one secret. Effects last until you sleep.
pub const BLESSINGS: [&str; 6] = ["The River", "The Mountain", "The Lantern", "The Hearth", "The Coin", "The Seed"];
pub const CURSES: [&str; 5] = ["Mercury Retrograde", "The Crow", "Heavy Boots", "The Fog", "Butterfingers"];
pub const SECRETS: [&str; 4] = ["The Hidden Door", "The Old Key", "The Whisper", "The Twin"];
/// Daily quests: (counter index, target, reward in coins). Counters: 0 spirits caught, 1 fish, 2 crops harvested,
/// 3 rocks mined, 4 gifts given, 5 puzzles solved, 6 meals fed.
pub const QUESTS: [(u8, u8, u32); 8] = [(0, 2, 40), (1, 3, 30), (2, 5, 30), (3, 3, 25), (4, 1, 20), (5, 1, 60), (6, 2, 20), (0, 1, 20)];
pub const STORY_CHAPTERS: u8 = 5;
/// Today's quest in a slot (0-2): three different quests a day from the commitment.
pub fn daily_quest(commit: &str, who: &AccountId, slot: u8) -> u8 {
    let mut picked: Vec<u8> = vec![];
    let mut i = 0u32;
    while picked.len() <= slot as usize { let q = roll(commit, who, "quest", i) % QUESTS.len() as u8; if !picked.contains(&q) { picked.push(q); } i += 1; }
    picked[slot as usize]
}
// ---------------- spirit duels ----------------
/// Duel rivals: (name, team of (species, level), coins for a win). 0 Mei in town, 1 Rita at the Moon Market,
/// 2 the Great Spirit at the old woods gate (story chapter 5).
pub const FOES: [(&str, [(u8, u8); 3], u32); 3] = [
    ("Mei", [(12, 2), (20, 3), (23, 3)], 40),
    ("Rita", [(25, 8), (17, 9), (34, 10)], 120),
    ("Great Spirit", [(10, 12), (17, 12), (11, 16)], 300),
];
pub const DUEL_ENERGY: u16 = 10;
/// Element wheel: fire burns nature, nature drinks water, water puts out fire, wind wears down earth,
/// earth smothers fire, spirit and dark beat each other.
pub fn beats(a: u8, b: u8) -> bool {
    matches!((a, b), (FIRE, NATURE) | (NATURE, WATER) | (WATER, FIRE) | (WIND, EARTH) | (EARTH, FIRE) | (SPIRIT, DARK) | (DARK, SPIRIT))
}
/// A fighter's (element, hp, attack, speed) at a level.
pub fn fighter(species: u8, level: u8) -> (u8, i32, i32, i32) {
    let s = SPECIES[species as usize]; let l = level as i32;
    (s.2, s.4 as i32 * (20 + l) / 20, s.5 as i32 * (20 + l) / 20, s.6 as i32 + l / 4)
}
/// The whole duel, turn by turn, from a stream of rolls (fixed by the day's commitment). true = the player wins.
/// shared/rules.js has the same function, so the game can show every hit.
pub fn duel(team: &[(u8, u8)], foe: &[(u8, u8)], next: &mut dyn FnMut() -> u8) -> bool {
    let a: Vec<_> = team.iter().map(|&(s, l)| fighter(s, l)).collect();
    let b: Vec<_> = foe.iter().map(|&(s, l)| fighter(s, l)).collect();
    let mut hp = [a.iter().map(|f| f.1).collect::<Vec<_>>(), b.iter().map(|f| f.1).collect::<Vec<_>>()];
    let side = [&a, &b]; let mut at = [0usize, 0usize];
    for _ in 0..80 {
        if at[0] == a.len() || at[1] == b.len() { break; }
        let (x, y) = (side[0][at[0]], side[1][at[1]]);
        let r = next();
        let first = if x.3 > y.3 || (x.3 == y.3 && r < 128) { 0 } else { 1 };
        for k in [first, 1 - first] {
            let (me, them) = (side[k][at[k]], side[1 - k][at[1 - k]]);
            let mut dmg = me.2 * (85 + (next() % 31) as i32) / 100;
            if beats(me.0, them.0) { dmg = dmg * 3 / 2; } else if beats(them.0, me.0) { dmg = dmg * 2 / 3; }
            if next() < 20 { dmg = dmg * 3 / 2; }
            let h = &mut hp[1 - k][at[1 - k]]; *h -= dmg.max(1);
            if *h <= 0 { at[1 - k] += 1; break; }
        }
    }
    at[1] == b.len()
}
// ---------------- fishing legends ----------------
/// Five legendary fish, each an NFT you can catch once. (name, chance out of 256 on a good catch while it is in season)
/// 0 Ember Koi: fish with a fire companion. 1 Tide King: a water companion, from day 5 on. 2 Storm Eel: on a day of The River.
/// 3 Ghost Carp: after the Clockwork Sky (story chapter 5). 4 Jade Leviathan: once you hold the other four.
pub const LEGENDS: [(&str, u8); 5] = [("Ember Koi", 12), ("Tide King", 12), ("Storm Eel", 16), ("Ghost Carp", 12), ("Jade Leviathan", 8)];
// ---------------- the island: ghost notes, curses, the world boss, the feed ----------------
/// Ghost notes are picked from these lines (no free text, so nothing needs moderating); {} is an argument.
pub const NOTE_LINES: u8 = 12;
pub const NOTES_KEPT: usize = 120;
pub const FEED_KEPT: usize = 50;
pub const VOTES_A_DAY: u8 = 6;
pub const CURSE_COST: u64 = 40;
pub const CHARM_COST: u64 = 25;
/// Curses: 0 Sticky Boots (-15 energy), 1 Crow Thief (-30 coins), 2 Frog Voice (you croak for a day, harmless).
pub const CURSES_P: [&str; 3] = ["Sticky Boots", "Crow Thief", "Frog Voice"];
/// The world boss: rare (a 2-day window opens about once a month), shared HP across every player on the island.
pub const BOSS_WINDOW_MS: u64 = 2 * 86_400_000;
pub const BOSS_CHANCE: u8 = 17; // out of 256 per window
pub const BOSS_HP: i64 = 3000;
pub const BOSS_HITS: u8 = 3;
pub const BOSS_FORMS: [u8; 3] = [11, 2, 8]; // Great Spirit, Inferno, Tengu
pub const NFT_BASE: &str = "https://raw.githubusercontent.com/0xTowhid/pixel-bazaar/main/nft";

#[derive(BorshStorageKey)]
#[near]
enum Key { Players, Balances, Supply, Npcs, Tokens, Owners, ByOwner, Links, Notes, Feed, Boss }

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
    pub commitment: Option<String>, pub npc_moves: Vec<NpcMove>,
    pub asleep: bool, pub passed_out: bool, pub fish_day: u8, pub seer_day: u8, pub chest: bool, pub finished: bool, pub won: bool,
    pub history: Vec<DayLog>,
    // farm and life sim (kept between seasons)
    pub energy: u16, pub plots: Vec<Plot>, pub seeds: Vec<u16>, pub friendship: Vec<u8>, pub gift_day: Vec<u8>,
    pub projects: Vec<bool>, pub donated: Vec<Vec<u32>>, pub mined_day: u8, pub mined: u32, pub catches_today: u8, pub cat_day: u8,
    pub harvested: u32, pub jade_found: u32, pub fish_caught: u32, pub kaito_pnl: i64, pub start_coins: u64,
    pub seasons_won: u32, pub best_score: u64,
    // spirits and wallet (kept between seasons)
    pub lead: Option<String>, pub enc_today: u8, pub fed_today: u8, pub wild: Option<Wild>, pub wallet: Option<AccountId>,
    pub book: u64, pub shards: u16,
    pub clues: u32, pub solved_day: Vec<u8>,
    pub fate_day: u8, pub fate: Vec<u8>, pub daily: Vec<u8>, pub quests_claimed: u8, pub chapter: u8, pub boss_wins: u32,
    pub duel_day: Vec<u8>, pub duel_wins: u32,
    pub legends: u8,
    pub note_day: u8, pub votes_today: u8, pub voted: Vec<u32>, pub rep: i32,
    pub curse_day: u8, pub hex: Option<Hex>, pub last_hex: Option<Hex>, pub charms: u8,
    pub boss_seen: u32, pub boss_hits: u8, pub boss_claimed: u32,
    pub cursed_day: u8, pub cursed_season: u32, pub sold: u32, pub duel_seed: String, pub duel_last: u8,
}
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Hex { pub from: AccountId, pub kind: u8, pub blocked: bool }
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Note { pub id: u32, pub author: AccountId, pub world: u8, pub x: u16, pub y: u16, pub line: u8, pub arg: u8, pub at: u64, pub truth: u16, pub liar: u16 }
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct FeedItem { pub at: u64, pub who: AccountId, pub text: String }
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Boss { pub id: u32, pub species: u8, pub hp: i64, pub max: i64, pub ends: u64, pub hitters: Vec<AccountId>, pub killed_by: Option<AccountId> }

/// An NFT: a spirit, a badge or a legendary catch.
#[near(serializers = [borsh, json])]
#[derive(Clone)]
#[serde(tag = "type")]
pub enum Tok { Spirit { species: u8, shiny: bool, xp: u32 }, Badge { name: String }, Fish { kind: u8 } }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Wild { pub species: u8, pub shiny: bool, pub zone: u8 }

#[near(serializers = [json])]
pub struct SpiritView { pub token_id: String, pub species: u8, pub name: String, pub element: u8, pub rarity: u8, pub shiny: bool, pub xp: u32, pub level: u8, pub hp: u16, pub atk: u16, pub spd: u16 }

#[near(serializers = [json])]
pub struct TokenMetadata { pub title: String, pub description: String, pub media: String, pub copies: u64, pub extra: String }
#[near(serializers = [json])]
pub struct JsonToken { pub token_id: String, pub owner_id: AccountId, pub metadata: TokenMetadata }
#[near(serializers = [json])]
pub struct ContractMetadata { pub spec: String, pub name: String, pub symbol: String, pub icon: Option<String>, pub base_uri: Option<String>, pub reference: Option<String>, pub reference_hash: Option<String> }

#[near(serializers = [json])]
#[derive(Clone)]
#[serde(tag = "t")]
pub enum Action {
    Plant { plot: u8, crop: u8 }, Water { plot: u8 }, Harvest { plot: u8 }, Mine { rock: u8 }, Fish { ok: bool }, Cat,
    Sell { good: u8, qty: u32 }, Gift { npc: u8, good: u8 }, Donate { project: u8, coins: u64 }, BuySeed { crop: u8, qty: u16 }, BuyPlot,
    // spirits
    Encounter { zone: u8 }, Catch { ok: bool }, SetLead { token: String }, Feed { token: String, good: u8 }, Evolve { token: String },
    // your NEAR wallet
    ConfirmWallet { wallet: AccountId }, UnlinkWallet, SendToWallet { token: String }, SendTo { token: String, to: AccountId },
    // world puzzles
    Solve { puzzle: u8, answer: Vec<u8> },
    // Madame Vey, the quest board, the story
    DrawFate, ClaimQuest { slot: u8 }, AdvanceStory,
    // spirit duels: up to three of your spirits against a rival's team
    Duel { foe: u8, team: Vec<String> },
    // the island, shared with every player
    LeaveNote { world: u8, x: u16, y: u16, line: u8, arg: u8 }, VoteNote { id: u32, truth: bool },
    Curse { target: AccountId, kind: u8 }, BuyCharm, BossHit, BossClaim,
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
    tokens: LookupMap<String, Tok>,             // NEP-171: token id -> what it is
    owners: LookupMap<String, AccountId>,       // token id -> owner
    by_owner: LookupMap<AccountId, Vec<String>>, // owner -> token ids
    links: LookupMap<AccountId, AccountId>,     // game account -> wallet that asked to link
    next_token: u64,
    // kept in their own storage slots, so a normal move does not load them
    notes: Lazy<Vec<Note>>, next_note: u32, feed: Lazy<Vec<FeedItem>>, boss: Lazy<Option<Boss>>, boss_window: u64,
}

fn new_player(season: u32) -> Player {
    Player {
        season, day: 1, coins: START_COINS, prices: BASE.to_vec(), positions: vec![], commitment: None, npc_moves: vec![],
        asleep: false, passed_out: false, fish_day: 0, seer_day: 0, chest: false, finished: false, won: false, history: vec![],
        energy: ENERGY_MAX, plots: vec![Plot::default(); START_PLOTS], seeds: {
            let mut s = vec![0u16; CROPS.len()]; s[0] = 4; s[4] = 2; s // a few carrot and corn seeds to start
        },
        friendship: vec![0; NPCS], gift_day: vec![0; NPCS], projects: vec![false; PROJECTS.len()], donated: vec![vec![0; NG + 1]; PROJECTS.len()],
        mined_day: 0, mined: 0, catches_today: 0, cat_day: 0, harvested: 0, jade_found: 0, fish_caught: 0, kaito_pnl: 0, start_coins: START_COINS,
        seasons_won: 0, best_score: 0,
        lead: None, enc_today: 0, fed_today: 0, wild: None, wallet: None, book: 0, shards: 0,
        clues: 0, solved_day: vec![0; PUZZLES.len()],
        fate_day: 0, fate: vec![], daily: vec![0; 7], quests_claimed: 0, chapter: 1, boss_wins: 0,
        duel_day: vec![0; FOES.len()], duel_wins: 0, legends: 0,
        note_day: 0, votes_today: 0, voted: vec![], rep: 0, curse_day: 0, hex: None, last_hex: None, charms: 0, boss_seen: 0, boss_hits: 0, boss_claimed: 0,
        cursed_day: 0, cursed_season: 0, sold: 0, duel_seed: String::new(), duel_last: 0,
    }
}
/// Commitment string the operator hashes on day start and reveals at settlement.
pub fn commit_preimage(player: &AccountId, season: u32, day: u8, event: u8, rumors: &str, salt: &str) -> String {
    format!("{player}|{season}|{day}|{event}|{rumors}|{salt}")
}
/// Profit or loss of a position at a new price (cents, before liquidation clamp).
pub fn settle(p: &Position, price: u64) -> i64 {
    let entry = p.entry.max(1) as i128;
    let mv = (price as i128 - entry) * 1_000_000 / entry;
    let dir = if p.long { 1 } else { -1 };
    (p.stake as i128 * p.lev as i128 * mv * dir / 1_000_000) as i64
}
/// A roll for mining, fishing and the cat, fixed by the day's commitment: resubmitting a reverted transaction gives
/// the same result, so a script cannot retry until it gets lucky.
fn roll(commitment: &str, who: &AccountId, what: &str, n: u32) -> u8 { env::sha256(format!("{commitment}|{who}|{what}|{n}").as_bytes())[0] }
fn ripe(pl: &Plot) -> bool { pl.crop.map(|c| pl.grown >= CROPS[c as usize].1).unwrap_or(false) }

#[near]
impl Contract {
    #[init]
    pub fn new(operator: AccountId) -> Self {
        Self { operator, players: LookupMap::new(Key::Players), balances: LookupMap::new(Key::Balances), supply: LookupMap::new(Key::Supply), npcs: IterableMap::new(Key::Npcs), leaderboard: vec![],
            tokens: LookupMap::new(Key::Tokens), owners: LookupMap::new(Key::Owners), by_owner: LookupMap::new(Key::ByOwner), links: LookupMap::new(Key::Links), next_token: 0,
            notes: Lazy::new(Key::Notes, vec![]), next_note: 0, feed: Lazy::new(Key::Feed, vec![]), boss: Lazy::new(Key::Boss, None), boss_window: u64::MAX }
    }
    fn assert_operator(&self) { require!(env::predecessor_account_id() == self.operator, "operator only"); }

    // ---------------- accounts ----------------
    #[payable]
    /// `public_key` is the play key the browser keeps (it can only call the game). `full_key` (optional) is the
    /// key behind the player's 12-word code: it can move NEAR, and the game only rebuilds it from the password for a send.
    pub fn register_player(&mut self, name: String, public_key: PublicKey, full_key: Option<PublicKey>) -> Promise {
        self.assert_operator();
        let id: AccountId = format!("{name}.{}", env::current_account_id()).parse().unwrap_or_else(|_| env::panic_str("bad name"));
        require!(!self.players.contains_key(&id), "name taken");
        let mut pr = Promise::new(id.clone()).create_account().transfer(env::attached_deposit())
            .add_access_key_allowance(public_key, Allowance::Unlimited, env::current_account_id(), PLAYER_METHODS.to_string());
        if let Some(k) = full_key { pr = pr.add_full_access_key(k); }
        pr.then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(10)).on_register(id))
    }
    #[private]
    pub fn on_register(&mut self, id: AccountId, #[callback_result] created: Result<(), PromiseError>) -> bool {
        let ok = created.is_ok();
        if ok { self.players.insert(id.clone(), new_player(1)); log!("player {} joined", id); }
        ok
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
        let old = self.players.get(&id).cloned().unwrap_or_else(|| env::panic_str("not a player"));
        require!(old.finished, "finish this season first");
        let mut p = new_player(old.season + 1);
        p.plots = old.plots.into_iter().map(|mut pl| { pl.watered_day = 0; pl }).collect();
        p.seeds = old.seeds; p.friendship = old.friendship; p.projects = old.projects; p.donated = old.donated;
        p.harvested = old.harvested; p.jade_found = old.jade_found; p.fish_caught = old.fish_caught;
        p.seasons_won = old.seasons_won; p.best_score = old.best_score;
        p.lead = old.lead; p.wallet = old.wallet; p.book = old.book; p.shards = old.shards; p.clues = old.clues; p.chapter = old.chapter; p.boss_wins = old.boss_wins; p.duel_wins = old.duel_wins; p.legends = old.legends; p.rep = old.rep; p.voted = old.voted; p.charms = old.charms; p.boss_seen = old.boss_seen; p.boss_hits = old.boss_hits; p.boss_claimed = old.boss_claimed;
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
        let commit = p.commitment.clone().unwrap_or_else(|| env::panic_str("the day has not started yet"));
        let mut badges: Vec<&str> = vec![];
        let lead_el = self.lead_element(&id, &p);
        let fate = |p: &Player, kind: usize, v: u8| p.fate_day == p.day && p.fate.len() == 3 && p.fate[kind] == v;
        if let Some(h) = p.hex.take() { // someone cursed you: it lands now
            match h.kind { 0 => p.energy = p.energy.saturating_sub(15), 1 => p.coins = p.coins.saturating_sub(30 * 100), _ => {} }
            p.last_hex = Some(h);
        }
        for a in actions {
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
                    p.harvested += yld; p.daily[2] = p.daily[2].saturating_add(yld as u8);
                    if p.harvested == yld { badges.push("first_harvest"); }
                    if p.harvested >= 50 && p.harvested - yld < 50 { badges.push("green_thumb"); }
                }
                Action::Mine { rock } => {
                    let cost = if fate(&p, 1, 2) { 12 } else { 8 }; use_energy(&mut p, cost); // Heavy Boots
                    p.daily[3] = p.daily[3].saturating_add(1);
                    require!(rock < ROCKS, "no such rock");
                    if p.mined_day != p.day { p.mined_day = p.day; p.mined = 0; }
                    require!(p.mined & (1 << rock) == 0, "already mined today");
                    p.mined |= 1 << rock;
                    let r = roll(&commit, &id, "mine", rock as u32);
                    let jade = if lead_el == Some(EARTH) { 96 } else { 64 } + if fate(&p, 0, 1) { 32 } else { 0 }; // earth spirit, The Mountain
                    if r < jade { self.barn_add(&id, 11, 1); p.jade_found += 1; if p.jade_found == 5 { badges.push("jade_hunter"); } }
                    else if r < 200 { self.barn_add(&id, 12, 1); }
                    else if r >= 250 { p.shards += 1; } // a lantern shard, for the last evolutions
                    else { p.seeds[(r % 7) as usize] += 2; }
                }
                Action::Fish { ok } => {
                    use_energy(&mut p, 4);
                    require!(p.catches_today < 6, "the fish stopped biting for today");
                    let r = roll(&commit, &id, "fish", p.catches_today as u32);
                    p.catches_today += 1;
                    // the mini-game must be won, and then the catch is still decided on chain (7 in 10)
                    let bite = (if lead_el == Some(WATER) { 210i32 } else { 179 } + if fate(&p, 0, 0) { 40 } else { 0 } - if fate(&p, 1, 4) { 30 } else { 0 }).clamp(0, 255) as u8; // water spirit, The River, Butterfingers
                    if ok && r < bite {
                        let n = if p.projects[0] { 2 } else { 1 };
                        self.barn_add(&id, 1, n); p.fish_caught += n; p.daily[1] = p.daily[1].saturating_add(n as u8);
                        if p.fish_caught >= 10 && p.fish_caught - n < 10 { badges.push("angler"); }
                        // a legend on the line? the first one in season you don't have yet
                        let season = [lead_el == Some(FIRE), lead_el == Some(WATER) && p.day >= 5, fate(&p, 0, 0), p.chapter >= 5, p.legends & 0b1111 == 0b1111];
                        if let Some(k) = (0..LEGENDS.len()).find(|&k| season[k] && p.legends & (1 << k) == 0) {
                            if roll(&commit, &id, "legend", p.catches_today as u32) < LEGENDS[k].1 {
                                p.legends |= 1 << k;
                                let tid = self.new_token_id("f"); self.tokens.insert(tid.clone(), Tok::Fish { kind: k as u8 }); self.give_token(&tid, &id);
                                if p.legends == 0b11111 { badges.push("fishing_legend"); }
                                log!("legendary catch: {}", LEGENDS[k].0); self.post(&id, format!("pulled up the legendary {}", LEGENDS[k].0));
                            }
                        }
                    }
                }
                Action::Cat => {
                    require!(p.cat_day != p.day, "Mochi already found something today");
                    require!(!fate(&p, 1, 1), "The Crow scared Mochi today");
                    p.cat_day = p.day;
                    let r = roll(&commit, &id, "cat", 0);
                    if r < 128 { p.coins += 10 * 100; } else { p.seeds[(r % 7) as usize] += 1; }
                }
                Action::Sell { good, qty } => {
                    let g = good as usize; require!(g < NG && g != 3 && qty > 0, "cannot sell that");
                    let have = self.bal(GOODS[g], &id); require!(have >= qty as u128, "not enough in your barn");
                    self.burn(GOODS[g], &id, qty as u128); p.sold += qty;
                    let bonus = if g == 0 && p.projects[2] { 115 } else { 100 };
                    for _ in 0..qty {
                        p.coins += p.prices[g] / 10 * bonus / 100; // milli-coins -> cents
                        p.prices[g] = (p.prices[g] * 98 / 100).max(1);
                    }
                }
                Action::Gift { npc, good } => {
                    let n = npc as usize; require!(n < NPCS, "no such person");
                    require!(p.gift_day[n] != p.day, "one gift a day");
                    require!((good as usize) < NG, "no such good");
                    require!(self.bal(GOODS[good as usize], &id) >= 1, "you don't have that");
                    self.burn(GOODS[good as usize], &id, 1);
                    p.gift_day[n] = p.day; p.daily[4] = p.daily[4].saturating_add(1);
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
                Action::Encounter { zone } => {
                    let cost = if fate(&p, 1, 0) { 8 } else { 5 }; use_energy(&mut p, cost); // Mercury Retrograde
                    require!((zone as usize) < SPAWN.len(), "no such place");
                    require!(p.enc_today < ENCOUNTERS_A_DAY + if fate(&p, 2, 0) { 1 } else { 0 }, "the spirits are hiding until tomorrow"); // The Hidden Door
                    if zone == 2 { require!(self.owns_element(&id, WATER), "you need a water spirit to dive to the shrine"); }
                    if zone == 3 { require!(self.owns_element(&id, WIND), "you need a wind spirit to glide to the sky"); }
                    let n = p.enc_today as u32; p.enc_today += 1;
                    let table = SPAWN[zone as usize];
                    let total: u32 = table.iter().map(|x| x.1 as u32).sum();
                    let mut pick = (roll(&commit, &id, "enc", n) as u32 * 256 + roll(&commit, &id, "enc2", n) as u32) % total;
                    let mut species = table[0].0;
                    for &(sp, w) in table { if pick < w as u32 { species = sp; break; } pick -= w as u32; }
                    let shiny = roll(&commit, &id, "shiny", n) < if fate(&p, 2, 3) { 16 } else { 4 }; // 1 in 64 (1 in 16 with The Twin)
                    p.wild = Some(Wild { species, shiny, zone });
                }
                Action::Catch { ok } => {
                    let w = p.wild.take().unwrap_or_else(|| env::panic_str("there is no spirit here"));
                    let sp = SPECIES[w.species as usize];
                    let mut chance = CATCH_CHANCE[sp.3 as usize] + if fate(&p, 0, 2) { 26 } else { 0 }; // The Lantern
                    if fate(&p, 1, 3) { chance = chance.saturating_sub(20); } // The Fog
                    if lead_el == Some(sp.2) { chance += 38; } // a spirit of the same element calms it
                    if ok && (roll(&commit, &id, "catch", p.enc_today as u32) as u16) < chance {
                        self.mint_spirit(&id, w.species, w.shiny); p.daily[0] = p.daily[0].saturating_add(1);
                        p.book |= 1u64 << w.species;
                        let caught = p.book.count_ones();
                        if caught == 1 { badges.push("first_spirit"); }
                        if caught >= 10 && (p.book & !(1u64 << w.species)).count_ones() < 10 { badges.push("spirit_tamer"); }
                        if w.shiny { badges.push("shiny_hunter"); }
                        if w.shiny || sp.3 >= 2 { self.post(&id, format!("caught a {}{}", if w.shiny { "SHINY " } else { "" }, sp.1)); }
                    }
                }
                Action::SetLead { token } => { self.assert_owns_spirit(&id, &token); p.lead = Some(token); }
                Action::Feed { token, good } => {
                    self.assert_owns_spirit(&id, &token);
                    require!(p.fed_today < FEEDS_A_DAY, "it is full for today");
                    require!((good as usize) < NG && self.bal(GOODS[good as usize], &id) >= 1, "you don't have that");
                    self.burn(GOODS[good as usize], &id, 1); p.fed_today += 1; p.daily[6] = p.daily[6].saturating_add(1);
                    let xp = match good { 11 => 25, 1 | 2 | 3 => 12, _ => 6 };
                    self.add_xp(&token, xp);
                }
                Action::Evolve { token } => {
                    self.assert_owns_spirit(&id, &token);
                    let Some(Tok::Spirit { species, shiny, xp }) = self.tokens.get(&token).cloned() else { env::panic_str("not a spirit") };
                    let sp = SPECIES[species as usize];
                    require!(sp.7 >= 0, "this is its final form");
                    require!(spirit_level(xp) >= sp.8, "it needs a higher level");
                    if sp.9 { require!(p.shards >= 1, "it needs a lantern shard"); p.shards -= 1; }
                    let next = sp.7 as u8;
                    self.tokens.insert(token.clone(), Tok::Spirit { species: next, shiny, xp });
                    p.book |= 1u64 << next;
                    if SPECIES[next as usize].3 == 3 { badges.push("legend_tamer"); }
                    log!("{} evolved into {}", token, SPECIES[next as usize].1);
                }
                Action::ConfirmWallet { wallet } => {
                    require!(self.links.get(&id) == Some(&wallet), "ask from your wallet first");
                    self.links.remove(&id); p.wallet = Some(wallet); badges.push("wallet_linked");
                }
                Action::UnlinkWallet => { p.wallet = None; }
                Action::DrawFate => {
                    require!(p.fate_day != p.day, "Madame Vey: come back tomorrow, dear");
                    p.fate_day = p.day;
                    p.fate = vec![roll(&commit, &id, "fate", 0) % BLESSINGS.len() as u8, roll(&commit, &id, "fate", 1) % CURSES.len() as u8, roll(&commit, &id, "fate", 2) % SECRETS.len() as u8];
                    match p.fate[0] { 3 => p.energy = (p.energy + 20).min(ENERGY_MAX + 20), 4 => p.coins += 30 * 100, 5 => p.seeds[(roll(&commit, &id, "fate", 3) % 7) as usize] += 3, _ => {} }
                }
                Action::ClaimQuest { slot } => {
                    require!(slot < 3, "no such quest");
                    require!(p.quests_claimed & (1 << slot) == 0, "already claimed");
                    let q = QUESTS[daily_quest(&commit, &id, slot) as usize];
                    require!(p.daily[q.0 as usize] >= q.1, "not done yet");
                    p.quests_claimed |= 1 << slot; p.coins += q.2 as u64 * 100;
                    if let Some(t) = p.lead.clone() { if self.owners.get(&t) == Some(&id) { self.add_xp(&t, 5); } }
                }
                Action::AdvanceStory => {
                    require!(p.chapter <= STORY_CHAPTERS, "the story is complete");
                    let done = match p.chapter {
                        1 => p.book != 0 && p.sold > 0,                // The Debt: meet the spirits, earn your first coins
                        2 => p.clues & 1 != 0,                          // Whispers in the Woods: the brazier puzzle
                        3 => p.clues & 2 != 0,                          // The Sunken Shrine: the bell puzzle
                        4 => p.clues & 4 != 0,                          // The Clockwork Sky: the gear puzzle
                        _ => p.boss_wins & 1 != 0,                      // Who Stole the Lantern?: beat the Great Spirit
                    };
                    require!(done, "this chapter is not finished yet");
                    p.chapter += 1;
                    match p.chapter { 2 | 3 | 4 => { p.shards += 1; p.coins += 100 * 100; } 5 => { p.shards += 2; p.coins += 200 * 100; } _ => {} }
                    if p.chapter > STORY_CHAPTERS { badges.push("lantern_keeper"); self.mint_spirit(&id, 37, false); p.book |= 1u64 << 37; } // the Jade Dragon
                }
                Action::Duel { foe, team } => {
                    let f = foe as usize; require!(f < FOES.len(), "no such rival");
                    require!(!team.is_empty() && team.len() <= 3, "pick one to three spirits");
                    require!(p.duel_day[f] != p.day, "one duel a day with each rival");
                    if f == 2 { require!(p.chapter >= 5, "the Great Spirit is still asleep"); }
                    use_energy(&mut p, DUEL_ENERGY);
                    let mut mine = vec![];
                    for (i, t) in team.iter().enumerate() {
                        require!(!team[..i].contains(t), "each spirit fights once");
                        self.assert_owns_spirit(&id, t);
                        let Some(Tok::Spirit { species, xp, .. }) = self.tokens.get(t).cloned() else { unreachable!() };
                        mine.push((species, spirit_level(xp)));
                    }
                    p.duel_day[f] = p.day;
                    // the fight is rolled from this block's randomness (unknown until it runs, and once a day, so no rerolls);
                    // the seed is saved so the game can replay every hit
                    let seed = hex::encode(&env::random_seed()[..8]);
                    let mut n = 0u32; let what = format!("duel{f}");
                    let won = duel(&mine, &FOES[f].1, &mut || { n += 1; roll(&seed, &id, &what, n - 1) });
                    p.duel_seed = seed; p.duel_last = f as u8 | if won { 0x80 } else { 0 };
                    for t in team.iter() { self.add_xp(t, if won { 20 } else { 6 }); }
                    if won {
                        p.coins += FOES[f].2 as u64 * 100; p.duel_wins += 1;
                        if f == 2 { p.boss_wins |= 1; p.shards += 1; badges.push("spirit_champion"); }
                        self.post(&id, format!("beat {} in a spirit duel", FOES[f].0));
                    }
                    log!("duel with {}: {}", FOES[f].0, if won { "won" } else { "lost" });
                }
                Action::LeaveNote { world, x, y, line, arg } => {
                    require!(world < 5 && line < NOTE_LINES && x < 1200 && y < 1200, "bad note");
                    require!(p.note_day != p.day, "one ghost note a day");
                    p.note_day = p.day;
                    self.next_note += 1;
                    self.notes.push(Note { id: self.next_note, author: id.clone(), world, x, y, line, arg, at: env::block_timestamp_ms(), truth: 0, liar: 0 });
                    if self.notes.len() > NOTES_KEPT { (*self.notes).remove(0); }
                }
                Action::VoteNote { id: nid, truth } => {
                    require!(p.votes_today < VOTES_A_DAY, "you have voted enough today");
                    require!(!p.voted.contains(&nid), "you already voted on that note");
                    let n = self.notes.iter_mut().find(|n| n.id == nid).unwrap_or_else(|| env::panic_str("the note faded away"));
                    require!(n.author != id, "not your own note");
                    if truth { n.truth += 1 } else { n.liar += 1 }
                    let author = n.author.clone();
                    p.votes_today += 1; p.voted.push(nid); if p.voted.len() > 60 { p.voted.remove(0); }
                    if let Some(a) = self.players.get_mut(&author) {
                        a.rep += if truth { 1 } else { -1 };
                        if truth { a.coins += 5 * 100; }
                        if a.rep == 10 && truth { self.badge("island_oracle", &author); }
                    }
                }
                Action::Curse { target, kind } => {
                    require!(kind < 3, "no such curse"); require!(target != id, "you cannot curse yourself");
                    require!(p.curse_day != p.day, "one curse a day");
                    require!(p.coins >= CURSE_COST * 100, "a curse costs 40 coins");
                    let t = self.players.get_mut(&target).unwrap_or_else(|| env::panic_str("no such player"));
                    require!(t.cursed_day != t.day || t.cursed_season != t.season, "someone already cursed them today");
                    t.cursed_day = t.day; t.cursed_season = t.season;
                    p.coins -= CURSE_COST * 100; p.curse_day = p.day;
                    let blocked = t.charms > 0;
                    if blocked { t.charms -= 1; t.last_hex = Some(Hex { from: id.clone(), kind, blocked: true }); }
                    else { t.hex = Some(Hex { from: id.clone(), kind, blocked: false }); }
                    self.post(&id, if blocked { format!("cursed {target} with {}, but a charm blocked it", CURSES_P[kind as usize]) } else { format!("cursed {target} with {}", CURSES_P[kind as usize]) });
                }
                Action::BuyCharm => {
                    require!(p.charms < 3, "you can carry three charms"); require!(p.coins >= CHARM_COST * 100, "a charm costs 25 coins");
                    p.coins -= CHARM_COST * 100; p.charms += 1;
                }
                Action::BossHit => {
                    let now = env::block_timestamp_ms();
                    self.maybe_spawn_boss(now);
                    let b = (*self.boss).as_mut().filter(|b| b.hp > 0 && now < b.ends).unwrap_or_else(|| env::panic_str("the sky is calm. no world boss right now"));
                    if p.boss_seen != b.id { p.boss_seen = b.id; p.boss_hits = 0; }
                    require!(p.boss_hits < BOSS_HITS, "you have hit it three times. let the others try");
                    let lead = p.lead.clone().filter(|t| self.owners.get(t) == Some(&id)).unwrap_or_else(|| env::panic_str("you need a companion spirit to fight"));
                    use_energy(&mut p, 15);
                    let Some(Tok::Spirit { species, xp, .. }) = self.tokens.get(&lead).cloned() else { unreachable!() };
                    let b = (*self.boss).as_mut().unwrap();
                    let f = fighter(species, spirit_level(xp));
                    let mut dmg = f.2 as i64 * (100 + (roll(&commit, &id, "boss", p.boss_hits as u32) % 60) as i64) / 100 * 3;
                    if beats(f.0, SPECIES[b.species as usize].2) { dmg = dmg * 3 / 2; }
                    p.boss_hits += 1; b.hp -= dmg;
                    if !b.hitters.contains(&id) && b.hitters.len() < 500 { b.hitters.push(id.clone()); }
                    let (name, killed) = (SPECIES[b.species as usize].1, b.hp <= 0);
                    if killed { b.killed_by = Some(id.clone()); }
                    self.add_xp(&lead, 15);
                    self.post(&id, if killed { format!("landed the final blow on the {name}!") } else { format!("hit the {name} for {dmg}") });
                }
                Action::BossClaim => {
                    let b = (*self.boss).as_ref().unwrap_or_else(|| env::panic_str("no world boss"));
                    require!(b.killed_by.is_some(), "the boss still stands");
                    require!(b.hitters.contains(&id), "you did not fight it");
                    require!(p.boss_claimed != b.id, "already claimed");
                    p.boss_claimed = b.id; p.coins += 250 * 100; p.shards += 1;
                    if b.killed_by.as_ref() == Some(&id) { p.coins += 100 * 100; }
                    badges.push("boss_slayer");
                }
                Action::Solve { puzzle, answer } => {
                    require!((puzzle as usize) < PUZZLES.len(), "no such puzzle");
                    if puzzle == 1 { require!(self.owns_element(&id, WATER), "the shrine is under water"); }
                    if puzzle == 2 { require!(self.owns_element(&id, WIND), "the sky is out of reach"); }
                    require!(p.solved_day[puzzle as usize] != p.day, "already solved today");
                    require!(answer == puzzle_order(&commit, &id, puzzle), "that is not the right order");
                    p.solved_day[puzzle as usize] = p.day; p.shards += if fate(&p, 2, 1) { 2 } else { 1 }; p.daily[5] = p.daily[5].saturating_add(1); // The Old Key
                    let first = p.clues & (1 << puzzle) == 0; p.clues |= 1 << puzzle;
                    if first && p.clues & 0b111 == 0b111 { badges.push("lantern_seeker"); }
                }
                Action::SendToWallet { token } => {
                    let to = p.wallet.clone().unwrap_or_else(|| env::panic_str("link a wallet first"));
                    require!(self.owners.get(&token) == Some(&id), "not yours");
                    if p.lead.as_deref() == Some(token.as_str()) { p.lead = None; }
                    self.move_token(&token, &id, &to, Some("sent to the linked wallet"));
                }
                Action::SendTo { token, to } => { // the in-game wallet: send a spirit, badge or fish to any NEAR account
                    require!(to != id, "that is you");
                    require!(self.owners.get(&token) == Some(&id), "not yours");
                    if p.lead.as_deref() == Some(token.as_str()) { p.lead = None; }
                    self.move_token(&token, &id, &to, Some("sent from the in-game wallet"));
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
        p.asleep = true; p.passed_out = passed_out; // shown on the night card only: a caller-chosen flag cannot carry a penalty
    }

    pub fn pay_debt(&mut self) {
        let id = env::predecessor_account_id();
        let p = self.player_mut(&id);
        require!(!p.finished && p.coins >= DEBT, "not enough coins");
        p.coins -= DEBT; p.finished = true; p.won = true; p.seasons_won += 1; p.best_score = p.best_score.max(p.coins + DEBT);
        let (season, coins, day, beat) = (p.season, p.coins, p.day, (p.coins + DEBT) as i64 - p.start_coins as i64 > p.kaito_pnl);
        self.badge("debt_free", &id); self.post(&id, format!("paid off the 5,000 coin debt on day {day}"));
        if day <= 6 { self.badge("early_bird", &id); }
        if beat { self.badge("beat_kaito", &id); }
        self.rank(Entry { account: id, season, score: coins + DEBT, day, won: true });
    }

    // ---------------- operator: commit and reveal ----------------
    pub fn commit_day(&mut self, player: AccountId, day: u8, commitment: String, npc_moves: Vec<NpcMove>) {
        self.assert_operator();
        require!(commitment.len() == 64, "commitment must be a sha256 hex");
        require!(npc_moves.len() <= 8, "too many agent moves");
        let p = self.player_mut(&player);
        require!(!p.finished && p.day == day, "wrong day");
        require!(p.commitment.is_none(), "already committed");
        if p.mined_day != day { p.mined = 0; }
        p.catches_today = 0;
        p.commitment = Some(commitment); p.npc_moves = npc_moves;
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
        // trades pay on the event only: the overnight drift and noise (and your own selling during the day) do not count
        let pre = prices.clone();
        for &(g, m) in EVENTS[event as usize] { prices[g] = (prices[g] * m / 1000).max(1); }

        // positions
        let mut results = vec![]; let mut badges: Vec<&str> = vec![];
        let rita: Option<NpcMove> = p.npc_moves.iter().find(|m| m.npc.as_str().starts_with("rita.")).cloned();
        for pos in p.positions.drain(..) {
            let pnl = settle(&Position { entry: pre[pos.good as usize], ..pos.clone() }, prices[pos.good as usize]);
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
        let loss = 0;
        // NPC trades settle against the same prices
        for m in p.npc_moves.clone() {
            let stake = if m.npc.as_str().starts_with("kaito.") { 200 * 100 } else { 100 * 100 };
            if let Some(led) = self.npcs.get_mut(&m.npc) {
                let pos = Position { good: m.good, long: m.long, lev: 5, stake, entry: pre[m.good as usize] };
                let pnl = settle(&pos, prices[m.good as usize]).max(-(pos.stake as i64));
                *led += pnl;
                if m.npc.as_str().starts_with("kaito.") { p.kaito_pnl += pnl; } // Kaito's result on YOUR days only
            }
        }
        p.prices = prices.clone(); p.commitment = None; p.npc_moves = vec![]; p.asleep = false; p.passed_out = false;
        p.energy = ENERGY_MAX; p.catches_today = 0; p.votes_today = 0; p.enc_today = 0; p.fed_today = 0; p.wild = None;
        p.daily = vec![0; 7]; p.quests_claimed = 0;
        if let Some(t) = p.lead.clone() { if self.owners.get(&t) == Some(&player) { self.add_xp(&t, 10); } } // your companion grows with you
        if day >= SEASON_DAYS {
            p.finished = true; p.won = p.coins >= DEBT;
            if p.won { p.coins -= DEBT; badges.push("debt_free"); }
            let score = if p.won { p.coins + DEBT } else { p.coins };
            if p.won { p.seasons_won += 1; }
            p.best_score = p.best_score.max(score);
            if score as i64 - p.start_coins as i64 > p.kaito_pnl { badges.push("beat_kaito"); }
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

    /// Escape hatch: if a day can never be revealed (the server lost its secret), the operator cancels it.
    /// Open trades are refunded and the same day starts again.
    pub fn void_day(&mut self, player: AccountId) {
        self.assert_operator();
        let p = self.player_mut(&player);
        require!(!p.finished && p.commitment.is_some(), "nothing to cancel");
        let refund: u64 = p.positions.drain(..).map(|x| x.stake).sum();
        p.coins += refund; p.commitment = None; p.npc_moves = vec![]; p.asleep = false; p.passed_out = false;
        log!("day {} of {} cancelled by the operator", p.day, player);
    }

    /// One row per account (its best), top 20.
    fn rank(&mut self, e: Entry) {
        let better = |a: &Entry, b: &Entry| (a.won, a.score, std::cmp::Reverse(a.day)) > (b.won, b.score, std::cmp::Reverse(b.day));
        if let Some(i) = self.leaderboard.iter().position(|x| x.account == e.account) {
            if !better(&e, &self.leaderboard[i]) { return; }
            self.leaderboard.remove(i);
        }
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
        self.mint(&t, id, 1); // the record that you earned it (stays even if you send the NFT away)
        let tid = self.new_token_id("b");
        self.tokens.insert(tid.clone(), Tok::Badge { name: name.to_string() });
        self.give_token(&tid, id);
        true
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
    /// NEP-245 transfer of goods and items between traders (badges are soulbound). Needs 1 yoctoNEAR, so it takes a
    /// full-access key: the in-game key cannot attach a deposit, so the game itself does not offer trading between players.
    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        require!(env::attached_deposit() == NearToken::from_yoctonear(1), "requires 1 yoctoNEAR");
        require!(approval.is_none(), "approvals not supported");
        let from = env::predecessor_account_id();
        require!(!token_id.starts_with("badge_"), "badges stay with the player who earned them");
        require!(self.players.contains_key(&receiver_id) && receiver_id != from, "the receiver is not a trader");
        if let Some(g) = GOODS.iter().position(|t| *t == token_id) {
            let _ = g; let total: u128 = (0..NG).map(|x| self.bal(GOODS[x], &receiver_id)).sum();
            require!(total + amount.0 <= BARN_CAP, "their barn is full");
        } else {
            require!(amount.0 == 1 && self.bal(&token_id, &receiver_id) == 0, "they already have that item");
        }
        let k = format!("{token_id}|{from}"); let bal = *self.balances.get(&k).unwrap_or(&0);
        require!(bal >= amount.0 && amount.0 > 0, "not enough balance");
        self.balances.insert(k, bal - amount.0);
        *self.balances.entry(format!("{token_id}|{receiver_id}")).or_insert(0) += amount.0;
        log!(r#"EVENT_JSON:{{"standard":"nep245","version":"1.0.0","event":"mt_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","token_ids":["{}"],"amounts":["{}"]{}}}]}}"#,
            from, receiver_id, token_id, amount.0, memo.map(|m| format!(r#","memo":"{}""#, m.replace('"', "'"))).unwrap_or_default());
    }

    // ---------------- views ----------------
    pub fn get_player(&self, account_id: AccountId) -> Option<Player> { self.players.get(&account_id).cloned() }
    /// Ghost notes left in a world (0 town, 1 woods, 2 shrine, 3 sky, 4 moon), newest last.
    pub fn get_notes(&self, world: u8) -> Vec<Note> { self.notes.iter().filter(|n| n.world == world).cloned().collect() }
    /// What happened on the island lately, newest last.
    pub fn get_feed(&self) -> Vec<FeedItem> { (*self.feed).clone() }
    /// The world boss, if one is up (or was the last one). `due` says whether a new one would appear on the next hit.
    pub fn get_boss(&self) -> Option<Boss> {
        let now = env::block_timestamp_ms(); let w = now / BOSS_WINDOW_MS;
        if let Some(b) = &*self.boss { if (b.hp > 0 && now < b.ends) || b.killed_by.is_some() && now < b.ends + BOSS_WINDOW_MS { return Some(b.clone()); } }
        if self.boss_window != w && env::sha256(format!("pixel-bazaar|boss|{w}").as_bytes())[0] < BOSS_CHANCE {
            let r = env::sha256(format!("pixel-bazaar|boss|{w}").as_bytes());
            return Some(Boss { id: 0, species: BOSS_FORMS[(r[1] % 3) as usize], hp: BOSS_HP, max: BOSS_HP, ends: (w + 1) * BOSS_WINDOW_MS, hitters: vec![], killed_by: None });
        }
        None
    }
    /// The operator can wake a world boss for a live event (otherwise they come on their own, rarely).
    pub fn summon_boss(&mut self, species: u8) {
        self.assert_operator();
        require!(BOSS_FORMS.contains(&species), "not a boss");
        require!((*self.boss).as_ref().map(|b| b.hp <= 0 || env::block_timestamp_ms() >= b.ends).unwrap_or(true), "a boss is already up");
        self.spawn_boss(species, env::block_timestamp_ms() + BOSS_WINDOW_MS);
    }
    /// Barn goods (same order as GOODS), items and badges in one call.
    pub fn get_inventory(&self, account_id: AccountId) -> (Vec<u32>, Vec<String>) {
        let barn = (0..NG).map(|g| self.bal(GOODS[g], &account_id) as u32).collect();
        let mut owned = vec![];
        for (t, _) in ITEMS.iter() { if self.bal(t, &account_id) > 0 { owned.push(t.to_string()); } }
        for b in BADGES {
            if self.bal(&format!("badge_{b}"), &account_id) > 0 { owned.push(format!("badge_{b}")); }
        }
        (barn, owned)
    }
    pub fn get_leaderboard(&self) -> Vec<Entry> { self.leaderboard.clone() }
    pub fn get_npcs(&self) -> Vec<(AccountId, i64)> { self.npcs.iter().map(|(a, c)| (a.clone(), *c)).collect() }
    pub fn get_operator(&self) -> AccountId { self.operator.clone() }
}


// ---------------- spirits and NEP-171 NFTs ----------------
#[near]
impl Contract {
    fn new_token_id(&mut self, prefix: &str) -> String { self.next_token += 1; format!("{prefix}{}", self.next_token) }
    fn give_token(&mut self, tid: &str, to: &AccountId) {
        self.owners.insert(tid.to_string(), to.clone());
        self.by_owner.entry(to.clone()).or_insert_with(Vec::new).push(tid.to_string());
        log!(r#"EVENT_JSON:{{"standard":"nep171","version":"1.2.0","event":"nft_mint","data":[{{"owner_id":"{}","token_ids":["{}"]}}]}}"#, to, tid);
    }
    fn move_token(&mut self, tid: &str, from: &AccountId, to: &AccountId, memo: Option<&str>) {
        require!(from != to, "already there");
        if let Some(v) = self.by_owner.get_mut(from) { v.retain(|t| t != tid); }
        self.owners.insert(tid.to_string(), to.clone());
        self.by_owner.entry(to.clone()).or_insert_with(Vec::new).push(tid.to_string());
        if let Some(p) = self.players.get_mut(from) { if p.lead.as_deref() == Some(tid) { p.lead = None; } }
        log!(r#"EVENT_JSON:{{"standard":"nep171","version":"1.2.0","event":"nft_transfer","data":[{{"old_owner_id":"{}","new_owner_id":"{}","token_ids":["{}"]{}}}]}}"#,
            from, to, tid, memo.map(|m| format!(r#","memo":"{}""#, m.replace(['"', '\\'], "'"))).unwrap_or_default());
    }
    fn post(&mut self, who: &AccountId, text: String) {
        self.feed.push(FeedItem { at: env::block_timestamp_ms(), who: who.clone(), text });
        if self.feed.len() > FEED_KEPT { (*self.feed).remove(0); }
    }
    /// A world boss shows up in a 2-day window only when the window's roll is low (about once a month).
    fn maybe_spawn_boss(&mut self, now: u64) {
        let w = now / BOSS_WINDOW_MS;
        if self.boss_window == w || (*self.boss).as_ref().map(|b| b.hp > 0 && now < b.ends).unwrap_or(false) { return; }
        self.boss_window = w;
        let r = env::sha256(format!("pixel-bazaar|boss|{w}").as_bytes());
        if r[0] < BOSS_CHANCE { self.spawn_boss(BOSS_FORMS[(r[1] % 3) as usize], (w + 1) * BOSS_WINDOW_MS); }
    }
    fn spawn_boss(&mut self, species: u8, ends: u64) {
        let id = (*self.boss).as_ref().map(|b| b.id + 1).unwrap_or(1);
        *self.boss = Some(Boss { id, species, hp: BOSS_HP, max: BOSS_HP, ends, hitters: vec![], killed_by: None });
        let me = env::current_account_id(); // the island itself speaks
        self.post(&me, format!("THE {} DESCENDS ON THE ISLAND! Everyone, fight!", SPECIES[species as usize].1.to_uppercase()));
    }
    fn mint_spirit(&mut self, to: &AccountId, species: u8, shiny: bool) -> String {
        let tid = self.new_token_id("s");
        self.tokens.insert(tid.clone(), Tok::Spirit { species, shiny, xp: 0 });
        self.give_token(&tid, to);
        tid
    }
    fn add_xp(&mut self, tid: &str, n: u32) {
        if let Some(Tok::Spirit { xp, .. }) = self.tokens.get_mut(tid) { *xp = (*xp + n).min(40 * 20); }
    }
    fn assert_owns_spirit(&self, id: &AccountId, tid: &str) {
        require!(self.owners.get(tid) == Some(id), "that spirit is not with you");
        require!(matches!(self.tokens.get(tid), Some(Tok::Spirit { .. })), "not a spirit");
    }
    fn spirit_species(&self, tid: &str) -> Option<u8> { match self.tokens.get(tid) { Some(Tok::Spirit { species, .. }) => Some(*species), _ => None } }
    fn lead_element(&self, id: &AccountId, p: &Player) -> Option<u8> {
        let t = p.lead.as_ref()?; if self.owners.get(t) != Some(id) { return None; }
        self.spirit_species(t).map(|s| SPECIES[s as usize].2)
    }
    fn owns_element(&self, id: &AccountId, el: u8) -> bool {
        self.by_owner.get(id).map(|v| v.iter().any(|t| self.spirit_species(t).map(|s| SPECIES[s as usize].2 == el).unwrap_or(false))).unwrap_or(false)
    }

    // ----- wallet link: the wallet asks (signed with its own key), the game account confirms in `act` -----
    #[payable]
    pub fn link_wallet(&mut self, game_account: AccountId) {
        require!(env::attached_deposit() == NearToken::from_yoctonear(1), "requires 1 yoctoNEAR (sign with your wallet)");
        require!(self.players.contains_key(&game_account), "no trader with that name");
        self.links.insert(game_account, env::predecessor_account_id());
    }
    pub fn get_link_request(&self, game_account: AccountId) -> Option<AccountId> { self.links.get(&game_account).cloned() }

    // ----- NEP-171 -----
    #[payable]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>) {
        require!(env::attached_deposit() == NearToken::from_yoctonear(1), "requires 1 yoctoNEAR");
        require!(approval_id.is_none(), "approvals not supported");
        let from = env::predecessor_account_id();
        require!(self.owners.get(&token_id) == Some(&from), "not the owner");
        self.move_token(&token_id, &from, &receiver_id, memo.as_deref());
    }
    pub fn nft_token(&self, token_id: String) -> Option<JsonToken> {
        let owner = self.owners.get(&token_id)?.clone();
        Some(JsonToken { metadata: self.meta(&token_id), token_id, owner_id: owner })
    }
    pub fn nft_total_supply(&self) -> U128 { U128(self.next_token as u128) }
    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 { U128(self.by_owner.get(&account_id).map(|v| v.len()).unwrap_or(0) as u128) }
    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let v = self.by_owner.get(&account_id).cloned().unwrap_or_default();
        let from = from_index.map(|x| x.0 as usize).unwrap_or(0); let lim = limit.unwrap_or(50).min(100) as usize;
        v.iter().skip(from).take(lim).filter_map(|t| self.nft_token(t.clone())).collect()
    }
    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let from = from_index.map(|x| x.0 as u64).unwrap_or(0); let lim = limit.unwrap_or(50).min(100);
        let mut out = vec![];
        for n in from + 1..=self.next_token {
            if out.len() as u64 >= lim { break; }
            for pre in ["s", "b", "f"] { if let Some(t) = self.nft_token(format!("{pre}{n}")) { out.push(t); } }
        }
        out
    }
    pub fn nft_metadata(&self) -> ContractMetadata {
        ContractMetadata { spec: "nft-1.0.0".into(), name: "Lantern Isles Spirits".into(), symbol: "SPIRIT".into(), icon: None,
            base_uri: Some(NFT_BASE.into()), reference: None, reference_hash: None }
    }
    fn meta(&self, tid: &str) -> TokenMetadata {
        match self.tokens.get(tid) {
            Some(Tok::Spirit { species, shiny, xp }) => {
                let sp = SPECIES[*species as usize]; let el = ["Fire", "Water", "Wind", "Earth", "Nature", "Spirit", "Dark"][sp.2 as usize];
                let rar = ["Common", "Uncommon", "Rare", "Legendary"][sp.3 as usize];
                TokenMetadata {
                    title: format!("{}{} (Lv {})", if *shiny { "Shiny " } else { "" }, sp.1, spirit_level(*xp)),
                    description: format!("A {} {} spirit from the Lantern Isles (Pixel Bazaar on NEAR).", rar.to_lowercase(), el.to_lowercase()),
                    media: format!("{NFT_BASE}/spirits/{}{}.png", sp.0, if *shiny { "_shiny" } else { "" }), copies: 1,
                    extra: format!(r#"{{"species":"{}","element":"{}","rarity":"{}","level":{},"xp":{},"hp":{},"atk":{},"spd":{},"shiny":{}}}"#, sp.1, el, rar, spirit_level(*xp), xp, sp.4, sp.5, sp.6, shiny),
                }
            }
            Some(Tok::Badge { name }) => TokenMetadata { title: format!("Badge: {}", name.replace('_', " ")), description: "An achievement badge from Pixel Bazaar on NEAR.".into(),
                media: format!("{NFT_BASE}/badges/{name}.png"), copies: 1, extra: format!(r#"{{"badge":"{name}"}}"#) },
            Some(Tok::Fish { kind }) => TokenMetadata { title: format!("Legendary fish: {}", LEGENDS[*kind as usize].0), description: "A legendary catch from the Lantern Isles. Only one per player, ever.".into(),
                media: format!("{NFT_BASE}/fish/{kind}.png"), copies: 1, extra: format!(r#"{{"fish":"{}"}}"#, LEGENDS[*kind as usize].0) },
            None => env::panic_str("no such token"),
        }
    }
    /// The spirits an account holds, with stats (for the game UI).
    pub fn get_spirits(&self, account_id: AccountId) -> Vec<SpiritView> {
        self.by_owner.get(&account_id).cloned().unwrap_or_default().into_iter().filter_map(|t| match self.tokens.get(&t) {
            Some(Tok::Spirit { species, shiny, xp }) => { let sp = SPECIES[*species as usize]; let lv = spirit_level(*xp) as u16;
                Some(SpiritView { token_id: t.clone(), species: *species, name: sp.1.into(), element: sp.2, rarity: sp.3, shiny: *shiny, xp: *xp, level: lv as u8,
                    hp: sp.4 + sp.4 * (lv - 1) / 20, atk: sp.5 + sp.5 * (lv - 1) / 20, spd: sp.6 + sp.6 * (lv - 1) / 25 }) }
            _ => None }).collect()
    }
}

pub const BADGES: [&str; 22] = ["first_harvest", "green_thumb", "jade_hunter", "angler", "x10_survivor", "faded_rita", "beat_kaito", "debt_free", "early_bird", "restorer", "best_friend",
    "first_spirit", "spirit_tamer", "shiny_hunter", "legend_tamer", "wallet_linked", "lantern_seeker", "lantern_keeper", "spirit_champion", "fishing_legend", "island_oracle", "boss_slayer"];
fn use_energy(p: &mut Player, n: u16) { require!(p.energy >= n, "you are too tired"); p.energy -= n; }

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(who: AccountId) { testing_env!(VMContextBuilder::new().current_account_id("bazaar.testnet".parse().unwrap()).predecessor_account_id(who).build()); }
    fn op() -> AccountId { accounts(0) }
    fn pl() -> AccountId { accounts(1) }
    fn setup() -> Contract { ctx(op()); let mut c = Contract::new(op()); c.players.insert(pl(), new_player(1)); ctx(pl()); c }
    fn commit(c: &mut Contract, day: u8, event: u8, salt: &str) {
        let season = c.get_player(pl()).unwrap().season;
        let h = hex::encode(env::sha256(commit_preimage(&pl(), season, day, event, "r", salt).as_bytes()));
        ctx(op()); c.commit_day(pl(), day, h, vec![]); ctx(pl());
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
        assert_eq!(p.seasons_won, 1); assert_eq!(p.best_score, 6000 * 100);
        c.start_season(); assert_eq!(c.get_player(pl()).unwrap().seasons_won, 1);
        assert_eq!(c.mt_balance_of(pl(), "badge_early_bird".into()).0, 1);
    }

    // ---------- regression tests for the security audit ----------
    #[test]
    #[should_panic(expected = "finish this season first")]
    fn audit_no_restart_mid_season() { let mut c = setup(); c.start_season(); }

    #[test]
    #[should_panic(expected = "not started")]
    fn audit_no_actions_before_commit() { let mut c = setup(); c.act(vec![Action::Fish { ok: true }]); }

    #[test]
    fn audit_fishing_limit_holds_across_nights() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.act((0..6).map(|_| Action::Fish { ok: true }).collect());
        night(&mut c, 1, 2); commit(&mut c, 2, 2, "s");
        c.act((0..6).map(|_| Action::Fish { ok: true }).collect());
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Fish { ok: true }])));
        assert!(r.is_err(), "a 7th cast on day 2 must fail");
        assert!(c.mt_balance_of(pl(), "fish".into()).0 <= 12);
    }

    #[test]
    fn audit_fishing_is_decided_on_chain() {
        let mut c = setup(); c.players.get_mut(&pl()).unwrap().energy = 100;
        commit(&mut c, 1, 2, "s");
        c.act((0..6).map(|_| Action::Fish { ok: false }).collect());
        assert_eq!(c.mt_balance_of(pl(), "fish".into()).0, 0, "a lost mini-game never catches");
    }

    #[test]
    fn audit_rolls_are_fixed_for_the_day() {
        // the same mining move gives the same result whatever block it lands in: no rerolling by reverting
        let a = roll(&"a".repeat(64), &pl(), "mine", 3);
        testing_env!(VMContextBuilder::new().random_seed([9; 32]).build());
        assert_eq!(a, roll(&"a".repeat(64), &pl(), "mine", 3));
    }

    #[test]
    fn audit_selling_does_not_make_trades_profitable() {
        let mut c = setup(); c.players.get_mut(&pl()).unwrap().coins = 2000 * 100;
        c.buy_item("license_x5".into()); c.buy_item("license_x10".into());
        commit(&mut c, 1, 2, "s");
        c.barn_add(&pl(), 10, 30);
        c.act(vec![Action::Sell { good: 10, qty: 30 }]);              // pushes the apple price down
        c.open_position(10, true, 10, 1000 * 100);
        let log = night(&mut c, 1, 2);                                  // tea event: apples do not move
        assert_eq!(log.results[0].pnl, 0, "only the event pays");
    }

    #[test]
    fn audit_no_weather_on_chain_and_no_join() {
        let mut c = setup(); commit(&mut c, 1, 0, "s");
        let v = near_sdk::serde_json::to_value(c.get_player(pl()).unwrap()).unwrap();
        assert!(v.get("weather").is_none());
    }

    #[test]
    fn audit_transfer_rules() {
        let mut c = setup();
        let b = accounts(2); c.players.insert(b.clone(), new_player(1));
        c.barn_add(&pl(), 11, 5); c.barn_add(&b, 12, 38);
        c.badge("angler", &pl());
        let send = |c: &mut Contract, t: &str, n: u128| {
            testing_env!(VMContextBuilder::new().current_account_id("bazaar.testnet".parse().unwrap()).predecessor_account_id(pl()).attached_deposit(NearToken::from_yoctonear(1)).build());
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.mt_transfer(b.clone(), t.into(), U128(n), None, None))).is_ok()
        };
        assert!(send(&mut c, "jade", 2));                // fits: 38 + 2 = 40
        assert!(!send(&mut c, "jade", 1));               // barn full
        assert!(!send(&mut c, "badge_angler", 1));       // soulbound
    }

    #[test]
    fn audit_kaito_is_per_player_and_leaderboard_has_one_row_each() {
        let mut c = setup();
        c.npcs.insert("kaito.bazaar.testnet".parse().unwrap(), 0);
        let season = c.get_player(pl()).unwrap().season;
        let h = hex::encode(env::sha256(commit_preimage(&pl(), season, 1, 0, "r", "s").as_bytes()));
        ctx(op()); c.commit_day(pl(), 1, h, vec![NpcMove { npc: "kaito.bazaar.testnet".parse().unwrap(), good: 1, long: true }]); ctx(pl());
        night(&mut c, 1, 0);
        let p = c.get_player(pl()).unwrap(); assert!(p.kaito_pnl > 0);
        c.rank(Entry { account: pl(), season: 1, score: 10, day: 10, won: false });
        c.rank(Entry { account: pl(), season: 2, score: 50, day: 10, won: false });
        c.rank(Entry { account: pl(), season: 3, score: 20, day: 10, won: false });
        let lb = c.get_leaderboard(); assert_eq!(lb.len(), 1); assert_eq!(lb[0].score, 50);
    }

    #[test]
    fn audit_void_day_refunds_and_restarts_the_day() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.open_position(1, true, 2, 100 * 100); c.sleep(false);
        ctx(op()); c.void_day(pl()); ctx(pl());
        let p = c.get_player(pl()).unwrap();
        assert!(p.commitment.is_none() && !p.asleep && p.positions.is_empty() && p.coins == START_COINS && p.day == 1);
    }

    #[test]
    #[should_panic(expected = "no such good")]
    fn audit_gift_checks_the_good() { let mut c = setup(); commit(&mut c, 1, 2, "s"); c.act(vec![Action::Gift { npc: 0, good: 99 }]); }

    #[test]
    fn audit_passing_out_costs_nothing_hidden() { let mut c = setup(); commit(&mut c, 1, 2, "s"); c.sleep(true); ctx(op()); let l = c.settle_day(pl(), 1, 2, "r".into(), "s".into()); assert_eq!(l.passed_out_loss, 0); }

    // ---------- spirits and NFTs ----------
    fn catch_one(c: &mut Contract, zone: u8) -> Option<String> {
        // try encounters until one is caught (rolls are fixed per day, so this is deterministic)
        for _ in 0..ENCOUNTERS_A_DAY {
            let before = c.get_spirits(pl()).len();
            let p = c.players.get_mut(&pl()).unwrap(); p.energy = 100;
            c.act(vec![Action::Encounter { zone }, Action::Catch { ok: true }]);
            let v = c.get_spirits(pl()); if v.len() > before { return Some(v.last().unwrap().token_id.clone()); }
        }
        None
    }
    #[test]
    fn spirits_catch_mint_nft_and_badge() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = catch_one(&mut c, 0).expect("caught something in town");
        let tok = c.nft_token(t.clone()).unwrap();
        assert_eq!(tok.owner_id, pl()); assert!(tok.metadata.media.contains("/spirits/"));
        assert_eq!(c.mt_balance_of(pl(), "badge_first_spirit".into()).0, 1);
        let all = c.nft_tokens_for_owner(pl(), None, None);
        assert!(all.iter().any(|x| x.metadata.title.starts_with("Badge")), "badges are NFTs too");
        assert!(c.get_player(pl()).unwrap().book != 0);
    }
    #[test]
    #[should_panic(expected = "water spirit")]
    fn spirits_shrine_needs_a_water_spirit() { let mut c = setup(); commit(&mut c, 1, 2, "s"); c.act(vec![Action::Encounter { zone: 2 }]); }
    #[test]
    #[should_panic(expected = "no spirit here")]
    fn spirits_no_catch_without_encounter() { let mut c = setup(); commit(&mut c, 1, 2, "s"); c.act(vec![Action::Catch { ok: true }]); }
    #[test]
    fn spirits_lost_minigame_never_catches() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        for _ in 0..6 { c.act(vec![Action::Encounter { zone: 0 }, Action::Catch { ok: false }]); }
        assert!(c.get_spirits(pl()).is_empty());
    }
    #[test]
    fn spirits_lead_feeds_levels_and_evolves_keeping_the_token() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 20, false); // Bubble Slime, evolves at Lv 8
        c.act(vec![Action::SetLead { token: t.clone() }]);
        night(&mut c, 1, 2); // +10 xp for the lead at night
        assert_eq!(c.get_spirits(pl())[0].xp, 10);
        commit(&mut c, 2, 2, "s");
        c.barn_add(&pl(), 11, 5);
        c.act((0..5).map(|_| Action::Feed { token: t.clone(), good: 11 }).collect()); // 5 jade = +125 xp
        assert_eq!(c.get_spirits(pl())[0].level, 7);
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Feed { token: t.clone(), good: 11 }])));
        assert!(r.is_err(), "only 5 meals a day");
        night(&mut c, 2, 2); commit(&mut c, 3, 2, "s"); // another night with you: Lv 8
        assert!(c.get_spirits(pl())[0].level >= 8);
        c.act(vec![Action::Evolve { token: t.clone() }]);
        let v = c.get_spirits(pl()); assert_eq!(v[0].species, 21); assert_eq!(v[0].token_id, t, "same NFT, new form");
    }
    #[test]
    #[should_panic(expected = "lantern shard")]
    fn spirits_last_forms_need_a_shard() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 1, false); c.add_xp(&t, 800);
        c.act(vec![Action::Evolve { token: t }]);
    }
    #[test]
    fn wallet_link_send_and_bring_back() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 0, true);
        let w: AccountId = "towhid.testnet".parse().unwrap();
        testing_env!(VMContextBuilder::new().current_account_id("bazaar.testnet".parse().unwrap()).predecessor_account_id(w.clone()).attached_deposit(NearToken::from_yoctonear(1)).build());
        c.link_wallet(pl());
        ctx(pl()); c.act(vec![Action::ConfirmWallet { wallet: w.clone() }, Action::SendToWallet { token: t.clone() }]);
        assert_eq!(c.nft_token(t.clone()).unwrap().owner_id, w);
        assert!(c.get_spirits(pl()).is_empty());
        testing_env!(VMContextBuilder::new().current_account_id("bazaar.testnet".parse().unwrap()).predecessor_account_id(w.clone()).attached_deposit(NearToken::from_yoctonear(1)).build());
        c.nft_transfer(pl(), t.clone(), None, None);
        assert_eq!(c.nft_token(t).unwrap().owner_id, pl());
    }
    #[test]
    #[should_panic(expected = "ask from your wallet first")]
    fn wallet_cannot_link_without_the_wallet_signing() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.act(vec![Action::ConfirmWallet { wallet: "thief.testnet".parse().unwrap() }]);
    }
    #[test]
    #[should_panic(expected = "link a wallet first")]
    fn wallet_send_needs_a_link() {
        let mut c = setup(); commit(&mut c, 1, 2, "s"); let t = c.mint_spirit(&pl(), 0, false);
        c.act(vec![Action::SendToWallet { token: t }]);
    }
    #[test]
    fn spirits_encounter_limit_and_reset() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.players.get_mut(&pl()).unwrap().energy = 100;
        c.act((0..ENCOUNTERS_A_DAY).map(|_| Action::Encounter { zone: 0 }).collect());
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Encounter { zone: 0 }])));
        assert!(r.is_err());
        night(&mut c, 1, 2); commit(&mut c, 2, 2, "s");
        c.act(vec![Action::Encounter { zone: 0 }]);
    }

    #[test]
    fn puzzles_need_the_days_order_and_pay_a_shard_once_a_day() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let commitment = c.get_player(pl()).unwrap().commitment.unwrap();
        let right = puzzle_order(&commitment, &pl(), 0);
        let mut wrong = right.clone(); wrong.swap(0, 1);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Solve { puzzle: 0, answer: wrong.clone() }]))).is_err());
        c.act(vec![Action::Solve { puzzle: 0, answer: right.clone() }]);
        let p = c.get_player(pl()).unwrap(); assert_eq!(p.shards, 1); assert_eq!(p.clues, 1);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Solve { puzzle: 0, answer: right.clone() }]))).is_err(), "once a day");
        night(&mut c, 1, 2); commit(&mut c, 2, 2, "s");
        let c2 = c.get_player(pl()).unwrap().commitment.unwrap();
        c.act(vec![Action::Solve { puzzle: 0, answer: puzzle_order(&c2, &pl(), 0) }]);
        assert_eq!(c.get_player(pl()).unwrap().shards, 2);
    }
    #[test]
    #[should_panic(expected = "under water")]
    fn shrine_puzzle_needs_a_water_spirit() { let mut c = setup(); commit(&mut c, 1, 2, "s"); c.act(vec![Action::Solve { puzzle: 1, answer: vec![0, 1, 2] }]); }

    #[test]
    fn fate_once_a_day_with_effects() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        c.act(vec![Action::DrawFate]);
        let p = c.get_player(pl()).unwrap(); assert_eq!(p.fate.len(), 3); assert_eq!(p.fate_day, 1);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::DrawFate]))).is_err());
        night(&mut c, 1, 2); commit(&mut c, 2, 2, "s"); c.act(vec![Action::DrawFate]); // a new day, new cards
    }
    #[test]
    fn quests_pay_when_done_once() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let commitment = c.get_player(pl()).unwrap().commitment.unwrap();
        let q = QUESTS[daily_quest(&commitment, &pl(), 0) as usize];
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::ClaimQuest { slot: 0 }]))).is_err(), "not done yet");
        c.players.get_mut(&pl()).unwrap().daily[q.0 as usize] = q.1;
        let before = c.get_player(pl()).unwrap().coins;
        c.act(vec![Action::ClaimQuest { slot: 0 }]);
        assert_eq!(c.get_player(pl()).unwrap().coins, before + q.2 as u64 * 100);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::ClaimQuest { slot: 0 }]))).is_err(), "once");
        let qs: Vec<u8> = (0..3).map(|k| daily_quest(&commitment, &pl(), k)).collect();
        assert!(qs[0] != qs[1] && qs[1] != qs[2] && qs[0] != qs[2], "three different quests");
    }
    #[test]
    fn story_chapters_follow_the_game_and_end_with_the_jade_dragon() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::AdvanceStory]))).is_err());
        { let p = c.players.get_mut(&pl()).unwrap(); p.book = 1; }
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::AdvanceStory]))).is_err(), "needs a first sale too");
        c.mint(GOODS[10], &pl(), 1); c.act(vec![Action::Sell { good: 10, qty: 1 }, Action::AdvanceStory]); assert_eq!(c.get_player(pl()).unwrap().chapter, 2);
        { let p = c.players.get_mut(&pl()).unwrap(); p.clues = 7; p.boss_wins = 1; }
        for _ in 0..4 { c.act(vec![Action::AdvanceStory]); }
        let p = c.get_player(pl()).unwrap(); assert_eq!(p.chapter, 6);
        assert!(c.get_spirits(pl()).iter().any(|s| s.species == 37), "the Jade Dragon joins you");
        assert_eq!(c.mt_balance_of(pl(), "badge_lantern_keeper".into()).0, 1);
    }
    #[test]
    fn duels_are_fixed_by_the_day_and_pay_once() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 2, false); // an Inferno
        c.add_xp(&t, 40 * 20);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Duel { foe: 2, team: vec![t.clone()] }]))).is_err(), "boss needs chapter 5");
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Duel { foe: 0, team: vec![t.clone(), t.clone()] }]))).is_err(), "no doubles");
        let before = c.get_player(pl()).unwrap().coins;
        c.act(vec![Action::Duel { foe: 0, team: vec![t.clone()] }]);
        let p = c.get_player(pl()).unwrap();
        assert_eq!(p.coins, before + 40 * 100); assert_eq!(p.duel_wins, 1); // a level 40 Inferno beats Mei
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Duel { foe: 0, team: vec![t.clone()] }]))).is_err(), "once a day");
        c.players.get_mut(&pl()).unwrap().chapter = 5;
        c.act(vec![Action::Duel { foe: 2, team: vec![t.clone()] }]);
        let p = c.get_player(pl()).unwrap();
        assert_eq!(p.boss_wins & 1, 1); assert_eq!(c.mt_balance_of(pl(), "badge_spirit_champion".into()).0, 1);
        c.act(vec![Action::AdvanceStory]); assert_eq!(c.get_player(pl()).unwrap().chapter, 6);
    }
    #[test]
    fn a_weak_team_loses_but_learns() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 23, false); // a level 1 Flutter
        c.act(vec![Action::Duel { foe: 1, team: vec![t.clone()] }]);
        let p = c.get_player(pl()).unwrap(); assert_eq!(p.duel_wins, 0);
        assert!(matches!(c.tokens.get(&t), Some(Tok::Spirit { xp: 6, .. })));
        // the element wheel matters
        assert!(beats(WATER, FIRE) && !beats(FIRE, WATER));
    }
    #[test]
    fn legends_bite_only_in_season_and_once() {
        let mut got = None;
        for k in 0..60 {
            let mut c = setup(); commit(&mut c, 1, 2, &format!("s{k}"));
            let t = c.mint_spirit(&pl(), 0, false); // a fire companion: the Ember Koi is in season
            c.act(vec![Action::SetLead { token: t }]);
            for _ in 0..6 { c.act(vec![Action::Fish { ok: true }]); }
            let p = c.get_player(pl()).unwrap();
            assert_eq!(p.legends & !1, 0, "only the Ember Koi is in season");
            if p.legends & 1 != 0 { got = Some(c); break; }
        }
        let c = got.expect("the Ember Koi bites sometimes");
        let fish: Vec<_> = c.nft_tokens_for_owner(pl(), None, None).into_iter().filter(|t| t.metadata.title.starts_with("Legendary")).collect();
        assert_eq!(fish.len(), 1); assert!(fish[0].metadata.title.contains("Ember Koi"));
    }
    fn p2() -> AccountId { accounts(2) }
    fn join2(c: &mut Contract) {
        c.players.insert(p2(), new_player(1));
        let h = hex::encode(env::sha256(commit_preimage(&p2(), 1, 1, 2, "r", "t").as_bytes()));
        ctx(op()); c.commit_day(p2(), 1, h, vec![]);
    }
    #[test]
    fn ghost_notes_and_votes_build_reputation() {
        let mut c = setup(); commit(&mut c, 1, 2, "s"); join2(&mut c);
        ctx(pl()); c.act(vec![Action::LeaveNote { world: 1, x: 300, y: 200, line: 3, arg: 2 }]);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::LeaveNote { world: 1, x: 1, y: 1, line: 0, arg: 0 }]))).is_err(), "one a day");
        let id = c.get_notes(1)[0].id;
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::VoteNote { id, truth: true }]))).is_err(), "not your own");
        let coins = c.get_player(pl()).unwrap().coins;
        ctx(p2()); c.act(vec![Action::VoteNote { id, truth: true }]);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::VoteNote { id, truth: false }]))).is_err(), "one vote per note");
        assert_eq!(c.get_notes(1)[0].truth, 1);
        let a = c.get_player(pl()).unwrap(); assert_eq!(a.rep, 1); assert_eq!(a.coins, coins + 500);
    }
    #[test]
    fn curses_land_on_the_next_move_unless_a_charm_blocks_them() {
        let mut c = setup(); commit(&mut c, 1, 2, "s"); join2(&mut c);
        ctx(p2()); c.act(vec![Action::Curse { target: pl(), kind: 1 }]);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Curse { target: pl(), kind: 0 }]))).is_err(), "one a day");
        ctx(pl()); let before = c.get_player(pl()).unwrap().coins;
        c.act(vec![Action::BuyCharm]);
        let p = c.get_player(pl()).unwrap(); assert_eq!(p.coins, before - 3000 - 2500); assert_eq!(p.last_hex.unwrap().kind, 1);
        // the next curse hits the charm instead
        { c.players.get_mut(&p2()).unwrap().curse_day = 0; }
        ctx(p2()); assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::Curse { target: pl(), kind: 0 }]))).is_err(), "one curse a day per target");
        { c.players.get_mut(&pl()).unwrap().cursed_day = 0; }
        c.act(vec![Action::Curse { target: pl(), kind: 0 }]);
        let p = c.get_player(pl()).unwrap(); assert_eq!(p.charms, 0); assert!(p.hex.is_none()); assert!(p.last_hex.unwrap().blocked);
        assert!(c.get_feed().iter().any(|f| f.text.contains("charm blocked")));
    }
    #[test]
    fn the_world_boss_is_shared_and_pays_everyone_who_fought() {
        let mut c = setup(); commit(&mut c, 1, 2, "s"); join2(&mut c);
        ctx(pl()); assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let mut c2 = setup(); commit(&mut c2, 1, 2, "s"); c2.boss_window = 0; c2.act(vec![Action::BossHit]) })).is_err(), "no boss, calm sky");
        ctx(pl()); assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let mut c2 = setup(); c2.summon_boss(11) })).is_err(), "operator only");
        ctx(op()); c.summon_boss(11); c.boss_window = 0;
        for who in [pl(), p2()] {
            let t = c.mint_spirit(&who, 2, false); c.add_xp(&t, 800);
            ctx(who.clone()); c.act(vec![Action::SetLead { token: t }]);
        }
        ctx(pl()); c.act(vec![Action::BossHit, Action::BossHit, Action::BossHit]);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::BossHit]))).is_err(), "three hits each");
        let left = c.get_boss().unwrap().hp; assert!(left < BOSS_HP && left > 0);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::BossClaim]))).is_err(), "still standing");
        (*c.boss).as_mut().unwrap().hp = 1;
        ctx(p2()); c.act(vec![Action::BossHit]);
        let b = c.get_boss().unwrap(); assert_eq!(b.killed_by, Some(p2())); assert_eq!(b.hitters.len(), 2);
        for who in [pl(), p2()] { ctx(who.clone()); c.act(vec![Action::BossClaim]); assert_eq!(c.mt_balance_of(who, "badge_boss_slayer".into()).0, 1); }
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::BossClaim]))).is_err(), "once");
    }
    #[test]
    fn natural_bosses_are_rare() {
        let n = (0..3000u64).filter(|w| env::sha256(format!("pixel-bazaar|boss|{w}").as_bytes())[0] < BOSS_CHANCE).count();
        assert!(n > 100 && n < 330, "about one 2-day window in 15: {n}"); // ~ once a month
    }
    #[test]
    fn agent_traders_each_win_or_lose_on_their_own_ledger() {
        let mut c = setup();
        let ag = |n: &str| -> AccountId { format!("{n}.bazaar.testnet").parse().unwrap() };
        for n in ["kaito", "pell", "bolt", "luna"] { c.npcs.insert(ag(n), 1000 * 100); }
        let season = c.get_player(pl()).unwrap().season;
        let h = hex::encode(env::sha256(commit_preimage(&pl(), season, 1, 0, "r", "s").as_bytes()));
        // event 0 lifts good 1: Kaito and Luna are long it, Granny Pell fades Kaito, Bolt bets on another good
        ctx(op()); c.commit_day(pl(), 1, h, vec![
            NpcMove { npc: ag("kaito"), good: 1, long: true }, NpcMove { npc: ag("pell"), good: 1, long: false },
            NpcMove { npc: ag("luna"), good: 1, long: true }, NpcMove { npc: ag("bolt"), good: 5, long: true }]); ctx(pl());
        night(&mut c, 1, 0);
        let led: std::collections::HashMap<String, i64> = c.get_npcs().into_iter().map(|(a, v)| (a.to_string(), v)).collect();
        assert!(led["luna.bazaar.testnet"] > 1000 * 100 && led["pell.bazaar.testnet"] < 1000 * 100, "{led:?}");
        assert!(led["kaito.bazaar.testnet"] - 1000 * 100 == 2 * (led["luna.bazaar.testnet"] - 1000 * 100), "Kaito bets twice as big");
        ctx(op()); assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let mut c2 = setup(); ctx(op()); c2.commit_day(pl(), 1, "a".repeat(64), (0..9).map(|_| NpcMove { npc: ag("bolt"), good: 1, long: true }).collect()) })).is_err());
    }
    #[test]
    fn the_in_game_wallet_sends_items_to_any_account() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 3, false);
        c.act(vec![Action::SetLead { token: t.clone() }]);
        let friend: AccountId = "friend.testnet".parse().unwrap();
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::SendTo { token: t.clone(), to: pl() }]))).is_err(), "not to yourself");
        c.act(vec![Action::SendTo { token: t.clone(), to: friend.clone() }]);
        assert_eq!(c.nft_token(t.clone()).unwrap().owner_id, friend);
        assert!(c.get_player(pl()).unwrap().lead.is_none(), "a sent companion stops following you");
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.act(vec![Action::SendTo { token: t.clone(), to: friend.clone() }]))).is_err(), "not yours any more");
        // sign-up can add the full key behind the 12-word code
        ctx(op()); let k: PublicKey = "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp".parse().unwrap();
        let _ = c.register_player("newbie".into(), k.clone(), Some(k));
    }
    #[test]
    fn duel_rolls_are_saved_for_the_replay() {
        let mut c = setup(); commit(&mut c, 1, 2, "s");
        let t = c.mint_spirit(&pl(), 2, false); c.add_xp(&t, 800);
        c.act(vec![Action::Duel { foe: 0, team: vec![t] }]);
        let p = c.get_player(pl()).unwrap();
        assert_eq!(p.duel_seed.len(), 16); assert_eq!(p.duel_last, 0x80, "won against Mei");
    }
}
