import {
  Card,
  createDeck,
  createGameDeck,
  compareCards,
  compareCardsKerfuffle,
  getCardDisplay,
  shuffle,
} from '../cards';

// Helper to create a card
function card(rank: number, suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' = 'hearts'): Card {
  return { rank, suit, display: '' };
}

describe('Card comparison', () => {
  describe('Standard comparisons', () => {
    it('higher rank wins', () => {
      expect(compareCards(card(10), card(5))).toBe(1);
      expect(compareCards(card(14), card(13))).toBe(1); // Ace beats King
      expect(compareCards(card(11), card(10))).toBe(1); // Jack beats 10
    });

    it('lower rank loses', () => {
      expect(compareCards(card(5), card(10))).toBe(-1);
      expect(compareCards(card(3), card(14))).toBe(-1);
    });

    it('same rank ties', () => {
      expect(compareCards(card(7), card(7))).toBe(0);
      expect(compareCards(card(14), card(14))).toBe(0); // Ace vs Ace
      expect(compareCards(card(12), card(12))).toBe(0); // Queen vs Queen
    });
  });

  describe('Dagger rule (2 vs Ace)', () => {
    it('2 beats Ace', () => {
      expect(compareCards(card(2), card(14))).toBe(1);
    });

    it('Ace loses to 2', () => {
      expect(compareCards(card(14), card(2))).toBe(-1);
    });

    it('2 loses to King', () => {
      expect(compareCards(card(2), card(13))).toBe(-1);
    });

    it('2 loses to 3', () => {
      expect(compareCards(card(2), card(3))).toBe(-1);
    });

    it('2 loses to everything except Ace', () => {
      for (let rank = 3; rank <= 13; rank++) {
        expect(compareCards(card(2), card(rank))).toBe(-1);
      }
    });

    it('2 vs 2 ties', () => {
      expect(compareCards(card(2), card(2))).toBe(0);
    });
  });
});

describe('Kerfuffle comparisons (lowest wins)', () => {
  it('lower rank wins in Kerfuffle', () => {
    expect(compareCardsKerfuffle(card(3), card(10))).toBe(1);
    expect(compareCardsKerfuffle(card(5), card(14))).toBe(1);
  });

  it('higher rank loses in Kerfuffle', () => {
    expect(compareCardsKerfuffle(card(10), card(3))).toBe(-1);
  });

  it('same rank ties in Kerfuffle', () => {
    expect(compareCardsKerfuffle(card(7), card(7))).toBe(0);
  });

  it('Dagger rule still applies in Kerfuffle (2 beats Ace)', () => {
    expect(compareCardsKerfuffle(card(2), card(14))).toBe(1);
    expect(compareCardsKerfuffle(card(14), card(2))).toBe(-1);
  });
});

describe('Deck creation', () => {
  describe('Single deck', () => {
    it('creates 52 cards', () => {
      const deck = createDeck();
      expect(deck.length).toBe(52);
    });

    it('has 13 cards per suit', () => {
      const deck = createDeck();
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;

      for (const suit of suits) {
        const suitCards = deck.filter((c) => c.suit === suit);
        expect(suitCards.length).toBe(13);
      }
    });

    it('has all ranks 2-14', () => {
      const deck = createDeck();
      const hearts = deck.filter((c) => c.suit === 'hearts');
      const ranks = hearts.map((c) => c.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    });
  });

  describe('Game deck (3 combined decks)', () => {
    it('creates 156 cards', () => {
      const deck = createGameDeck();
      expect(deck.length).toBe(156);
    });

    it('has correct distribution (3 of each card)', () => {
      const deck = createGameDeck();

      // Count Ace of Spades
      const aceOfSpades = deck.filter((c) => c.rank === 14 && c.suit === 'spades');
      expect(aceOfSpades.length).toBe(3);

      // Count 2 of Hearts
      const twoOfHearts = deck.filter((c) => c.rank === 2 && c.suit === 'hearts');
      expect(twoOfHearts.length).toBe(3);
    });

    it('is shuffled (not in original order)', () => {
      // Run multiple times to account for extremely unlikely shuffle matching original
      let allSame = true;
      for (let i = 0; i < 5; i++) {
        const deck = createGameDeck();
        const sortedDeck = [...deck].sort((a, b) => {
          if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
          return a.rank - b.rank;
        });
        const isSameOrder = deck.every((c, i) =>
          c.rank === sortedDeck[i].rank && c.suit === sortedDeck[i].suit
        );
        if (!isSameOrder) {
          allSame = false;
          break;
        }
      }
      expect(allSame).toBe(false);
    });
  });
});

describe('Shuffle', () => {
  it('maintains array length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not modify original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });
});

describe('Card display', () => {
  it('formats card correctly', () => {
    expect(getCardDisplay({ rank: 14, suit: 'spades', display: '' })).toBe('Ace of Spades');
    expect(getCardDisplay({ rank: 2, suit: 'hearts', display: '' })).toBe('Two of Hearts');
    expect(getCardDisplay({ rank: 12, suit: 'diamonds', display: '' })).toBe('Queen of Diamonds');
    expect(getCardDisplay({ rank: 11, suit: 'clubs', display: '' })).toBe('Jack of Clubs');
    expect(getCardDisplay({ rank: 10, suit: 'hearts', display: '' })).toBe('Ten of Hearts');
  });
});
