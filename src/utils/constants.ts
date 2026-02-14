export const WAR_SACRIFICE_COUNTS = {
  standard: 3,
  nuke: 10,       // Ace vs Ace
  bitch_fight: 5, // Queen vs Queen
  kerfuffle: 3,   // 2 vs 2 (but lowest wins)
  jack_off: 3,    // Jack vs Jack (standard rules)
  squabble: 3,    // Matching lower cards in 3+ player
  escalation: 4,  // For the escalating player only; opponent does 3
} as const;

export const ENDGAME_WARS_TO_WIN = 3;
export const TOTAL_DECKS = 3;
export const CARDS_PER_DECK = 52;
export const AI_ESCALATION_BASE_CHANCE = 0.4;
export const AI_MIN_TURNS_BEFORE_RESERVE = 5;

export const RANK_NAMES: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};

export const RANK_SYMBOLS: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export type WarType = keyof typeof WAR_SACRIFICE_COUNTS;
