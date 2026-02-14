import { RANK_NAMES, SUIT_SYMBOLS, TOTAL_DECKS } from '../utils/constants';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface Card {
  rank: number; // 2-14 (2=Two, 11=Jack, 12=Queen, 13=King, 14=Ace)
  suit: Suit;
  display: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * Returns human-readable string like "Ace of Spades"
 */
export function getCardDisplay(card: Card): string {
  const rankName = RANK_NAMES[card.rank];
  const suitName = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${rankName} of ${suitName}`;
}

/**
 * Creates a single 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const card: Card = {
        rank,
        suit,
        display: '', // Will be set below
      };
      card.display = getCardDisplay(card);
      deck.push(card);
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle - shuffles array in place and returns it
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Creates 3 shuffled decks combined (156 cards)
 */
export function createGameDeck(): Card[] {
  const allCards: Card[] = [];
  for (let i = 0; i < TOTAL_DECKS; i++) {
    allCards.push(...createDeck());
  }
  return shuffle(allCards);
}

/**
 * Compares two cards for standard gameplay.
 * Returns 1 if card a wins, -1 if card b wins, 0 if tie.
 *
 * CRITICAL: Implements the Dagger rule - rank 2 beats rank 14 (Ace)
 * but loses to everything else.
 */
export function compareCards(a: Card, b: Card): 1 | -1 | 0 {
  // Handle the Dagger rule: 2 beats Ace specifically
  if (a.rank === 2 && b.rank === 14) {
    return 1; // 2 beats Ace
  }
  if (a.rank === 14 && b.rank === 2) {
    return -1; // Ace loses to 2
  }

  // Standard comparison for all other cases
  if (a.rank > b.rank) {
    return 1;
  }
  if (a.rank < b.rank) {
    return -1;
  }
  return 0;
}

/**
 * Compares cards for Kerfuffle (2 vs 2 war) - LOWEST wins
 */
export function compareCardsKerfuffle(a: Card, b: Card): 1 | -1 | 0 {
  // In Kerfuffle, lowest wins, but Dagger rule still applies for Ace
  if (a.rank === 2 && b.rank === 14) {
    return 1; // 2 still beats Ace
  }
  if (a.rank === 14 && b.rank === 2) {
    return -1;
  }

  // Lower rank wins in Kerfuffle
  if (a.rank < b.rank) {
    return 1;
  }
  if (a.rank > b.rank) {
    return -1;
  }
  return 0;
}

/**
 * Returns true if the card is a red suit (hearts/diamonds)
 */
export function isRedSuit(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

/**
 * Returns the suit symbol for display
 */
export function getSuitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}
