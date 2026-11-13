# Pixel Bazaar: The Lantern Isles

**Catch spirits, solve the mystery, trade on rumors.** A pixel-art RPG and life sim on NEAR, where every spirit, badge and legendary fish is a real NFT you own.

You arrive on the Lantern Isles owing the Harbor Master 3,000 coins, with 300 coins and 10 days to pay. Someone has stolen the Great Lantern and the spirits have gone wild. Catch them, raise them and duel with them. Follow the clues through the Whispering Woods, the Sunken Shrine and the Clockwork Sky to the old spirit gate. Every morning the locals tell you rumors about tomorrow's prices. Some tell the truth and some don't. Use them to go **long or short with leverage** at the stalls, against five agent barons who each have their own NEAR account, a sealed daily call and a stall you can take from them as an NFT. While you sleep, your spirits work the night shift. And you are not alone: other players trade spirits with you on the player market (5% of every sale is burned), work toward a shared weekly island goal, post calls, cast curses, and fight the rare world boss with you. Every season the debt grows, and you pick an omen to help. **You never pay gas**: the game relays every move.

Built for NEAR HACKATHON 2026, **Games With Real Economies** track.

| | |
|---|---|
| **Play it** | **https://pixel-bazaar.arculate.markets** or **https://213.165.39.157.sslip.io** (desktop or phone held sideways; no wallet needed to start) |
| **Contract** | [`pixelbazaar8-tow69.testnet`](https://testnet.nearblocks.io/address/pixelbazaar8-tow69.testnet) on NEAR testnet |
| **Agent accounts** | `kaito.`, `rita.`, `pell.`, `bolt.`, `luna.pixelbazaar8-tow69.testnet` (the five barons) |
| **NFT art** | [`nft/`](nft/) in this repo, served from GitHub raw links in each token's metadata |
| **Code** | this repository (MIT) |

**Disclosure (rule Q-015):** I am also submitting a second, independent project, **Sealed Calls** (https://github.com/0xTowhid/sealed-calls). The two projects share no code.

## For judges: a 5-minute run

1. Open the game. A short intro plays (SKIP works), then a short **HOW TO PLAY** book (turn the pages with the arrows or a swipe). After that you learn by playing: walk up to anything and the prompt says what it is for. The goal line at the top and a yellow arrow always point to your next step. (The full 22-page book, with chapter tabs, is in the Journal, J.)
2. Choose **NEW TRADER**, pick a name and a password. The game creates `yourname.pixelbazaar8-tow69.testnet` and shows a 12-word recovery code. Every ✓ line at the bottom of the screen links to the transaction on the explorer.
3. Read the morning paper and press **START DAY**. The day is committed on chain before you see any rumors (`✓ commit_day`).
4. Catch a spirit: walk up to a glowing wisp in the grass, press E (A on phones) and stop the bar in the green. The contract decides the catch, and the spirit is minted to you as an NFT. It follows you as your companion.
5. Press **B** for your spirits (feed, evolve, the Spirit Book, the five legendary fish). Press **WALLET**: your game account is a real NEAR account with an address, a QR code and a balance. Send any spirit, badge or fish to any NEAR address, or send NEAR out after re-typing your password.
6. Press **Q** for the story and today's three quests, talk to **Madame Vey** for three fate cards, and challenge **Mei** to a 3-vs-3 spirit duel.
7. Press **I** for the **Bazaar Board**: how many players are on the island, the barons' sealed calls (pay to PEEK one), your own call, the **player market**, this week's **island goal**, the race for each baron's stall, the feed of every player, curses and the world boss.
8. In **B → NIGHT CREW**, put up to three fed spirits to work: earth mines, water fishes, nature farms, wind runs deliveries...
9. After 18:00, go home and **SLEEP**. The contract checks the night's reveal (event, rumors and the barons' sealed calls) against the morning commitment and settles everything (`✓ settle_day`). At dawn your crew comes home with its haul.

In the first season, features open day by day (day 2 worlds and the night crew, day 3 duels, calls and the market, day 4 the baron race). To see everything at once, play a second season, or read **How to play** below.

On phones, tap **FULL SCREEN** at the top (on iPhone, use Share → Add to Home Screen).

## How to play

**The goal.** You owe the Harbor Master 3,000 coins and have 10 days. Pay him before day 10 ends to win the season. Then a new season starts: the debt grows by 500 (up to 6,000), coins restart at 300, and you keep your farm, spirits, stalls, badges and items. Along the way, solve the mystery of the stolen Great Lantern (five story chapters).

**One day.**
1. *Morning:* the paper and the locals give rumors about tomorrow's prices. Some lie: some locals always, some only on some days. Your day is committed on NEAR before you see them.
2. *Day:* farm, fish, mine, catch spirits, sell, trade, do quests. Most actions cost energy (100 a day).
3. *After 18:00:* go home and sleep (stay up too late and you pass out).
4. *Night:* the contract checks the reveal against the morning commitment and settles everything: prices, trades, crops, the barons' calls, your night crew's work. Energy refills.

**What opens when (first season only).** Day 1: farming, selling, fishing, mining, catching spirits, rumors, trading. Day 2: the other worlds, Madame Vey's fate cards, the night crew. Day 3: spirit duels, player calls and curses, the player market. Day 4: the baron race for the stalls. From season 2, everything is open.

**Making coins.**
- *Farm:* 9 crops. Plant with keys 1-9 on the plots behind your house, water daily, harvest when ripe. Rain waters for you; frost kills crops.
- *Sell:* tea, honey, carrots, fish and jade at the five barons' stalls; seeds, apples, ore and everything else at Tomo's. Prices move every night.
- *Fish, mine, forage:* fish at the pier (five legendary fish bite only when their riddle is true), mine rocks for ore and jade, shake apple trees, open each world's daily chest, pet Mochi the cat.
- *Quests:* three daily quests (Q) pay automatically. Town projects (pier, lighthouse, tea house) give lasting bonuses.

**Trading on rumors.** At a stall (or Tomo's for other goods), go LONG or SHORT on a good with leverage; x5 and x10 need a license. Trades settle at night and pay on the event only, so there is no risk-free trade. Big leverage can be liquidated. Gifts make locals friends, and friends tell you how sure they are.

**Spirits.** 39 species in 7 elements, each world with its own. Walk up to a glowing wisp, stop the bar in the green, and the contract rolls the catch; a caught spirit is minted to you as an NFT. Your companion follows you, gains XP every night, and evolves when fed (some forms need a lantern shard). Elements open worlds: fire lights the dark woods, water dives to the Sunken Shrine, wind glides to the Clockwork Sky.
- *Night crew:* up to 3 fed spirits work while you sleep, by element (earth mines, water fishes, nature farms, fire guards, wind delivers, spirit seeks shards, dark prowls for coins).
- *Duels:* pick 3 spirits against Mei, Rita (Moon Market, at night) or the Great Spirit, once a day each. Fire › nature › water › fire, wind › earth › fire, spirit ⇄ dark.

**The story.** 1: catch a spirit and sell anything. 2: the brazier puzzle in the Whispering Woods. 3: the bell puzzle in the Sunken Shrine (needs a water spirit). 4: the gear puzzle in the Clockwork Sky (needs a wind spirit). 5: beat the Great Spirit at the old gate. The ending mints the Jade Dragon. Madame Vey's three fate cards each day (a blessing, a curse and a secret) change the day's odds.

**The barons and their stalls.** Kaito (tea), Rita (honey), Granny Pell (carrots), Bolt-9 (fish) and Luna (jade) each make a sealed call every morning, revealed at night. Peek for a price and follow or fade them. Out-trade a baron on their good over the season, and pay your debt, and their **stall NFT** is yours: rent every night and 10% better prices for that good. Next season they fight back. Hold all five and finish the story to become the Lantern Keeper.

**Other players (the Bazaar Board, I).**
- *Market:* list spirits and legendary fish for coins (up to 4 at a time). The contract holds the item until it sells or you take it back. 5% of every sale is burned.
- *Island goal:* each week, one goal for every player together (harvest crops, catch fish, catch spirits or sell goods). Do your small part, and when the island reaches it, everyone who helped claims 80 coins.
- *Calls and curses:* post one call a day (a right one pays and earns reputation); curse a rival, and carry charms to block curses.
- *World boss:* rarely, one boss with one HP bar for everyone. Everyone who fights to the end gets a reward.

**Seasons and omens.** From season 2, Madame Vey turns three omens at the start of the season and you keep one all season: Golden Soil (+1 crop per harvest), Full Nets (fish bite more), Spirit Moon (easier catches), Light Pick (mining costs 5 energy, not 8), Merchant's Luck (selling pays 5% more) or Harbor Tide (+15 coins a night).

**Winning, in short:** farm and sell every day, trade only on rumors you trust, raise spirits for the worlds and the night crew, pay the debt early (by day 6 earns a badge), then take the barons' stalls season after season.

## What NEAR does in this game

| NEAR feature | Where | What it does |
|---|---|---|
| Named sub-accounts + function-call keys | `register_player` in `contract/src/lib.rs`, `backend.js` | Your name becomes `yourname.<contract>`. Your browser holds a key that can only call 7 game methods on this contract and cannot move NEAR. No wallet popups while you play. |
| **Gasless play (NEP-366 meta transactions)** | `POST /api/relay` in `server/index.mjs`, `backend.js` | Your browser signs each move as a signed delegate action; the server checks it (a player account, this contract, a player method, no deposit, at most 50 Tgas, a valid key) and relays it with the operator paying the gas. Players never need NEAR to play. Per-player and global hourly limits; it pauses before the operator runs dry. |
| Log in anywhere (password or 12-word code) | `backend.js`, `vendor/keys.mjs` | PBKDF2 (210k rounds) turns your name and password into a standard 12-word NEAR seed phrase (BIP39 + SLIP-10). Two keys come from it: a **play key** (`m/44'/397'/1'`, kept in the browser, can only call 7 game methods) and the **wallet key** (`m/44'/397'/0'`, the standard path, so the 12 words open the account in any NEAR wallet). The wallet key is never stored: the game rebuilds it from your password for a NEAR transfer and drops it. The server stores no secret of yours. |
| **NEP-171 NFTs** (spirits, badges, legendary fish) | `nft_transfer`, `nft_token`, `nft_tokens_for_owner`, `nft_metadata` | 39 spirit species (+ shiny), 22 badges and 5 one-of-one legendary fish are real NFTs with metadata and art. A spirit keeps its token id as it levels up and evolves; its metadata shows the new form and level. Standard `nft_mint` and `nft_transfer` events (NEP-171 logs), so wallets and explorers show them. |
| **Built-in wallet** | `Action::SendTo`, `register_player(public_key, full_key)`, `wallet.js` | Address with QR code, live balance, receive NEAR and NFTs, send any NFT to any account (a game action, no popups), and send NEAR signed with the wallet key. |
| Commit-reveal days | `commit_day` / `settle_day`, `server/index.mjs` | Each morning the operator commits `sha256(event, rumors, salt)`. At night the contract rejects any reveal that does not match. |
| On-chain rolls that cannot be rerolled | `roll()` | Spirit encounters, shiny odds, catches, fate cards, quests, puzzle orders, legendary fish and boss damage are rolled from the day's commitment; duels from block randomness; the night crew's haul from the commitment plus the secret salt, so it cannot be known during the day. Reverting a transaction and trying again gives the same result. |
| Contract-run economy and RPG | `act` | Coins, prices, leveraged trades and liquidations; farm, energy, mining, fishing; spirit XP, feeding, evolution; puzzles, story chapters, quests, duels. Many moves are batched into one `act` transaction. |
| **Shared island state** | `get_feed`, `get_calls`, `get_boss`, `Action::PostCall/Curse/BuyCharm/BossHit/BossClaim` | Player calls (one a day; a right call pays and earns reputation), curses that land on another player's next move unless a charm blocks them, and a world boss with one HP bar for everyone. A boss window opens about once a month, decided by `sha256` of the time window; the operator can also summon one for a live event. |
| **Agent barons with their own accounts** | `create_npc`, `get_npcs`, `settle_day`, `Action::Peek` | Kaito the Whale, Rita, Granny Pell (contrarian), Bolt-9 (gossip bot) and Luna Moonsong (stargazer) are sub-accounts with coin ledgers. Their calls are **sealed inside the morning commitment** and revealed at night (the hash must match); you can pay one to peek. Each holds the stall of one good: out-trade them on it over a season and the **stall NFT** moves to you, paying rent every night. Fade a baron and win, and you may earn a grudge (a curse). |
| **Night crews** | `Action::SetCrew`, `crew_work` | Up to three fed spirits work while you sleep, by element: earth mines ore and jade, water fishes, nature farms, fire guards, wind delivers, spirit seeks shards, dark prowls for coins. Weather and events halve or double jobs; shinies bring more. |
| **Player market** | `Action::List/Unlist/Buy`, `get_market`, `get_stats` | Players sell spirits and legendary fish to each other for coins. A listed NFT is held by the contract (a NEP-171 transfer to the contract account) until it is bought or taken back. 5% of every sale is burned; `get_stats` shows players, open listings, sales and coins burned. Coins from a sale after your season ended wait for your next season. |
| **Weekly island goal** | `Action::ClaimGoal`, `get_goal` | One shared goal a week for every player, picked by `sha256` of the week. The target grows with the number of players. Each player's part is counted in their own moves; once the island reaches the goal, everyone who did their part claims 80 coins (last week's goal stays claimable for a week). |
| **Seasons with rising stakes** | `start_season`, `Action::PickOmen` | The debt grows 500 each season up to 6,000. From season 2, three omens are dealt from `sha256(account, season)` and the player keeps one for the season; the contract applies its effect (harvest, fishing, catching, mining, selling or nightly coins). |
| NEP-245 multi-token | `mt_balance_of`, `mt_transfer`, `get_inventory` | Barn goods (13 kinds), items (licenses, bridge, boat, stall) and the record of each badge. |

## The game

| Do | See |
|---|---|
| **Spirits** (B) | 39 species in 7 elements, from Ember Kits to the Jade Dragon. Each world has its own. Catching is a timing bar; the contract decides. Your companion follows you, gains XP every night and from food, and evolves (some need a lantern shard). Elements open worlds: a water spirit lets you dive to the Sunken Shrine, a wind spirit glides you to the Clockwork Sky, a fire spirit lights the dark woods. |
| **Worlds** | Town and farm, the Whispering Woods (north), the Moon Market (open at night), the Sunken Shrine, the Clockwork Sky. Each has its own music, mood, people with tips and clues, signposts, a chest that refills every day, and a puzzle whose order changes every day. Gates are signed in town and marked on the minimap. |
| **The Lantern Mystery** (Q) | Chapter 1: catch a spirit and make your first sale. Then four more chapters with clues from each world, ending at the old spirit gate in a duel with the Great Spirit. The ending mints the Jade Dragon to you. |
| **Daily hooks** | Madame Vey's three fate cards a day (a blessing, a curse and a secret, each with a real effect), three daily quests that pay automatically, and rumors in the morning paper. |
| **Spirit duels** | Pick three spirits against Mei, Rita at the Moon Market night table, or the Great Spirit. Element wheel: fire › nature › water › fire, wind › earth › fire, spirit ⇄ dark. One duel a day per rival; the whole fight is decided on chain and shown hit by hit. |
| **Fishing legends** | Five one-of-one fish that only bite when their riddle is true (with a fire companion, on a day of The River, after the sky...). |
| **Bazaar Board** (I) | The number of players, the barons' sealed calls with their records and PEEK, your own call, the player market, the weekly island goal, the race for each stall, the feed of every player (with the barons' nightly results), curses and charms, the world boss. |
| **Night crew** (B) | Three spirits that work while you sleep, by element, with a dawn report of their haul. |
| **The bazaar** (Tomo) | Long or short on 12 goods with x1-x10 leverage against five barons. Sell your harvest, buy seeds and licenses, and take a baron's stall (an NFT that pays rent). Own all five and finish the story for the Bazaar Keeper badge. |
| **Life sim** | Farm 9 crops (rain waters them, frost kills them), mine jade, fish, give gifts until locals trust you, rebuild the town. Pay the Harbor Master to finish the season (3,000, then 500 more each season); your spirits, story and farm carry over, and you pick an omen for the new season. |
| **Made to be learned by playing** | Features open day by day in the first season, a 3-page guide, one-line hints the first times you walk up to something, and a saving dot that shows each move going to NEAR (moves show at once and are undone if NEAR says no). |

Controls: arrows or WASD, E or Space to interact, 1-9 seeds, B spirits, Q quests, I Bazaar Board, Tab menu, P profile, J journal, M music. On phones (sideways): the thumb stick and the A button.

### Built to keep working on a real network
- If the morning commit or the night reveal fails, the game retries and then shows **TRY AGAIN**. It never lets you play a day that is not on chain.
- If you close the tab while asleep, that night is settled the next time you open the game.
- The operator signs its transactions one at a time, so many players at once cannot cause nonce errors. A double tap cannot commit or settle a day twice.
- If a day can never be revealed (the server's secret changed), the operator cancels it on chain with `void_day`, refunds open trades and starts the day again.
- Moves are relayed gasless; if the relay is off, players get 0.05 NEAR for gas and are topped up when they run low. Sign-ups pause by themselves if the operator or the contract runs low on NEAR, and the server logs both balances every hour.

### Security notes (from an audit on 2026-11-12)
- Every move needs the day to be committed first; seasons can only be restarted once finished; the daily fishing limit holds across nights.
- Trades pay on the event only. Your own selling, the overnight drift and the noise do not move your trade, so there is no risk-free trade.
- The evening sky is a hint, not a certainty, and is no longer stored on chain. How sure a local sounds is only sent once you are friends.
- The server: no crash on malformed URLs, same-origin API (no CORS), rate limits per address and for all sign-ups, listens on 127.0.0.1 behind Caddy, 45 s timeout on every NEAR call.
- The server holds only the operator key (`ops.<contract>`), never the contract's own key.
- The player key is kept in the browser's local storage. It can only play this game; it cannot move NEAR.

## Run it yourself

### 1. Offline, no setup
```
python3 -m http.server 8000      # from the repo root
```
Open http://localhost:8000. `config.js` says `mode: 'local'`, so a JavaScript copy of the contract (`shared/engine.js`) runs in the tab.

### 2. Against the real contract on testnet
You need Rust (`rustup`), `cargo-near`, `near-cli-rs`, Node 20+ and `jq`. The install lines are at the top of `scripts/deploy-testnet.sh`.
```
ACCOUNT=pixelbazaar-yourname.testnet ./scripts/deploy-testnet.sh   # builds, deploys, creates ops.<account> (the operator) and the five agent accounts
npm install --prefix server --omit=dev
CONTRACT_ID=... OPERATOR_ID=... OPERATOR_KEY=... GAME_SECRET=... node server/index.mjs   # the script prints this line
```
Open http://localhost:8080. The login needs https or localhost. The public server runs the same command as a systemd service behind Caddy for https.

Optional server settings: `PLAYER_FUNDING` (0.05), `PLAYER_TOPUP` (0.03), `OPERATOR_MIN_NEAR` (0.5), `CONTRACT_MIN_NEAR` (1), `SIGNUPS_PER_HOUR` (60), `HOST` (127.0.0.1), `ALLOW_ORIGIN` (empty = same origin only).

### 3. Server without NEAR (testing the server code)
```
npm install --prefix server && MOCK=1 node server/index.mjs
```

## Tests
```
cd contract && cargo test
```
70 contract unit tests, among them:
- trading, liquidation, leverage licenses, the operator cannot change the event
- farming, weather, energy, gifts, town projects, the stall, seasons and badges
- spirits: catching, shinies, feeding, evolution with shards, NFT transfers and metadata, the wallet link (both sides needed)
- puzzles with a daily order, fate cards with real effects, quests paid once, story chapters ending in the Jade Dragon
- duels rolled from block randomness and saved for the replay (a weak team loses, a strong one wins, once a day), the Great Spirit unlocks the ending
- the in-game wallet sending items to any account, sign-up with a wallet key, one chest a day per world, at most one curse per target per day
- legendary fish only in season and only once
- ghost notes and votes, curses and charms, the shared world boss and its rewards, rare natural boss windows
- agent barons settling on their own ledgers, sealed calls revealed at night, peeks, player calls, grudges, stalls won, defended and lost
- night crews by element, with weather and event effects
- the player market (5% burned, seller paid, rules on what and how much can be listed, sales after a season ends), omens and rising debt, the weekly island goal
- 12 audit regression tests from the v3 security audit

The JavaScript copy of the contract (`shared/engine.js`) runs the same rules; the duel code was checked to give the same result as the Rust code on 120 random fights. I also played every new feature in headless Chromium on desktop and phone sizes, in offline mode and against the server with two players at once (notes, curses and charms between them).

## How it is built

```
index.html, game.js     the game: rendering, UI, game loop, trading, agents board, night and dawn, login
story.js                intro, welcome card and the spotlight tour
book.js                 HOW TO PLAY as a book you can turn: 22 pages in 11 chapters, chapter tabs, page flips
spirits.js              wild spirits, catching, companion, Spirit Book, legends tab
worlds.js, worldplay.js the four extra worlds, their people, chests, puzzles, gate signs, lights and moods
quests.js               fate cards, quest board, story chapters
duel.js                 3 v 3 spirit duels
island.js               the Bazaar Board: calls and peeks, the stall race, feed, curses and charms, world boss
bazaar.js               the five baron stalls in town and the night crew tab
market.js               the player market, the weekly island goal and the season's omen
unlock.js               what opens on which day of the first season, and the first-time hints
wallet.js               the built-in wallet: address + QR, balance, send NFTs, send NEAR
life.js                 farm plots, mining, fishing, Mochi the cat, the `act` queue
panels.js               morning paper, selling, seeds, gifts, town board, profile, share images
world.js                the town map, built in code
shared/rules.js         every table: goods, events, spirits, foes, legends, quests, agents (browser + server)
shared/engine.js        JavaScript copy of the contract, for offline mode and server testing
backend.js              local / mock / chain backends; login; signs moves with the function-call key
vendor/                 near-api-js 7.4.0, key derivation, and the NEAR wallet selector, bundled for the browser
server/index.mjs        operator: creates accounts, commits each morning (with the agents' bets), reveals each night
contract/src/lib.rs     the NEAR contract (near-sdk 5)
nft/, tools/make_nft.py NFT images (built from the game art) and the script that draws them
```

**Trust model, plainly:**
- The operator knows tonight's event, because it has to in order to commit it.
- What the chain guarantees is that the operator cannot change the event after you act.
- Settlement, liquidation, farming and items follow the contract's rules.
- Winning the fishing and catching mini-games is reported by your browser; the catch itself is rolled on chain.
- Puzzle orders come from the day's commitment, which your browser can see (the tablets even hint the first piece). Duels use block randomness instead, so their result cannot be known before fighting.
- Everything runs on testnet with play coins. There is no real money.

## Hackathon notes
- All code was written during the hackathon window (from 2026-11-08). No pre-existing code.
- Built with help from Claude (AI).
- Libraries: near-sdk (Rust), near-api-js 7.4.0, @near-wallet-selector 10.1.4, @scure/bip39, @noble/curves, @noble/hashes, and Playwright for testing.
- Art and music: Ninja Adventure Asset Pack (CC0: spirits, bosses, worlds, music) and LPC characters (CC-BY-SA 3.0 / GPL 3.0). Crops, icons and the app icon were drawn for this game. See `CREDITS.md`.
- License: MIT for code (`LICENSE`). Art keeps its own licenses.
