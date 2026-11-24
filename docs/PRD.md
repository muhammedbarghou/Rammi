# PRD: Moroccan Rami (Talaj 71)

Version 1.0 · 2026-10-24 · Status: draft for review

This PRD captures every rule agreed so far for a multiplayer Moroccan Rami card game on iOS and Android. Rules are numbered (R-01, R-02, ...) so they map directly to code, tests and tickets. Every rule and decision here has been confirmed by the product owner. Section 12 lists any open items.

---

## 1. Overview and objectives

**Product:** A real-time online card game for iOS and Android that plays the Moroccan variant of Rami, called Talaj 71, with the 71-point opening rule.

**Objectives**
- Faithfully implement the Moroccan rules exactly as agreed in this document.
- Real people only: no computer bots.
- 2 to 4 players per table, plus a 2 vs 2 companion (team) mode.
- Landscape-only, fast turns (15 seconds), and a table layout where each player's laid-down combinations sit in front of their own seat.

**Out of scope for version 1** (see section 11): coins and betting, cosmetics and avatars, friends and invites, free-text chat, public lobby, bots.

---

## 2. Target audience

- Moroccan players who already know Rami / Talaj and want to play with friends on a phone.
- Casual card-game players comfortable with Arabic, French or English.
- Players aged 16 and up (+16). The App Store and Google Play age ratings must be set to match.

---

## 3. Terminology

Game terms stay in the original dialect in every language.

| Term | Meaning |
|---|---|
| Talaj | Laying down (opening or placing) combinations on the table |
| Tria (also called trio) | 3 or 4 cards of the same rank, all in different suits |
| Serie (also called suivi) | 3 to 14 consecutive cards of one suit |
| Opening | A player's first talaj of the round, worth 71 points or more |
| Companion mode | 2 vs 2 team game |
| Party | A game room created by a player |

---

## 4. Game rules (core of this PRD)

### 4.1 Setup

- **R-01** Players per table: 2 to 4.
- **R-02** Deck: two standard 52-card decks plus 4 jokers, 108 cards total.
- **R-03** Each player is dealt 14 cards, except the shuffler (see R-04), who is dealt 15. Undealt cards form the face-down draw pile. There is no face-up starting card. The shuffler begins the round by discarding one card (see R-03a).
- **R-04** The shuffler rotates every round and is the player who starts the round. The first round's shuffler is a random player. Each later round's shuffler is the player to the left of the previous round's shuffler.
- **R-05** Companion mode: 4 players in two teams of two (2 vs 2). Partners sit opposite each other.
- **R-03a First discard:** The shuffler plays first. They do not draw. They discard one card and so end with 14 cards. This card is placed alone, apart from the discard pile, and is called the first discard.
  - During the first round of turns (until every other player has had one turn), any player may take the first discard, in turn order, instead of drawing from the draw pile. Taking it counts as that turn's draw, so the player cannot also draw from the pile.
  - Taking it needs no talaj, and the exception to R-14 applies: it can be taken on a player's first turn.
  - Taking the first discard does not let the player lay down in that same turn. They discard one card to end the turn and can lay down from their next turn.
  - If player 2 does not take it, player 3 can, then player 4. Once the first round of turns ends, nobody can take it. It is then added to the discard pile and the normal discard rules (R-13 to R-15) apply.

### 4.2 Valid combinations

- **R-06 Tria:** 3 or 4 cards of the same rank, every card in a different suit. Two cards of the same suit (for example 8♥ 8♥ 8♣) is invalid.
- **R-07 Serie:** 3 to 14 consecutive cards of the same suit. Ace is low (A-2-3) or high (Q-K-A). Wrap-around (K-A-2) is invalid. The longest possible Serie is 14 cards (A through K, then A).
- **R-08 Jokers:** A joker is wild and substitutes for any card. At most one joker per combination.

### 4.3 Card values

- **R-09** Cards 2 to 10 are worth face value.
- **R-10** J, Q and K are worth 10 each.
- **R-11** Ace is worth 10 when high (after K) and 1 when low (before 2). Ace in a Tria is worth 10 for each card.

### 4.4 Turn structure

Each turn follows this order:

1. **Draw:** take one card from the draw pile, or the top discard card if allowed (R-13 to R-15).
2. **Talaj (optional):** lay down combinations, subject to the opening rules (4.5) and, once opened, the add rules (4.6).
3. **Discard:** discard exactly one card to end the turn (R-18 restricts which cards).

- **R-12** Turn time limit is 15 seconds (see 4.9 for timeouts).

### 4.5 Drawing from the discard pile

- **R-13** Only the top discard card may be taken.
- **R-14** A player's first turn must draw from the draw pile. Discard-pile draws are allowed from a player's second turn onward. (Exception: the shuffler's first discard, R-03a.)
- **R-15** The discard card may only be taken if the player does talaj with it that turn, not merely to put it in their hand (exception: the shuffler's first discard, R-03a, which needs no talaj). A player who has not opened may take it to complete their 71-point opening. A player who has already opened may take it if they add it to any combination on the table. Example: the table has a 4-5-6 Serie, the previous player discards an 8, and the player holds a 7. They take the 8 and add it together with their 7 to the combination.

### 4.6 The opening (Talaj 71)

- **R-16 Opening requirement:** To open, a player must lay down combinations worth **71 points or more in total, all at once in a single turn**. The opening cannot be split across turns.
- **R-17 Opening content:** The opening must contain at least one Tria and one Serie. The 71 points must be reached with natural (non-joker) cards. A joker can be used only after the player already has 71 points without it, so a hand worth 65 points cannot reach 71 by using a joker.
- **R-17a Escalation (Talaj):** If a player has opened with a total of N points, the next player to open in the same round must lay down **more than N**. The chain continues for every later opener. The threshold resets to 71 at the start of every new round.
- **R-17b Companion opening:** In companion mode, once a player has opened, their partner does not need 71 or more. The partner only needs a Serie to start laying down. The partner's opening does not change the escalation threshold for opponents.

**Opening example:** Tria 10♠ 10♥ 10♦ = 30, plus Serie 8♥ 9♥ 10♥ = 27, total 57. This does not reach 71, so the player must add at least 14 more points of valid combinations in the same turn.

### 4.7 After opening

- **R-19 Add cards:** A player who has opened may add cards to any combination on the table, including combinations laid down by partners and opponents.
- **R-20 New combinations:** After opening, a player may lay down new combinations on any later turn, with no minimum points.
- **R-18 Discard restriction:** A player cannot discard a card that fits a combination laid down by the player who plays immediately after them, because that player would pick up the discard. They must add it to the table or discard another card. Example: in a 4-player game, if player 1 has laid down, player 4 (who plays right before player 1) cannot discard a card that fits player 1's combinations, but players 2 and 3 can. **Exception:** if the next player has only one card in hand, the discard is allowed. In companion mode, a partner's combinations count when the partner plays next.
- **R-21 No rearranging:** Combinations already on the table cannot be rearranged (no moving cards between combinations, no splitting). Players can only add cards.
- **R-22 Joker swap:**
  - Only a joker inside a **Tria** can be swapped (for example three Aces plus a joker).
  - The player must already have opened.
  - The player replaces the joker with the real card of the missing suit and must lay the joker down in a combination in the same turn. It cannot be kept in hand.
  - A joker inside a Serie cannot be swapped.

### 4.8 Ending a round

- **R-23 Win condition:** The round ends when a player's hand is empty. Example: a player with one card left draws, adds one card to a combination, then discards the other card and goes out.
- **R-24 Empty draw pile:** When the draw pile is empty, the discard pile (keeping its top card in place) is shuffled to form a new draw pile and play continues.

### 4.9 Timeouts and forfeits

- **R-25 Auto-play:** If a player does not finish their turn within 15 seconds, the server plays for them: it draws from the draw pile and discards a card that is legal under R-18.
- **R-26 Forfeit:** A player who times out on 3 turns in a row forfeits the game and leaves the table. The remaining players or team continue. If only one player or team is left, they win. In companion mode, a player who is kicked out does not affect their partner, who continues playing.

### 4.10 Scoring

- **R-27 Round penalties:**

| Situation | Penalty |
|---|---:|
| Winner | 0 |
| Each leftover ordinary card | 10 |
| Each leftover joker | 20 |
| A player who never opened that round | 100 |

- **R-28 Companion scoring:** The winning team scores 0 for the round. The losing team's penalties (both players) are added together.
- **R-29 Game end:** The party creator sets a target score when creating the party. The default is **501** (not 500, to allow an extra round). A player or team whose total reaches the target is eliminated, and the last one remaining wins. Elimination happens as soon as a player or team reaches the target. In a 2-player game, the player who reaches it loses and the other player wins.

---

## 5. Features and acceptance criteria

### F1. Authentication and profile
- Sign in with Google and Apple only, no passwords.
- Profile name and photo come from the social login.
- **Acceptance:** A new user signs in with either provider and lands on the home screen with their name and photo shown. Signing out and in again restores the same account.
- **Technical:** Supabase Auth. The game server verifies the Supabase JWT on connect.

### F2. Parties (rooms)
- A signed-in player creates a party: chooses 2, 3 or 4 players, companion mode (4 players only), and the target score (default 501).
- Others join with a short room code. A friend list and invites come later.
- **Acceptance:** Creating a party returns a unique code. A second player entering the code joins the same lobby. The party starts only when the seats are full. If the creator leaves the lobby, the next player who joined becomes the creator. The party closes only when the room is empty.

### F3. Core gameplay engine
- Implements R-01 to R-29 on the server.
- The server holds all hands. Clients only see their own hand and public table state.
- **Acceptance:** Every rule above has automated tests (section 8). An illegal move is rejected with a reason code and the client state is unchanged.

### F4. Turn timer and auto-play
- A visible 15-second countdown for the active player.
- **Acceptance:** On expiry the server auto-plays per R-25. Three consecutive expiries trigger R-26.

### F5. Reconnect
- A player who loses connection can rejoin the same game from the same account.
- **Acceptance:** Rejoining restores the player's hand, the table and the current turn timer. Time spent offline still counts toward the turn timer.

### F6. Table UI (landscape)
- See section 7.
- **Acceptance:** On a phone in landscape, all seats, their combinations, both piles and the full 14-card hand are visible without scrolling.

### F7. Quick chat
- Preset emojis and quick phrases only, available in all three languages.
- **Acceptance:** Selecting a preset shows it above the sender's seat for a few seconds to all players. No free text input exists.

### F8. Localization
- Languages: Arabic (right-to-left), French, English. English is the default.
- Talaj, Tria (or trio) and Serie (or suivi) are never translated.
- **Acceptance:** Switching language changes all interface text and layout direction without restarting, and game terms stay unchanged.

---

## 6. Technical stack

| Layer | Choice | Why |
|---|---|---|
| Client | Expo (React Native) with TypeScript | One codebase for iOS and Android. A 2D turn-based card game needs no game engine. |
| Animation and gestures | React Native Reanimated, Gesture Handler | Smooth dealing, dragging and sorting. |
| Rules module | Pure TypeScript package shared by client and server | Single source of truth, easy to unit test. The client uses it only for hints and highlighting. |
| Game server | Colyseus (Node, TypeScript), run in Docker | Holds live rooms, hidden hands, timers and reconnects. |
| Auth and database | Supabase (Auth plus Postgres) | Google and Apple sign-in, profiles, match history. Later: friends and coins. |
| Hosting | Docker on a VPS | Fits the Docker deployment preference. |

**Why not Supabase alone:** Edge Functions are short-lived and stateless, so they cannot hold a live game room or run the 15-second turn timers. Supabase handles identity and data. Colyseus handles live game state.

**Scale target:** start with 500 concurrent players on a single server and scale later.

**Orientation:** The app is locked to landscape.

**Documentation**
- Expo: https://docs.expo.dev
- Colyseus: https://docs.colyseus.io
- Supabase Auth: https://supabase.com/docs/guides/auth
- Reanimated: https://docs.swmansion.com/react-native-reanimated

---

## 7. UI design principles

- **Layout:** Based on the reference screenshot of an existing Rami game. Each player's laid-down combinations sit in front of their own seat, not in one shared pile. The partner sits at the top, opponents at the sides, and the player at the bottom.
- **Center:** Draw pile and discard pile, plus a chip showing the current opening threshold ("Next opening: more than N").
- **Hand:** The player's 14 cards in one row at the bottom, tap to select.
- **Actions:** Sort, Talaj and Discard buttons.
- **Adding cards:** Tap a card in the hand to select it, then tap a combination on the table to add it. Drag and drop and animations come in a later version.
- **Feedback:** Illegal moves are blocked with a short message (for example "Opening must be 72 or more").
- **Turn clarity:** Highlight the active player and show the 15-second countdown on their seat.
- **Right to left:** Arabic mirrors the layout.

---

## 8. Conceptual data model

### Postgres (Supabase)

**profiles**
- id (uuid, primary key, equals the Supabase auth user id)
- display_name (text)
- avatar_url (text, nullable)
- created_at (timestamptz)

**matches**
- id (uuid, primary key)
- party_code (text)
- mode (text: "solo" or "companion")
- player_count (int, 2 to 4)
- target_score (int, default 501)
- created_by (uuid, references profiles.id)
- started_at, ended_at (timestamptz)
- winner_team_or_player (text, nullable)

**match_players**
- match_id (uuid, references matches.id)
- profile_id (uuid, references profiles.id)
- seat (int, 0 to 3)
- team (int, nullable)
- final_score (int)
- forfeited (boolean)

**rounds**
- id (uuid), match_id (uuid)
- round_number (int), starter_seat (int)
- winner_seat (int, nullable)

**round_scores**
- round_id (uuid), profile_id (uuid)
- penalty (int), opened (boolean), opening_total (int, nullable)

Live game state (hands, piles, table, timers) lives in the Colyseus room memory only and is not stored in Postgres. Only finished results are saved.

### Live game state (Colyseus, TypeScript shapes)
- Card: { id: string, rank: "A"|"2".."10"|"J"|"Q"|"K"|"JOKER", suit: "H"|"D"|"S"|"C"|null, deck: 0|1 }
- Combination: { id, type: "TRIA"|"SERIE", cards: Card[], ownerSeat: number, jokerRepresents?: {rank, suit} }
- Seat: { seat, profileId, hand: Card[] (server only), handCount, opened: boolean, openingTotal: number|null, missedTurns: number }
- Room: { phase, activeSeat, turnDeadline, drawPile: Card[] (server only), discardPile: Card[], combinations: Combination[], openingThreshold: number, roundNumber }

---

## 9. Rule validation (pseudocode)

```
validateOpening(cards laid down this turn):
  total = sum(value of each natural (non-joker) card in each combination)
  require total >= openingThreshold (71, or previous opener's total + 1)
  require at least one TRIA and one SERIE
  jokers may be added only after the natural-card total already reaches the threshold
  require all laid in the same turn
  -> on success: seat.opened = true; seat.openingTotal = total;
                 room.openingThreshold = total   // next opener must exceed this

canDiscard(seat, card):
  next = the seat that plays after this seat
  if next.handCount > 1 and card can be added to any combination owned by next: reject
  else accept

canTakeDiscard(seat, turnNumber):
  require turnNumber >= 2
  require the card is used in a combination laid or extended this turn
  (unopened player: it must be part of the 71+ opening)

swapJoker(tria, realCard):
  require seat.opened
  require tria is a TRIA and joker represents realCard's missing suit
  require the joker is placed into a combination before the turn ends
```

---

## 10. Security and fair play

- Server-authoritative: the server validates every move. The client never decides the outcome.
- Hidden information: hands and the draw pile never leave the server. Each client receives only its own hand and public table state.
- Authentication: every connection must carry a valid Supabase JWT. Seats are bound to the signed-in profile.
- Rate limiting on room creation and join attempts, to stop room-code guessing.
- Room codes are short but random, expire when the party closes, and are not reusable.
- Chat limited to presets, so there is no user-generated text to moderate.

---

## 11. Development phases

**Phase 1: Rules engine (shared TypeScript package)**
Deck, combinations, values, opening validation, escalation, joker swap, discard restrictions, scoring, forfeit logic. Full unit test suite for R-01 to R-29.

**Phase 2: Game server**
Colyseus room with turns, 15-second timers, auto-play, reconnect, party codes, Supabase JWT check, saving finished results.

**Phase 3: Client**
Expo app, sign-in, create and join party, landscape table UI with per-seat combinations, tap to add, Talaj and Discard actions, timer display.

**Phase 4: Companion mode and polish**
2 vs 2 mode, preset chat, Arabic RTL, French and English strings, animations, sound.

**Phase 5: Beta and store release**
Test with real groups, balance the 15-second timer, fix rule disputes, App Store and Google Play submission.

**Later versions**
Friends and invites, free-text chat, public lobby, avatars and cosmetics, in-game coins and betting (1000 starting coins). Before coins are designed, decide whether they can ever be bought or cashed out with real money. If so, the stores treat the game as gambling with extra rules and age restrictions. Coins with no cash value avoid that.

---

## 12. Open items to confirm

None. Every rule and decision in this document is confirmed.

---

## 13. Potential challenges and solutions

| Challenge | Solution |
|---|---|
| House rules differ between families | All rules numbered here and tested. Disputes are resolved by this document. Later versions may allow optional rule toggles. |
| 15-second turns are tight on a phone | Large touch targets, auto-sort, one-tap Talaj for valid selections. Tune in beta. |
| Players disconnecting mid-game | Reconnect support, auto-play, 3-miss forfeit. |
| Rule complexity (joker swaps, escalation) | Shared rules module with exhaustive tests, and clear on-screen messages for rejected moves. |
| Cheating | Server-authoritative game, hidden hands. |
| Real-money gambling rules (future coins) | Keep coins without cash value, and review store policies before building. |

---

## 14. Future expansion

- Friends system with invites
- Public lobby and quick match
- Free-text chat with moderation
- Avatars, card backs and table themes
- In-game coins and betting
- Rule-variant options per party
- Tournaments and leaderboards
