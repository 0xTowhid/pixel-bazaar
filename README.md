# Pixel Bazaar

**Farm by day. Trade on rumors by night.** A pixel-art life sim on NEAR.

You arrive in a market town owing the Harbor Master 5,000 coins. You have 300 coins and 10 days to pay. Grow carrots, strawberries and pumpkins behind your house, mine jade in the Frost Camp, and fish off the pier. Every morning the locals tell you rumors about tomorrow's prices. Some tell the truth and some don't. Rita lies on the days she is quietly selling the goods she talks up. Use the rumors to time your harvest sales, and go **long or short with leverage** at Tomo's stall. Overnight the day's event hits: prices move, rain waters your crops or frost kills them, and your trades pay out or get liquidated.

Built for NEAR HACKATHON 2026, **Games With Real Economies** track.

| | |
|---|---|
| **Play it** | **https://213.165.39.157.sslip.io** (desktop or phone held sideways; no wallet needed) |
| **Contract** | [`pixelbazaar2-tow69.testnet`](https://testnet.nearblocks.io/address/pixelbazaar2-tow69.testnet) on NEAR testnet |
| **NPC accounts** | [`kaito.pixelbazaar2-tow69.testnet`](https://testnet.nearblocks.io/address/kaito.pixelbazaar2-tow69.testnet), [`rita.pixelbazaar2-tow69.testnet`](https://testnet.nearblocks.io/address/rita.pixelbazaar2-tow69.testnet) |
| **Code** | this repository (MIT) |

**Disclosure (rule Q-015):** I am also submitting a second, independent project, **Sealed Calls** (https://github.com/0xTowhid/sealed-calls). The two projects share no code.

## For judges: a 5-minute run

1. Open the game, choose **NEW TRADER**, pick a name and a password. The game creates `yourname.pixelbazaar2-tow69.testnet` and shows you a 12-word recovery code. Every ✓ line at the bottom of the screen has a **tx ↗** link to the explorer.
2. Read the morning paper (the Bazaar Bugle) and press **START DAY**. The day's event was committed on chain before you could see any rumors (`✓ commit_day`).
3. Follow the yellow arrow:
   - Talk to Mei.
   - Plant and water a seed behind your house (E, or A on a phone).
   - Open a trade at Tomo's stall.
4. After 18:00, go home and **SLEEP**. The operator reveals the night's event, and the contract checks it against the morning commitment before settling (`✓ settle_day`). The night card shows the price move, your profit or LIQUIDATED stamp, who told the truth, and what grew or froze.
5. Press **P** (or tap **PROFILE**) to see your account, stats and the 11 achievement badges. Badges are NEP-245 tokens held by your account.
6. Optional: open the game in another browser or on your phone, and choose **LOG IN** with the same name and password. You get the same trader and the same farm.

On phones, tap **FULL SCREEN** at the top (on iPhone, use Share → Add to Home Screen).

## What NEAR does in this game

| NEAR feature | Where | What it does |
|---|---|---|
| Named sub-accounts + function-call keys | `register_player` in `contract/src/lib.rs`, `backend.js` | Your name becomes `yourname.<contract>`. Your browser holds a key that can only call 7 game methods on this contract and cannot move NEAR. No wallet popups and no gas prompts. |
| Log in anywhere (password or 12-word code) | `backend.js`, `vendor/keys.mjs` | Your name and password derive your key: PBKDF2 (210k rounds) turns them into a standard 12-word NEAR seed phrase (BIP39 + SLIP-10, `m/44'/397'/0'`). The same password or the recovery code rebuilds the key on any device, and the server checks it against the account's access keys. The server stores no secret of yours. |
| Commit-reveal settlement | `commit_day` / `settle_day`, `server/index.mjs` | Each morning the operator commits `sha256(event, rumors, salt)` before you can act. At night it reveals, and the contract rejects any reveal that does not match. So the event cannot be chosen after seeing your trades (test `operator_cannot_change_the_event`). |
| Contract-run economy | `act`, `open_position`, `settle_day` | The contract holds coins, prices, leveraged trades, liquidations, farm plots, seeds, watering, growth, energy, mining and fishing results, friendships and town projects. Many small moves (water 10 plots, harvest, sell) are batched into one `act` transaction. |
| NEP-245 multi-token | `mt_balance_of`, `mt_batch_balance_of`, `mt_transfer`, `get_inventory` | Barn goods (13 kinds), items (leverage licenses, bridge, boat pass, your stall) and 11 achievement badges are NEP-245 tokens. Minting and burning them emits `mt_mint` / `mt_burn` events. |
| NPC accounts | `create_npc`, `get_npcs` | Kaito the Whale opens a public x5 trade every morning. Rita shorts the good she talks up on the days she lies. Their trades are committed with the day and settle against the same prices as yours. |
| On-chain randomness | `env::random_seed` in `act` and `settle_day` | Mining finds, gifts from Mochi the cat, daily price noise. |
| Leaderboard and profile stats | `get_leaderboard`, `Player.best_score`, `Player.seasons_won` | Finished seasons are ranked first by whether the debt was paid, then by coins. Your best season and seasons won stay on your account. |

## The game

| Do | See |
|---|---|
| Farm (plots behind your house; keys 1-9 pick the seed) | 9 crops (carrot, strawberry, pumpkin, tomato, corn, eggplant, tea, apple trees that regrow, beehives). Water them daily. Rain waters them for you; frost and blight kill unripe crops. |
| Mine boulders in the Frost Camp, fish on the lake pier | Jade, ore and fish go into your barn. Fishing is a timing mini-game. Each action uses energy. |
| Talk to locals, give gifts | Hearts fill up. At 2 hearts locals tell you how sure they are; at 4 they write to you in the morning paper. |
| Tomo: TRADE / SELL / SEEDS | Go long or short on 12 goods with x1-x10 leverage, sell your harvest, buy seeds, apple saplings and beehives. Licenses for x5 and x10 and your own stall are upgrades you keep. |
| Town board (by the market) | Donate goods and coins to rebuild the pier (double fish), fix the lighthouse (storm warnings in the paper) and open the tea house (tea sells for 15% more). |
| Pay the Harbor Master 5,000 | Badges, the leaderboard and a share image of your season. Your farm, seeds, friends and items carry into the next season. |
| P: Profile, J: Journal | Profile: account, rank, best season, seasons won, crops, jade, fish, badges (locked ones show what earns them), items, best friends, SHARE PROFILE image, LOG OUT. Journal: today's rumors, who has been right, friends, barn, recent transactions. |

Controls: arrows or WASD to move, E or Space to interact, 1-9 seeds, P Profile, J Journal, F full screen, M music. On phones (sideways): the on-screen pad and A button.

### Built to keep working on a real network
- If the morning commit or the night reveal fails, the game retries and then shows **TRY AGAIN**. It never lets you play a day that is not on chain.
- If you close the tab while asleep, that night is settled the next time you open the game.
- The operator signs its transactions one at a time, so many players at once cannot cause nonce errors. A double tap cannot commit or settle a day twice.

## Run it yourself

### 1. Offline, no setup
```
python3 -m http.server 8000      # from the repo root
```
Open http://localhost:8000. `config.js` says `mode: 'local'`, so a JavaScript copy of the contract (`shared/engine.js`) runs in the tab.

### 2. Against the real contract on testnet
You need Rust (`rustup`), `cargo-near`, `near-cli-rs`, Node 20+ and `jq`. The install lines are at the top of `scripts/deploy-testnet.sh`.
```
ACCOUNT=pixelbazaar-yourname.testnet ./scripts/deploy-testnet.sh   # builds, deploys, creates rita.<account> and kaito.<account>
npm install --prefix server --omit=dev
CONTRACT_ID=... OPERATOR_ID=... OPERATOR_KEY=... GAME_SECRET=... node server/index.mjs   # the script prints this line
```
Open http://localhost:8080. The login needs https or localhost. The public server runs the same command as a systemd service behind Caddy for https.

### 3. Server without NEAR (testing the server code)
```
npm install --prefix server && MOCK=1 node server/index.mjs
```

## Tests
```
cd contract && cargo test
```
There are 13 contract unit tests:
- winning long
- x10 liquidation
- operator cannot change the event
- licenses gate leverage
- no trading before the commit
- plant, water, grow, harvest, sell
- no early harvest
- rain waters and frost kills
- energy runs out
- gifts and town projects
- the stall sells overnight (NEP-245)
- the farm is kept across seasons
- early payoff with badges, seasons won and best score

I also played the browser game end to end in headless Chromium on desktop and phone screen sizes. The runs covered:
- logging in, a wrong password, and logging in on a new device
- a full 10-day season and a second season
- forced network failures, reloads, and closing the tab while asleep

## How it is built

```
index.html, game.js     the game: rendering, UI, game loop, trading, night and dawn, login
life.js                 farm plots, mining, fishing mini-game, Mochi the cat, seed hotbar, the `act` queue
panels.js               morning paper, selling, seeds, gifts, town board, profile, share images
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

**Trust model, plainly:**
- The operator knows tonight's event, because it has to in order to commit it.
- What the chain guarantees is that the operator cannot change the event after you act.
- Settlement, liquidation, farming and items follow the contract's rules.
- Fishing success is reported by your browser.
- Everything runs on testnet with play coins. There is no real money.

## Hackathon notes
- All code was written during the hackathon window (from 2026-11-08). No pre-existing code.
- Built with help from Claude (AI).
- Libraries: near-sdk (Rust), near-api-js 7.4.0, @scure/bip39, @noble/curves, @noble/hashes, and Playwright for testing.
- Art: Ninja Adventure Asset Pack (CC0) and LPC characters (CC-BY-SA 3.0 / GPL 3.0). Crops, icons and the app icon were drawn for this game. See `CREDITS.md`.
- License: MIT for code (`LICENSE`). Art keeps its own licenses.
