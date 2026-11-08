# Pixel Bazaar

**Farm by day. Trade on rumors by night.** A pixel-art life sim on NEAR. You arrive in a market town owing the Harbor Master 5,000 coins, with 300 in your pocket and 10 days to pay. Grow carrots, strawberries and pumpkins behind your house, mine jade in the Frost Camp, fish off the pier. Every morning the locals hear rumors about tomorrow's prices: some tell the truth, some don't, and one of them lies when she is quietly dumping the goods she talks up. Use the rumors to time your harvest sales and go **long or short with leverage** at the trading post. Overnight the event hits: prices move, rain waters your crops or frost kills them, and your positions settle or get liquidated.

Built for NEAR HACKATHON 2026 (Games With Real Economies track).

**Disclosure (rule Q-015):** I am also submitting a second, independent project, **Sealed Calls** (https://github.com/0xTowhid/sealed-calls). The two projects share no code.

## What NEAR does in this game

| NEAR feature | Where | What it does |
|---|---|---|
| Named sub-accounts + function-call keys | `register_player` in `contract/src/lib.rs`, `backend.js` | Pick a name and the game creates `yourname.<contract>`. Your browser holds a key that can only call this game contract (7 methods; it cannot move NEAR). No wallet, no gas prompts. |
| Log in anywhere (password or 12-word code) | `backend.js`, `vendor/keys.mjs` | Your name + password derive the key (PBKDF2, 210k rounds) as a standard 12-word NEAR seed phrase (BIP39 + SLIP-10, `m/44'/397'/0'`). The same password or the recovery code rebuilds the key on any device; the server checks it against the account's access keys. Nothing secret is stored on the server. |
| Commit-reveal settlement | `commit_day` / `settle_day`, `server/index.mjs` | Each morning the operator commits `sha256(event, rumors, salt)` before you can act. At night it reveals; the contract rejects a reveal that does not match, so the event cannot be picked after seeing your positions (test `operator_cannot_change_the_event`). |
| Contract-enforced economy | `act`, `open_position`, `settle_day` | Coins, prices, leverage positions, liquidations, farm plots, seeds, watering, growth, energy, mining and fishing results, friendships and town projects all live in contract state. Many small moves (water 10 plots, harvest, sell) go in one `act` transaction. |
| NEP-245 multi-token | `mt_balance_of`, `mt_batch_balance_of`, `mt_transfer`, `get_inventory` | Barn goods (13 kinds), items (leverage licenses, bridge, boat pass, your stall) and 11 achievement badges are NEP-245 tokens with `mt_mint` / `mt_burn` events. |
| NPC accounts | `create_npc`, `get_npcs` | Kaito the Whale (`kaito.<contract>`) opens a public x5 trade every morning; Rita (`rita.<contract>`) shorts what she talks up on the days she lies. Their trades are committed with the day and settle against the same prices. |
| On-chain randomness | `env::random_seed` in `act` and `settle_day` | Mining finds, Mochi the cat's gifts, daily price noise. |
| Leaderboard | `get_leaderboard` | Finished seasons ranked by whether the debt was paid, then by coins. |

## Try it

### 1. Offline, no setup
```
python3 -m http.server 8000      # from the repo root
```
Open http://localhost:8000. `config.js` says `mode: 'local'`, so a JavaScript copy of the contract (`shared/engine.js`) runs in the tab.

### 2. Against the real contract on testnet
Prerequisites (Linux or WSL): Rust (`rustup`), `cargo-near`, `near-cli-rs`, Node 20+, `jq` (install lines are at the top of `scripts/deploy-testnet.sh`).
```
ACCOUNT=pixelbazaar-yourname.testnet ./scripts/deploy-testnet.sh   # builds, deploys, creates rita.<account> and kaito.<account>
npm install --prefix server --omit=dev
CONTRACT_ID=... OPERATOR_ID=... OPERATOR_KEY=... GAME_SECRET=... node server/index.mjs   # the script prints this line
```
Open http://localhost:8080 (the game page needs https or localhost for the login).

### 3. Server without NEAR (testing the server code)
```
npm install --prefix server && MOCK=1 node server/index.mjs
```

## What to do, what you will see

| Do | See |
|---|---|
| Open the game, pick NEW TRADER, a name and a password | `name.<contract>` is created; you are shown your 12-word recovery code. Bottom-left log: `✓ start_season`, `✓ commit_day` with explorer links. |
| Read the morning paper, START DAY | The Bazaar Bugle: last night's event, Kaito's trade, prices, letters from friends, town projects. |
| Walk to the plots behind your house (yellow arrow), press E twice | A carrot is planted, then watered. A moment later: `✓ act · plant, water`. Keys 1-9 pick the seed. |
| Mine a boulder in the Frost Camp, fish on the lake pier (press E in the green) | "+1 JADE" / "+1 FISH" pop up; the energy bar drops. |
| Talk to Mei; choose GIVE A GIFT | Hearts fill. At 2 hearts locals tell you how sure they are; at 4 they write to you every morning. |
| Talk to Tomo: TRADE / SELL / SEEDS | Leverage trading on 12 goods (faces show who said UP/DOWN, Kaito included), selling your harvest, buying seeds, apple saplings and beehives. |
| Go home after 18:00 and SLEEP | You walk inside, night falls, `✓ settle_day · reveal checked against commitment`, dawn breaks. The night card: event, candle, your profit or LIQUIDATED stamp, who told the truth, what grew or froze, new badges. |
| Town board (by the market) | Donate fish, jade, ore, tea and coins to rebuild the pier (double fish), the lighthouse (storm warnings in the paper) and the tea house (tea +15%). |
| Reach 5,000 coins, talk to the Harbor Master | `✓ pay_debt`, badges, leaderboard, and a share image of your season. Your farm, seeds, friends and items carry into the next season. |
| Open the game in another browser, LOG IN with the same name and password | Same trader, same farm. |
| Press P (PROFILE) | Your account with an explorer link, rank, best season, seasons won, crops, jade and fish, all 11 badges (locked ones show what earns them), items, best friends, SHARE PROFILE image, LOG OUT. |

Controls: arrows or WASD to move, E or Space to interact, 1-9 seeds, J Journal, P Profile, M music. On phones (landscape), the on-screen pad.

## Tests
```
cd contract && cargo test
```
13 unit tests: winning long, x10 liquidation, operator cannot change the event, licenses gate leverage, no trading before commit, plant-water-grow-harvest-sell, no early harvest, rain waters and frost kills, energy runs out, gifts and town projects, stall sells overnight (NEP-245), farm kept across seasons, early payoff with badges.

## How it is built

```
index.html, game.js     the game: rendering, UI, game loop, trading, night and dawn
life.js                 farm plots, mining, fishing mini-game, Mochi the cat, seed hotbar, the `act` queue
panels.js               morning paper, selling, seeds, gifts, town board, share image
world.js                the 110x64 tile map with seven areas, built in code
shared/rules.js         goods, crops, events, rumor sources, Kaito, the daily plan (browser + server)
shared/engine.js        JavaScript copy of the contract, for offline mode and server testing
backend.js              local / mock / chain backends; login; signs player moves with the function-call key
vendor/                 near-api-js 7.4.0 and the key derivation, bundled for the browser
server/index.mjs        operator: creates accounts, checks login keys, commits each morning, reveals each night.
                        No database: every day's plan is rebuilt from GAME_SECRET with an HMAC.
contract/src/lib.rs     the NEAR contract (near-sdk 5)
tools/                  sprite builders (characters from LPC layers, crops and icons drawn in code)
```

Trust model, plainly: the operator knows tonight's event (it has to, to commit it). What the chain guarantees is that the operator cannot change the event after you act, and that settlement, liquidation, farming and items follow the contract's rules. Fishing success is reported by your browser.

## Hackathon notes
- All code was written during the hackathon window (from 2026-11-08). No pre-existing code.
- Built with help from Claude (AI). Libraries: near-sdk (Rust), near-api-js 7.4.0, @scure/bip39, @noble/curves, @noble/hashes, Playwright for testing.
- Art: Ninja Adventure Asset Pack (CC0), LPC characters (CC-BY-SA 3.0 / GPL 3.0), crops and icons drawn for this game. See `CREDITS.md`.
- License: MIT for code (`LICENSE`). Art keeps its own licenses.
