# Pixel Bazaar

A pixel-art trading game on NEAR. You arrive in a market town owing the Harbor Master 5,000 coins, with 300 in your pocket and 10 days to pay. Every morning the locals hear rumors about tomorrow's prices. Some tell the truth, some don't, and one of them lies when she is quietly dumping the goods she talks up. You walk the town, the harbor, the woods and the farms to gather tips, then go **long or short with leverage** at the trading post before nightfall. Overnight the event hits and your positions settle, or get liquidated.

Built for NEAR HACKATHON 2026 (Games With Real Economies track).

**Disclosure (rule Q-015):** I am also submitting a second, independent project, **Sealed Calls** (https://github.com/0xTowhid/sealed-calls). The two projects share no code.

## What NEAR does in this game

| NEAR feature | Where | What it does |
|---|---|---|
| Named sub-accounts + function-call keys | `contract/src/lib.rs` `register_player`, `backend.js` | Pick a name and the game creates `yourname.<contract>` for you. Your browser holds a key that can only call this game contract (6 methods; it cannot move NEAR). No wallet, no seed phrase, no gas prompts. |
| Commit-reveal settlement | `commit_day` / `settle_day`, `server/index.mjs` | Each morning the operator commits `sha256(event, rumors, salt)` on chain before you can trade. At night it reveals; the contract rejects the reveal if it does not match. The operator cannot pick the night's event after seeing your positions (see the `operator_cannot_change_the_event` test). |
| On-chain positions and liquidation | `open_position`, `settle_day` | Coins, prices, leveraged positions and liquidations live in contract state. The client only draws them. |
| NEP-245 multi-token items | `buy_item`, `mt_balance_of`, `mt_transfer` | Leverage licenses (x5, x10), the bridge repair and the boat pass are NEP-245 tokens with `mt_mint` events. You keep them between seasons and can transfer them. |
| NPC accounts | `create_npc`, `get_npcs` | Rita has her own account (`rita.<contract>`). On days she lies, her short position is recorded on chain before the night and settles against the same prices. |
| On-chain randomness | `env::random_seed` in `settle_day` | Daily price noise. |
| Leaderboard | `get_leaderboard` | Finished seasons ranked by whether the debt was paid, then by coins. |

## Try it

### 1. Offline, no setup (30 seconds)
```
python3 -m http.server 8000      # from the repo root
```
Open http://localhost:8000. `config.js` says `mode: 'local'`, so a JavaScript copy of the contract (`shared/engine.js`) runs in the tab. Good for checking the game itself.

### 2. Against the real contract on testnet
Prerequisites (Linux or WSL): Rust (`rustup`), `cargo install cargo-near`, `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh`, Node 20+, `jq`.
```
ACCOUNT=pixelbazaar-yourname.testnet ./scripts/deploy-testnet.sh   # builds, deploys, creates rita.<account>
npm install --prefix server
CONTRACT_ID=... OPERATOR_ID=... OPERATOR_KEY=... GAME_SECRET=... node server/index.mjs   # the script prints this line
```
Open http://localhost:8080. The server serves the game with `mode: 'chain'`.

### 3. Server without NEAR (for testing the server code)
```
npm install --prefix server && MOCK=1 node server/index.mjs
```

## What to do, what you will see

| Do | See |
|---|---|
| Open the game (chain mode) and type a name | "CREATE MY ACCOUNT" creates `name.<contract>`. Bottom-left log: `✓ start_season`, `✓ commit_day` with explorer links. |
| Walk to Mei (follow the yellow arrow), press E | A rumor about tomorrow, e.g. "Three tea ships are due at dawn." |
| Walk to Tomo at the market, choose TRADE | The trading screen: good, price, faces of who said UP/DOWN, LONG/SHORT, x1 x2 x5 x10 (x5/x10 locked), stake, outcome (▲ +100 / ▼ -76). |
| Press OPEN | `✓ open_position · LONG FISH x2` in the log. Coins drop by the stake. |
| Go home (top-left house) and SLEEP | `✓ sleep`, then `✓ settle_day · reveal checked against commitment`. The night card shows the event, a price candle, your profit or LIQUIDATED stamp, who told the truth, and debt progress. |
| On a storm or cold-snap day, stay out after 18:00 | Rain or snow starts. That is a clue about tonight's event. |
| Visit the Old Sailor (harbor docks), Farmer Ozu (pay 600 to fix the bridge), the Hermit (Frost Camp), Madame Vey (woods, 40 coins) | Specialists who are reliable about their own area only. Your Journal (J) records what you learn. |
| Watch Rita | Some mornings she stands at the market with "SELLING HONEY!" over her head. On those days her rumor is a lie. |
| Reach 5,000 coins and talk to the Harbor Master | `✓ pay_debt`, season won, leaderboard. |

Controls: arrows or WASD to move, E or Space to interact, J for the Journal, M for music. On phones (landscape), use the on-screen pad.

## Tests
```
cd contract && cargo test
```
Eight unit tests: winning long, x10 liquidation, operator cannot change the event, licenses gate leverage, no trading before the day is committed, items as NEP-245 balances, a full 10-day season reaching the leaderboard, early debt payoff.

## How it is built

```
index.html, game.js     the game (canvas rendering, UI, game loop)
world.js                the 110x64 tile map with seven areas, built in code
shared/rules.js         goods, events, rumor sources, the daily plan (used by browser and server)
shared/engine.js        JavaScript copy of the contract, for offline mode and server testing
backend.js              local / mock / chain backends; signs player moves with the function-call key
vendor/near-api-js.mjs  near-api-js 7.4.0 bundled for the browser (rebuild: npm run vendor --prefix server)
server/index.mjs        operator: creates accounts, commits each morning, reveals each night. No database:
                        every day's plan is rebuilt from GAME_SECRET with an HMAC.
contract/src/lib.rs     the NEAR contract (near-sdk 5)
tools/make_chars.py     builds the character sprite sheets from LPC layers
```

Trust model, plainly: the operator knows tonight's event (it has to, to commit it). What the chain guarantees is that the operator cannot change the event after you trade, and that settlement, liquidation and items follow the contract's rules. Rumor texts and who you talked to are in the browser.

## Hackathon notes
- All code was written during the hackathon window (from 2026-11-08). No pre-existing code.
- Built with help from Claude (AI). Libraries: near-sdk (Rust), near-api-js 7.4.0, Playwright for testing.
- Art: Ninja Adventure Asset Pack (CC0) and LPC characters (CC-BY-SA 3.0 / GPL 3.0). See `CREDITS.md`.
- License: MIT for code (`LICENSE`). Art keeps its own licenses.
