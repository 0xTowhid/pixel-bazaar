# Pixel Bazaar v4: The Lantern Isles (build plan)

Approved by Towhid on 2026-11-12 (concepts 01-10, 08a, 08b). Deadline: NEAR Hackathon, Nov 14 23:59 UTC.
One new contract (v4, new account, fresh start). Everything below lives in it, so the player's
function-call key can call it directly.

## Order
1. Hook: intro cutscene (skip), welcome card (why play), 9-step spotlight tour (skip, replay from Journal).
2. Spirits + NFTs: catch, companion follows, level/evolve (same NFT), Spirit Book, NEP-171 NFTs
   (spirits, badges, legendary fish) with metadata; link a NEAR wallet, SEND TO MY WALLET.
   NFT images: GitHub raw (`nft/` folder in this repo).
3. Worlds: Whispering Woods, Moon Market (night), Sunken Shrine (needs water spirit), Clockwork Sky
   (needs wind spirit). Map switching, per-world music (Ninja Adventure tracks).
4. Fate cards (Madame Vey, 3 a day), quest board (daily/weekly/townsfolk), story chapters + clues.
5. Spirit card duels (3 v 3) vs NPCs (Rita in Moon Market, world bosses).
6. Fishing legends (5 legendary fish, conditions, NFTs).
7. Multiplayer chaos: ghost notes (true/liar votes), curses (1 a day, charms), RARE world boss
   (about once a month, shared HP), island feed.
8. Bazaar stays (trading on rumors) + more agent traders.

## Rules of thumb
- Rolls come from the day's commitment (`roll()`), never `random_seed` inside `act`, so reverting cannot reroll.
- Every new mechanic has a contract test and a JS mirror in `shared/engine.js` (offline + mock modes).
- Art: Ninja Adventure pack (CC0) monsters/bosses/tilesets/music; credit in CREDITS.md.
