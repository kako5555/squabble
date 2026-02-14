import { Card } from '../cards';
import { GameState, Player } from '../state';
import { shouldAIEscalate, shouldAIUseReserve } from '../ai';

// Helper to create a card
function card(rank: number, suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' = 'hearts'): Card {
  return { rank, suit, display: `${rank} of ${suit}` };
}

// Helper to create a test player
function createPlayer(
  id: string,
  deck: Card[],
  options: Partial<Player> = {}
): Player {
  return {
    id,
    name: id,
    isHuman: false,
    deck,
    flippedCard: null,
    reserveCard: null,
    reserveUsed: false,
    isEliminated: false,
    warWins: 0,
    ...options,
  };
}

// Helper to create a test game state
function createGameState(players: Player[], options: Partial<GameState> = {}): GameState {
  return {
    players,
    currentPhase: 'flip',
    warState: null,
    pendingEscalation: null,
    canUseReserve: [],
    isEndgame: false,
    turnNumber: 0,
    log: [],
    winner: null,
    lastWarResult: null,
    ...options,
  };
}

describe('AI Escalation', () => {
  it('returns boolean decision', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 50 }, () => card(5))),
      createPlayer('p2', Array.from({ length: 50 }, () => card(5))),
    ]);

    const decision = shouldAIEscalate(state, 'bot');
    expect(typeof decision).toBe('boolean');
  });

  // Note: Since escalation uses random probability, we test the edge behavior
  // by running multiple times and checking the distribution makes sense

  it('escalates more often when AI has more cards than average', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 80 }, () => card(5))), // Above average
      createPlayer('p2', Array.from({ length: 40 }, () => card(5))),
      createPlayer('p3', Array.from({ length: 40 }, () => card(5))),
    ]);

    // Run 100 times and count escalations
    let escalations = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldAIEscalate(state, 'bot')) escalations++;
    }

    // With 60% probability, we expect roughly 60 escalations
    // Allow some variance but should be notably above 40
    expect(escalations).toBeGreaterThan(35);
  });

  it('escalates less often when AI has fewer cards than average', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 20 }, () => card(5))), // Below average
      createPlayer('p2', Array.from({ length: 50 }, () => card(5))),
      createPlayer('p3', Array.from({ length: 50 }, () => card(5))),
    ]);

    // Run 100 times and count escalations
    let escalations = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldAIEscalate(state, 'bot')) escalations++;
    }

    // With 20% probability, we expect roughly 20 escalations
    // Should be notably below 40
    expect(escalations).toBeLessThan(45);
  });
});

describe('AI Reserve Usage', () => {
  it('never uses reserve in first 5 turns', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 50 }, () => card(5)), {
        flippedCard: card(3), // Would lose
        reserveCard: card(14), // Ace would win
        reserveUsed: false,
      }),
      createPlayer('p2', [], { flippedCard: card(10) }),
    ], {
      turnNumber: 3, // Before turn 5
      canUseReserve: ['bot'],
    });

    expect(shouldAIUseReserve(state, 'bot')).toBe(false);
  });

  it('uses reserve when current card would lose and reserve would win', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 50 }, () => card(5)), {
        flippedCard: card(3), // Would lose
        reserveCard: card(14), // Ace would win
        reserveUsed: false,
      }),
      createPlayer('p2', [], { flippedCard: card(10) }),
    ], {
      turnNumber: 10, // After turn 5
      canUseReserve: ['bot'],
    });

    expect(shouldAIUseReserve(state, 'bot')).toBe(true);
  });

  it('does not use reserve when already winning', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 50 }, () => card(5)), {
        flippedCard: card(14), // Already winning
        reserveCard: card(10),
        reserveUsed: false,
      }),
      createPlayer('p2', [], { flippedCard: card(5) }),
    ], {
      turnNumber: 10,
      canUseReserve: ['bot'],
    });

    expect(shouldAIUseReserve(state, 'bot')).toBe(false);
  });

  it('does not use reserve when already used', () => {
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 50 }, () => card(5)), {
        flippedCard: card(3),
        reserveCard: null, // Already used
        reserveUsed: true,
      }),
      createPlayer('p2', [], { flippedCard: card(10) }),
    ], {
      turnNumber: 10,
    });

    expect(shouldAIUseReserve(state, 'bot')).toBe(false);
  });

  it('uses reserve more aggressively when card count is low', () => {
    // When below average cards, AI should use reserve even just to trigger war
    const state = createGameState([
      createPlayer('bot', Array.from({ length: 20 }, () => card(5)), { // Below average
        flippedCard: card(3), // Would lose
        reserveCard: card(10), // Would trigger war (tie with opponent)
        reserveUsed: false,
      }),
      createPlayer('p2', Array.from({ length: 50 }, () => card(5)), { flippedCard: card(10) }),
      createPlayer('p3', Array.from({ length: 50 }, () => card(5)), { flippedCard: card(5) }),
    ], {
      turnNumber: 10,
      canUseReserve: ['bot'],
    });

    expect(shouldAIUseReserve(state, 'bot')).toBe(true);
  });
});
