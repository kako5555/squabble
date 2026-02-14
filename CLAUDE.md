# CLAUDE.md — Squabble: Build Instructions

## What Is This Project?

Squabble is a mobile card game — a modern, funny twist on the classic card game War. Players flip cards, highest wins, but the rules are augmented with named war variants, strategic mechanics, and humor. This is a React Native + Expo + TypeScript project targeting iOS and Android.

## V1 Scope

V1 is a **playable, unstyled prototype** with:

- 1 human player vs 2 AI opponents (3-player game)
- Full game rules implemented (see below)
- Clean, functional UI — no theming, no animations, no sound
- Placeholder card visuals (rank + suit text, colored by suit)
- Portrait orientation mobile layout

**NOT in V1:** online multiplayer, animations, sound, visual theming, 4-player mode.

---

## Tech Stack

- **Framework:** React Native with Expo (use `npx create-expo-app squabble --template blank-typescript`)
- **Language:** TypeScript (strict mode)
- **State Management:** `useReducer` for game state (it's a state machine)
- **Testing:** Jest for game logic unit tests
- **No additional UI libraries** — use React Native built-in components + StyleSheet

---

## Build Order (Follow This Sequence)

### Phase 1: Game Engine (Pure Logic — No UI)

Build all game logic as pure functions with zero React/UI dependencies. Everything in a `src/engine/` directory.

#### 1A: Card Engine (`src/engine/cards.ts`)

- Define `Card` interface: `{ rank: number; suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'; display: string }`
- `rank` values: 2=Two, 3=Three ... 10=Ten, 11=Jack, 12=Queen, 13=King, 14=Ace
- `createDeck()`: returns one 52-card deck (no jokers)
- `createGameDeck()`: returns 3 shuffled decks combined (156 cards)
- `shuffle(cards)`: Fisher-Yates shuffle
- `compareCards(a, b)`: returns 1 (a wins), -1 (b wins), or 0 (tie). **CRITICAL: Must implement the Dagger rule — rank 2 beats rank 14 (Ace) but loses to everything else.**
- `getCardDisplay(card)`: returns human-readable string like "Ace of Spades"

**Write unit tests for `compareCards` covering:** standard comparisons, 2 vs Ace (2 wins), 2 vs King (King wins), 2 vs 2 (tie), Ace vs Ace (tie).

#### 1B: Game State (`src/engine/state.ts`)

```typescript
interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  deck: Card[];
  flippedCard: Card | null;
  reserveCard: Card | null;
  reserveUsed: boolean;
  isEliminated: boolean;
  warWins: number;
}

interface WarState {
  type: 'standard' | 'nuke' | 'bitch_fight' | 'kerfuffle' | 'jack_off' | 'squabble' | 'escalation';
  participants: string[];
  sacrificeCount: Record<string, number>;
  pot: Card[];
  round: number;
}

interface GameState {
  players: Player[];
  currentPhase: 'flip' | 'resolve' | 'war_declare' | 'war_sacrifice' | 'war_flip' | 'war_resolve' | 'game_over';
  warState: WarState | null;
  pendingEscalation: string | null; // player ID who can escalate
  isEndgame: boolean;
  turnNumber: number;
  log: string[];
  winner: string | null;
}
```

- `initializeGame()`: create 3 players (1 human, 2 AI), deal 156 cards evenly (52 each), draw 1 reserve card per player from their deck
- `getActivePlayers(state)`: returns non-eliminated players

#### 1C: Turn Logic (`src/engine/turns.ts`)

Implement the turn flow as a sequence of state transitions:

1. **`flipCards(state)`**: Each active player flips their top card. Returns new state with `flippedCard` set.

2. **`detectOutcome(state)`**: Analyzes flipped cards and returns the outcome type:
   - Check for **Squabble** first (3+ players: two+ lower matching values while a higher card exists). Squabbles are MANDATORY.
   - Check for **matching pairs** → identify war type:
     - Ace vs Ace = `nuke` (10 card sacrifice)
     - Queen vs Queen = `bitch_fight` (5 card sacrifice)
     - 2 vs 2 = `kerfuffle` (3 card sacrifice, LOWEST wins)
     - Jack vs Jack = `jack_off` (3 card sacrifice, standard rules)
     - Any other match = `standard` (3 card sacrifice)
   - Check for **Escalation eligibility**: if a player's card is exactly 1 rank below the highest card, they MAY declare escalation (optional for human, AI decides per AI logic)
   - If no war/squabble: highest card wins

3. **`declareEscalation(state, playerId)`**: Player opts into escalation. They sacrifice 4 cards instead of 3; opponent sacrifices 3.

4. **`useReserve(state, playerId)`**: Swap flipped card with reserve card. The original flipped card goes to bottom of player's deck. Can only be used on the initial flip (not during war flips). Once per game.

5. **`resolveWar(state)`**: Execute war — sacrifice cards, flip war cards, determine winner. If war flip ties, repeat (recursive). For Kerfuffles, LOWEST war card wins.

6. **`resolveTurn(state, winnerId)`**: Winner takes all cards in play (flipped cards + war pot) and adds to bottom of their deck. Check for eliminations. If down to 2 players, enter endgame mode.

7. **`checkGameOver(state)`**: In normal play, a player with 0 cards is eliminated. In endgame (2 players left), first to 3 war wins takes the game.

#### 1D: Squabble Resolution (Important — Get This Right)

When a Squabble is detected:
- The matching lower-card players enter a standard war (3 sacrifice, flip)
- The higher third player does NOT participate in the war — they watch
- If the Squabble winner's war flip card BEATS the original higher player's card, the Squabble winner takes ALL cards (including the higher player's flipped card)
- If the Squabble winner's card does NOT beat the higher player's card, the higher player wins everything
- If the Squabble war flip ties, repeat the war between the Squabble participants

#### 1E: All-In Mechanic

When a player can't meet a sacrifice requirement:
- They sacrifice ALL remaining cards
- They flip their very last card as the war card
- If they win, they survive and take the pot
- If they lose, they're eliminated
- Their remaining cards (if eliminated) go to the winner

#### 1F: AI Controller (`src/engine/ai.ts`)

Simple decision logic:

**Escalation:**
- Base probability: 40%
- If AI card count > average: 60%
- If AI card count < average: 20%

**Strategic Reserve:**
- Never use in first 5 turns
- Use if: current flipped card would lose AND reserve card would win (or at least tie/trigger favorable war)
- If AI is in bottom half by card count, lower the threshold (use more aggressively)

**Write unit tests for AI decisions.**

---

### Phase 2: Unit Tests (`src/engine/__tests__/`)

Before building ANY UI, write tests for:

- Card comparison (all cases including Dagger rule)
- Deck creation (156 cards, correct distribution)
- Standard war resolution
- Nuke resolution (10 sacrifice)
- Bitch Fight resolution (5 sacrifice)
- Kerfuffle resolution (lowest wins)
- Jack Off resolution (standard, just named differently)
- Squabble detection and resolution
- Escalation mechanics (4 vs 3 sacrifice)
- All-in when player has insufficient cards
- Reserve card swap
- Endgame: 3 war wins condition
- Player elimination

Run all tests and make sure they pass before moving to Phase 3.

---

### Phase 3: UI (`src/screens/` and `src/components/`)

#### Game Screen Layout (Portrait)

```
┌─────────────────────────────┐
│  [AI 1: 52 cards 🟢]  [AI 2: 52 cards 🟢]  │  ← top bar with names + card counts + reserve indicators
├─────────────────────────────┤
│                             │
│     [Card]  [Card]  [Card]  │  ← battlefield: flipped cards shown here
│                             │
│     ══ WAR NAME HERE ══     │  ← war banner when applicable
│     Sacrifice: X cards      │
│                             │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │  GAME LOG            │    │  ← scrollable event log with personality
│  │  "IT'S A NUKE!"      │    │
│  │  "Player 2 wins..."  │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  You: 52 cards              │
│  [Reserve: ?] [FLIP] [ESCALATE]  │  ← action buttons
└─────────────────────────────┘
```

#### Components to Build

- **`CardView`**: Shows a card face-up (rank + suit, colored red/black) or face-down (gray back)
- **`PlayerZone`**: Player name, card count, reserve indicator (green dot = available, gray = used)
- **`Battlefield`**: Center area showing all flipped cards. During wars, shows war type name prominently.
- **`ActionBar`**: Buttons for the human player. FLIP is always available during flip phase. ESCALATE appears only when eligible. USE RESERVE appears only when available and during flip phase.
- **`GameLog`**: Scrollable text list of game events. Use fun language — see log style guide below.
- **`WarBanner`**: Big text overlay showing war variant name when a war triggers.

#### Game Log Style Guide

The log should have personality. Examples:

- Normal win: "You snag it with a King over their 9 and 7."
- War: "WAR! 10 vs 10 — 3 cards on the line!"
- Nuke: "☢️ NUKE! ACE vs ACE! 10 cards sacrificed. This is MASSIVE."
- Bitch Fight: "👑 BITCH FIGHT! Queen vs Queen! 5 cards down, one queen stands."
- Kerfuffle: "🗡️ KERFUFFLE! Dagger vs Dagger! Lowest card wins this one..."
- Jack Off: "🃏 JACK OFF! Jack vs Jack. Standard war. Yes, that's really what it's called."
- Squabble: "⚔️ SQUABBLE! Bot 1 and Bot 2 match at 7 — they're forced to fight for a shot at your King!"
- Escalation: "📈 ESCALATION! You're going in heavy — 4 cards sacrificed!"
- Reserve: "🎴 RESERVE SWAP! You played your hidden card!"
- Endgame: "⚡ ENDGAME! Two players left. First to 3 war wins takes it all!"
- Elimination: "💀 Bot 2 is OUT! Down to the final two."
- All-in: "🎲 Bot 1 goes ALL IN with only 3 cards left!"

---

### Phase 4: Game Loop Integration

Wire up the `useReducer` in the main GameScreen:

1. On mount: `initializeGame()` → set initial state
2. Human taps FLIP → `flipCards()` → show all flipped cards → `detectOutcome()`
3. If Escalation eligible → show ESCALATE button → wait for human decision (or auto-decide for AI)
4. If Reserve eligible → show USE RESERVE button
5. Resolve outcome → update state → log event
6. If war → show war banner → resolve war → log result
7. Check elimination → check game over → next turn or show winner
8. AI actions happen automatically with a brief delay (500ms-1000ms) so the human can follow along

---

## Project Structure

```
squabble/
├── App.tsx                    # Entry point, renders GameScreen
├── src/
│   ├── engine/
│   │   ├── cards.ts           # Card types, deck creation, comparison
│   │   ├── state.ts           # GameState types, initialization
│   │   ├── turns.ts           # Turn flow, war resolution, outcome detection
│   │   ├── ai.ts              # AI decision logic
│   │   └── __tests__/
│   │       ├── cards.test.ts
│   │       ├── turns.test.ts
│   │       └── ai.test.ts
│   ├── screens/
│   │   └── GameScreen.tsx     # Main game screen with useReducer
│   ├── components/
│   │   ├── CardView.tsx
│   │   ├── PlayerZone.tsx
│   │   ├── Battlefield.tsx
│   │   ├── ActionBar.tsx
│   │   ├── GameLog.tsx
│   │   └── WarBanner.tsx
│   └── utils/
│       └── constants.ts       # War sacrifice counts, rank names, etc.
├── package.json
├── tsconfig.json
└── CLAUDE.md                  # This file
```

---

## Important Rules to Get Right (Common Pitfalls)

1. **Dagger Rule**: 2 beats Ace, but ONLY Ace. 2 loses to 3, 4, 5... King. Do NOT just make 2 the highest card. It's a targeted trump.
2. **Kerfuffle inversion**: During a 2v2 war, the LOWEST flipped card wins. If the Kerfuffle ties, repeat — lowest wins again.
3. **Squabble detection order**: Check for Squabbles BEFORE standard war. In a 3-player game where Player A has a King, and Players B and C both have 7s, B and C squabble. A does not participate in the war.
4. **Squabble overtake**: The Squabble winner's war card must BEAT the third player's original card to steal everything. Equal does not count.
5. **Escalation sacrifice**: The escalating player sacrifices 4. Their opponent sacrifices 3. Not both 4.
6. **Reserve timing**: Only swappable on the initial flip of a turn, not on war flip cards. The swap happens after all cards are revealed but before resolution.
7. **Endgame trigger**: When exactly 2 players remain (third eliminated), switch to endgame mode immediately. First to 3 war WINS (not 3 wars fought — 3 wars WON).
8. **Card recycling**: Won cards go to the BOTTOM of the winner's deck (not shuffled in).
9. **All-in**: Players who can't meet sacrifice count still participate — they just bet everything. Don't auto-eliminate them before they flip.
10. **Multiple wars in one turn**: If a 3-way tie happens, all three enter war. Handle this as a multi-participant war with one winner.

---

## Constants Reference

```typescript
const WAR_SACRIFICE_COUNTS = {
  standard: 3,
  nuke: 10,       // Ace vs Ace
  bitch_fight: 5, // Queen vs Queen
  kerfuffle: 3,   // 2 vs 2 (but lowest wins)
  jack_off: 3,    // Jack vs Jack (standard rules)
  squabble: 3,    // Matching lower cards in 3+ player
  escalation: 4,  // For the escalating player only; opponent does 3
} as const;

const ENDGAME_WARS_TO_WIN = 3;
const TOTAL_DECKS = 3;
const CARDS_PER_DECK = 52;
const AI_ESCALATION_BASE_CHANCE = 0.4;
const AI_MIN_TURNS_BEFORE_RESERVE = 5;
```

---

## When You're Done

The prototype is complete when:
- [ ] All unit tests pass
- [ ] A full 3-player game can be played start to finish on a phone via Expo Go
- [ ] All war types trigger correctly with the right sacrifice counts
- [ ] Squabbles work in 3-player scenarios
- [ ] Escalation and Reserve mechanics work for the human player
- [ ] AI makes reasonable (not random) decisions
- [ ] Game log narrates events with personality
- [ ] Endgame (last 2 standing → first to 3 war wins) works
- [ ] Elimination and all-in work correctly
