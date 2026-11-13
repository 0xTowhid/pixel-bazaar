# Pixel Bazaar: The Lantern Isles

**Catch spirits, solve the mystery, trade on rumors.** A pixel-art RPG and life sim on NEAR, where every spirit, badge and legendary fish is a real NFT you own.

You arrive on the Lantern Isles owing the Harbor Master 5,000 coins, with 300 coins and 10 days to pay. Someone has stolen the Great Lantern and the spirits have gone wild. Catch them, raise them and duel with them. Follow the clues through the Whispering Woods, the Sunken Shrine and the Clockwork Sky to the old spirit gate. Every morning the locals tell you rumors about tomorrow's prices. Some tell the truth and some don't. Use them to go **long or short with leverage** at Tomo's stall, against five agent traders who each have their own NEAR account. And you are not alone on the island: other players leave ghost notes, cast curses, and fight the rare world boss with you.

Built for NEAR HACKATHON 2026, **Games With Real Economies** track.

| | |
|---|---|
| **Play it** | **https://pixel-bazaar.arculate.markets** or **https://213.165.39.157.sslip.io** (desktop or phone held sideways; no wallet needed to start) |
| **Contract** | [`pixelbazaar5-tow69.testnet`](https://testnet.nearblocks.io/address/pixelbazaar5-tow69.testnet) on NEAR testnet |
| **Agent accounts** | `kaito.`, `rita.`, `pell.`, `bolt.`, `luna.pixelbazaar5-tow69.testnet` |
| **NFT art** | [`nft/`](nft/) in this repo, served from GitHub raw links in each token's metadata |
| **Code** | this repository (MIT) |

**Disclosure (rule Q-015):** I am also submitting a second, independent project, **Sealed Calls** (https://github.com/0xTowhid/sealed-calls). The two projects share no code.

## For judges: a 5-minute run

1. Open the game. A short intro plays (SKIP works), then **HOW TO PLAY** explains the story, a day, your first day step by step, and how the worlds unlock. The goal line at the top and a yellow arrow always point to your next step.
2. Choose **NEW TRADER**, pick a name and a password. The game creates `yourname.pixelbazaar5-tow69.testnet` and shows a 12-word recovery code. Every ✓ line at the bottom of the screen links to the transaction on the explorer.
3. Read the morning paper and press **START DAY**. The day is committed on chain before you see any rumors (`✓ commit_day`).
4. Catch a spirit: walk up to a glowing wisp in the grass, press E (A on phones) and stop the bar in the green. The contract decides the catch, and the spirit is minted to you as an NFT. It follows you as your companion.
5. Press **B** for your spirits (feed, evolve, the Spirit Book, the five legendary fish). Press **WALLET**: your game account is a real NEAR account with an address, a QR code and a balance. Send any spirit, badge or fish to any NEAR address, or send NEAR out after re-typing your password.
6. Press **Q** for the story and today's three quests, talk to **Madame Vey** for three fate cards, and challenge **Mei** to a 3-vs-3 spirit duel.
7. Press **I** for the island: the live feed of every player, ghost notes, curses and the world boss.
8. After 18:00, go home and **SLEEP**. The contract checks the night's reveal against the morning commitment and settles everything (`✓ settle_day`).

On phones, tap **FULL SCREEN** at the top (on iPhone, use Share → Add to Home Screen).

## What NEAR does in this game

| NEAR feature | Where | What it does |
|---|---|---|
| Named sub-accounts + function-call keys | `register_player` in `contract/src/lib.rs`, `backend.js` | Your name becomes `yourname.<contract>`. Your browser holds a key that can only call 7 game methods on this contract and cannot move NEAR. No wallet popups and no gas prompts while you play. |
| Log in anywhere (password or 12-word code) | `backend.js`, `vendor/keys.mjs` | PBKDF2 (210k rounds) turns your name and password into a standard 12-word NEAR seed phrase (BIP39 + SLIP-10). Two keys come from it: a **play key** (`m/44'/397'/1'`, kept in the browser, can only call 7 game methods) and the **wallet key** (`m/44'/397'/0'`, the standard path, so the 12 words open the account in any NEAR wallet). The wallet key is never stored: the game rebuilds it from your password for a NEAR transfer and drops it. The server stores no secret of yours. |
| **NEP-171 NFTs** (spirits, badges, legendary fish) | `nft_transfer`, `nft_token`, `nft_tokens_for_owner`, `nft_metadata` | 39 spirit species (+ shiny), 22 badges and 5 one-of-one legendary fish are real NFTs with metadata and art. A spirit keeps its token id as it levels up and evolves; its metadata shows the new form and level. Standard `nft_mint` and `nft_transfer` events (NEP-171 logs), so wallets and explorers show them. |
| **Built-in wallet** | `Action::SendTo`, `register_player(public_key, full_key)`, `wallet.js` | Address with QR code, live balance, receive NEAR and NFTs, send any NFT to any account (a game action, no popups), and send NEAR signed with the wallet key. |
| Commit-reveal days | `commit_day` / `settle_day`, `server/index.mjs` | Each morning the operator commits `sha256(event, rumors, salt)`. At night the contract rejects any reveal that does not match. |
| On-chain rolls that cannot be rerolled | `roll()` | Spirit encounters, shiny odds, catches, duels, fate cards, quests, puzzle orders, legendary fish and boss damage are rolled from the day's commitment. Reverting a transaction and trying again gives the same result. |
| Contract-run economy and RPG | `act` | Coins, prices, leveraged trades and liquidations; farm, energy, mining, fishing; spirit XP, feeding, evolution; puzzles, story chapters, quests, duels. Many moves are batched into one `act` transaction. |
| **Shared island state** | `get_feed`, `get_notes`, `get_boss`, `Action::LeaveNote/VoteNote/Curse/BuyCharm/BossHit/BossClaim` | Ghost notes other players vote TRUE or LIAR (reputation and coins move between accounts), curses that land on another player's next move unless a charm blocks them, and a world boss with one HP bar for everyone. A boss window opens about once a month, decided by `sha256` of the time window; the operator can also summon one for a live event. |
| **Agent traders with their own accounts** | `create_npc`, `get_npcs`, `commit_day(npc_moves)` | Kaito the Whale, Rita, Granny Pell (contrarian), Bolt-9 (gossip bot) and Luna Moonsong (stargazer) are sub-accounts with coin ledgers. Their bets are committed with your day and settle against the same prices as yours. |
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
| **The island** (I) | Live feed of every player, ghost notes, curses and charms, the world boss. |
| **The bazaar** (Tomo) | Long or short on 12 goods with x1-x10 leverage; five agent traders bet beside you (AGENTS board). Sell your harvest, buy seeds, licenses and your own stall. |
| **Life sim** | Farm 9 crops (rain waters them, frost kills them), mine jade, fish, give gifts until locals trust you, rebuild the town. Pay the Harbor Master 5,000 to finish the season; your spirits, story and farm carry over. |

Controls: arrows or WASD, E or Space to interact, 1-9 seeds, B spirits, Q quests, I island, P profile, J journal, M music. On phones (sideways): the on-screen pad and A button.

### Built to keep working on a real network
- If the morning commit or the night reveal fails, the game retries and then shows **TRY AGAIN**. It never lets you play a day that is not on chain.
- If you close the tab while asleep, that night is settled the next time you open the game.
- The operator signs its transactions one at a time, so many players at once cannot cause nonce errors. A double tap cannot commit or settle a day twice.
- If a day can never be revealed (the server's secret changed), the operator cancels it on chain with `void_day`, refunds open trades and starts the day again.
- New players get 0.05 NEAR for gas and are topped up when they run low. Sign-ups pause by themselves if the operator or the contract runs low on NEAR.

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
51 contract unit tests, among them:
- trading, liquidation, leverage licenses, the operator cannot change the event
- farming, weather, energy, gifts, town projects, the stall, seasons and badges
- spirits: catching, shinies, feeding, evolution with shards, NFT transfers and metadata, the wallet link (both sides needed)
- puzzles with a daily order, fate cards with real effects, quests paid once, story chapters ending in the Jade Dragon
- duels rolled from block randomness and saved for the replay (a weak team loses, a strong one wins, once a day), the Great Spirit unlocks the ending
- the in-game wallet sending items to any account, sign-up with a wallet key, one chest a day per world, at most one curse per target per day
- legendary fish only in season and only once
- ghost notes and votes, curses and charms, the shared world boss and its rewards, rare natural boss windows
- agent traders settling on their own ledgers
- 12 audit regression tests from the v3 security audit

The JavaScript copy of the contract (`shared/engine.js`) runs the same rules; the duel code was checked to give the same result as the Rust code on 120 random fights. I also played every new feature in headless Chromium on desktop and phone sizes, in offline mode and against the server with two players at once (notes, curses and charms between them).

## How it is built

```
index.html, game.js     the game: rendering, UI, game loop, trading, agents board, night and dawn, login
story.js                intro, welcome card, HOW TO PLAY guide and the spotlight tour
spirits.js              wild spirits, catching, companion, Spirit Book, legends tab
worlds.js, worldplay.js the four extra worlds, their people, chests, puzzles, gate signs, lights and moods
quests.js               fate cards, quest board, story chapters
duel.js                 3 v 3 spirit duels
island.js               the island: feed, ghost notes, curses and charms, world boss
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
