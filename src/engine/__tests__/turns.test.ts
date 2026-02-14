import { Card } from '../cards';
import { GameState, Player, initializeGame, getActivePlayers } from '../state';
import {
  flipCards,
  detectOutcome,
  initiateWar,
  executeWarSacrifice,
  executeWarFlip,
  resolveWar,
  resolveTurn,
  useReserve,
  declareEscalation,
} from '../turns';

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

describe('Flip cards', () => {
  it('each player flips their top card', () => {
    const state = createGameState([
      createPlayer('p1', [card(5), card(6)]),
      createPlayer('p2', [card(10), card(11)]),
      createPlayer('p3', [card(7), card(8)]),
    ]);

    const newState = flipCards(state);

    expect(newState.players[0].flippedCard?.rank).toBe(5);
    expect(newState.players[1].flippedCard?.rank).toBe(10);
    expect(newState.players[2].flippedCard?.rank).toBe(7);

    // Cards removed from deck
    expect(newState.players[0].deck.length).toBe(1);
    expect(newState.players[1].deck.length).toBe(1);
    expect(newState.players[2].deck.length).toBe(1);
  });

  it('increments turn number', () => {
    const state = createGameState([
      createPlayer('p1', [card(5)]),
      createPlayer('p2', [card(10)]),
    ]);

    const newState = flipCards(state);
    expect(newState.turnNumber).toBe(1);
  });
});

describe('Detect outcome', () => {
  describe('Single winner', () => {
    it('detects highest card as winner', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(5) }),
        createPlayer('p2', [], { flippedCard: card(10) }),
        createPlayer('p3', [], { flippedCard: card(7) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('win');
      expect(outcome.winnerId).toBe('p2');
    });

    it('respects Dagger rule - 2 beats Ace', () => {
      // 2-player test: 2 vs Ace, 2 should win
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(2) }),
        createPlayer('p2', [], { flippedCard: card(14) }), // Ace
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('win');
      expect(outcome.winnerId).toBe('p1'); // 2 beats Ace
    });

    it('respects Dagger rule - 2 loses to other cards', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(2) }),
        createPlayer('p2', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('win');
      expect(outcome.winnerId).toBe('p2'); // 5 beats 2
    });
  });

  describe('War detection', () => {
    it('detects standard war', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(10) }),
        createPlayer('p2', [], { flippedCard: card(10) }),
        createPlayer('p3', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war');
      expect(outcome.warType).toBe('standard');
      expect(outcome.participants).toContain('p1');
      expect(outcome.participants).toContain('p2');
    });

    it('detects Nuke (Ace vs Ace)', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(14) }),
        createPlayer('p2', [], { flippedCard: card(14) }),
        createPlayer('p3', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war');
      expect(outcome.warType).toBe('nuke');
    });

    it('detects Bitch Fight (Queen vs Queen)', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(12) }),
        createPlayer('p2', [], { flippedCard: card(12) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war');
      expect(outcome.warType).toBe('bitch_fight');
    });

    it('detects Kerfuffle (2 vs 2)', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(2) }),
        createPlayer('p2', [], { flippedCard: card(2) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war');
      expect(outcome.warType).toBe('kerfuffle');
    });

    it('detects Jack Off (Jack vs Jack)', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(11) }),
        createPlayer('p2', [], { flippedCard: card(11) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war');
      expect(outcome.warType).toBe('jack_off');
    });

    it('detects 3-way war', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(10) }),
        createPlayer('p2', [], { flippedCard: card(10) }),
        createPlayer('p3', [], { flippedCard: card(10) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war');
      expect(outcome.participants?.length).toBe(3);
    });
  });

  describe('Squabble detection', () => {
    it('detects Squabble when two lower cards match', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(13) }), // King - high card
        createPlayer('p2', [], { flippedCard: card(7) }),  // Match
        createPlayer('p3', [], { flippedCard: card(7) }),  // Match
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('squabble');
      expect(outcome.squabbleInfo?.highPlayer).toBe('p1');
      expect(outcome.squabbleInfo?.matchingPlayers).toContain('p2');
      expect(outcome.squabbleInfo?.matchingPlayers).toContain('p3');
      expect(outcome.squabbleInfo?.matchingRank).toBe(7);
    });

    it('does not detect Squabble with only 2 players', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(7) }),
        createPlayer('p2', [], { flippedCard: card(7) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('war'); // Regular war, not squabble
    });

    it('Squabble takes priority over regular war', () => {
      // If two lower cards match and there's a higher card,
      // it's a squabble not a war between the matching cards
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(14) }), // Ace - watching
        createPlayer('p2', [], { flippedCard: card(5) }),
        createPlayer('p3', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('squabble');
    });
  });

  describe('Escalation eligibility', () => {
    it('detects escalation eligibility', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(10) }), // Highest
        createPlayer('p2', [], { flippedCard: card(9) }),  // One below - can escalate
        createPlayer('p3', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('escalation_eligible');
      expect(outcome.winnerId).toBe('p1');
      expect(outcome.escalationEligible).toContain('p2');
    });

    it('detects escalation eligibility for face cards (King vs Queen)', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(13) }), // King - highest
        createPlayer('p2', [], { flippedCard: card(12) }), // Queen - one below, can escalate
        createPlayer('p3', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('escalation_eligible');
      expect(outcome.winnerId).toBe('p1');
      expect(outcome.escalationEligible).toContain('p2');
    });

    it('detects escalation eligibility for Ace vs King', () => {
      const state = createGameState([
        createPlayer('p1', [], { flippedCard: card(14) }), // Ace - highest
        createPlayer('p2', [], { flippedCard: card(13) }), // King - one below, can escalate
        createPlayer('p3', [], { flippedCard: card(5) }),
      ]);

      const outcome = detectOutcome(state);
      expect(outcome.type).toBe('escalation_eligible');
      expect(outcome.winnerId).toBe('p1');
      expect(outcome.escalationEligible).toContain('p2');
    });
  });
});

describe('War resolution', () => {
  it('sacrifices correct number of cards for standard war', () => {
    const state = createGameState([
      createPlayer('p1', [card(3), card(4), card(5), card(6)], { flippedCard: card(10) }),
      createPlayer('p2', [card(7), card(8), card(9), card(11)], { flippedCard: card(10) }),
    ], {
      warState: {
        type: 'standard',
        participants: ['p1', 'p2'],
        sacrificeCount: { p1: 3, p2: 3 },
        pot: [],
        round: 1,
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    const afterSacrifice = executeWarSacrifice(state);

    // Each player sacrificed 3 cards
    expect(afterSacrifice.players[0].deck.length).toBe(1); // Had 4, sacrificed 3
    expect(afterSacrifice.players[1].deck.length).toBe(1);

    // Pot has 6 sacrifice cards + 2 flipped cards = 8
    expect(afterSacrifice.warState?.pot.length).toBe(8);
  });

  it('sacrifices 10 cards for Nuke', () => {
    const bigDeck = Array.from({ length: 15 }, (_, i) => card(i % 13 + 2));
    const state = createGameState([
      createPlayer('p1', [...bigDeck], { flippedCard: card(14) }),
      createPlayer('p2', [...bigDeck], { flippedCard: card(14) }),
    ], {
      warState: {
        type: 'nuke',
        participants: ['p1', 'p2'],
        sacrificeCount: { p1: 10, p2: 10 },
        pot: [],
        round: 1,
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    const afterSacrifice = executeWarSacrifice(state);

    expect(afterSacrifice.players[0].deck.length).toBe(5); // Had 15, sacrificed 10
    expect(afterSacrifice.players[1].deck.length).toBe(5);
  });

  it('sacrifices 5 cards for Bitch Fight', () => {
    const deck = Array.from({ length: 8 }, (_, i) => card(i % 13 + 2));
    const state = createGameState([
      createPlayer('p1', [...deck], { flippedCard: card(12) }),
      createPlayer('p2', [...deck], { flippedCard: card(12) }),
    ], {
      warState: {
        type: 'bitch_fight',
        participants: ['p1', 'p2'],
        sacrificeCount: { p1: 5, p2: 5 },
        pot: [],
        round: 1,
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    const afterSacrifice = executeWarSacrifice(state);

    expect(afterSacrifice.players[0].deck.length).toBe(3); // Had 8, sacrificed 5
  });

  it('lowest wins in Kerfuffle', () => {
    const state = createGameState([
      createPlayer('p1', [card(3), card(4), card(5), card(3)], { flippedCard: card(2) }), // War card is 3
      createPlayer('p2', [card(7), card(8), card(9), card(10)], { flippedCard: card(2) }), // War card is 10
    ], {
      warState: {
        type: 'kerfuffle',
        participants: ['p1', 'p2'],
        sacrificeCount: { p1: 3, p2: 3 },
        pot: [],
        round: 1,
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    let afterSacrifice = executeWarSacrifice(state);
    let afterFlip = executeWarFlip(afterSacrifice);

    // p1 flipped 3, p2 flipped 10 - in Kerfuffle, LOWEST wins
    expect(afterFlip.players[0].flippedCard?.rank).toBe(3);
    expect(afterFlip.players[1].flippedCard?.rank).toBe(10);

    const resolved = resolveWar(afterFlip);

    // p1 should win because 3 < 10 in Kerfuffle
    expect(resolved.log.some(l => l.includes('p1') && l.includes('wins'))).toBe(true);
  });
});

describe('All-in mechanic', () => {
  it('player goes all-in when cant meet sacrifice', () => {
    const state = createGameState([
      createPlayer('p1', [card(5), card(6)], { flippedCard: card(10) }), // Only 2 cards, need 3
      createPlayer('p2', [card(7), card(8), card(9), card(11)], { flippedCard: card(10) }),
    ], {
      warState: {
        type: 'standard',
        participants: ['p1', 'p2'],
        sacrificeCount: { p1: 3, p2: 3 },
        pot: [],
        round: 1,
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    const afterSacrifice = executeWarSacrifice(state);

    // p1 sacrificed all 2 cards (couldn't meet 3)
    expect(afterSacrifice.players[0].deck.length).toBe(0);
    // Log should mention all-in
    expect(afterSacrifice.log.some(l => l.includes('ALL IN'))).toBe(true);
  });
});

describe('Reserve card', () => {
  it('swaps reserve with flipped card', () => {
    const state = createGameState([
      createPlayer('p1', [card(3), card(4)], {
        flippedCard: card(5),
        reserveCard: card(14), // Ace reserve
        reserveUsed: false,
      }),
      createPlayer('p2', [], { flippedCard: card(10) }),
    ], {
      canUseReserve: ['p1'],
    });

    const newState = useReserve(state, 'p1');

    expect(newState.players[0].flippedCard?.rank).toBe(14); // Now showing Ace
    expect(newState.players[0].reserveCard).toBeNull();
    expect(newState.players[0].reserveUsed).toBe(true);
    // Original card went to bottom of deck
    expect(newState.players[0].deck[newState.players[0].deck.length - 1].rank).toBe(5);
  });

  it('cannot use reserve twice', () => {
    const state = createGameState([
      createPlayer('p1', [], {
        flippedCard: card(5),
        reserveCard: null,
        reserveUsed: true,
      }),
    ]);

    const newState = useReserve(state, 'p1');
    expect(newState).toBe(state); // No change
  });

  it('cannot use reserve during war', () => {
    const state = createGameState([
      createPlayer('p1', [], {
        flippedCard: card(5),
        reserveCard: card(14),
        reserveUsed: false,
      }),
    ], {
      canUseReserve: [], // Empty during war
    });

    const newState = useReserve(state, 'p1');
    expect(newState).toBe(state); // No change
  });
});

describe('Escalation', () => {
  it('escalating player sacrifices 4, opponent sacrifices 3', () => {
    const state = createGameState([
      createPlayer('p1', Array.from({ length: 10 }, () => card(5)), { flippedCard: card(10) }), // Winner
      createPlayer('p2', Array.from({ length: 10 }, () => card(5)), { flippedCard: card(9) }),  // Escalating
    ], {
      currentPhase: 'resolve',
    });

    const afterEscalation = declareEscalation(state, 'p2');

    expect(afterEscalation.warState?.sacrificeCount['p2']).toBe(4); // Escalating player
    expect(afterEscalation.warState?.sacrificeCount['p1']).toBe(3); // Opponent
  });
});

describe('Endgame', () => {
  it('triggers endgame when 2 players remain', () => {
    const state = createGameState([
      createPlayer('p1', [card(10)], { flippedCard: card(14) }),
      createPlayer('p2', [card(5)], { flippedCard: card(3) }),
      createPlayer('p3', [], { isEliminated: true }),
    ]);

    const resolved = resolveTurn(state, 'p1');
    expect(resolved.isEndgame).toBe(true);
    expect(resolved.log.some(l => l.includes('ENDGAME'))).toBe(true);
  });

  it('first to 3 war wins wins the game', () => {
    const state = createGameState([
      createPlayer('p1', [card(10), card(11)], { flippedCard: card(14), warWins: 2 }),
      createPlayer('p2', [card(5)], { flippedCard: card(14) }),
    ], {
      isEndgame: true,
      warState: {
        type: 'nuke',
        participants: ['p1', 'p2'],
        sacrificeCount: { p1: 3, p2: 3 },
        pot: [],
        round: 1,
        originalCards: {},
        warFlipCards: {},
      },
    });

    // p1 already has 2 war wins, winning this war should end the game
    const resolved = resolveTurn(state, 'p1');

    expect(resolved.players[0].warWins).toBe(3);
    expect(resolved.currentPhase).toBe('game_over');
    expect(resolved.winner).toBe('p1');
  });
});

describe('Player elimination', () => {
  it('eliminates player with no cards', () => {
    const state = createGameState([
      createPlayer('p1', [card(10)], { flippedCard: card(14) }),
      createPlayer('p2', [], { flippedCard: card(3) }), // Will have 0 cards after turn
      createPlayer('p3', [card(5)], { flippedCard: card(5) }),
    ]);

    const resolved = resolveTurn(state, 'p1');

    expect(resolved.players[1].isEliminated).toBe(true);
    expect(resolved.log.some(l => l.includes('OUT'))).toBe(true);
  });

  it('game over when one player remains', () => {
    const state = createGameState([
      createPlayer('p1', [card(10)], { flippedCard: card(14) }),
      createPlayer('p2', [], { flippedCard: card(3), isEliminated: true }),
      createPlayer('p3', [], { flippedCard: card(5) }), // Will be eliminated
    ]);

    const resolved = resolveTurn(state, 'p1');

    expect(resolved.currentPhase).toBe('game_over');
    expect(resolved.winner).toBe('p1');
  });
});

describe('Squabble resolution', () => {
  it('Squabble winner beats high card - takes all', () => {
    const state = createGameState([
      createPlayer('p1', [], { flippedCard: card(10) }), // High card - watching
      createPlayer('p2', [card(3), card(4), card(5), card(14)], { flippedCard: card(7) }), // Squabble participant
      createPlayer('p3', [card(6), card(7), card(8), card(9)], { flippedCard: card(7) }),  // Squabble participant
    ], {
      warState: {
        type: 'squabble',
        participants: ['p2', 'p3'],
        sacrificeCount: { p2: 3, p3: 3 },
        pot: [],
        round: 1,
        nonParticipantId: 'p1',
        nonParticipantCard: card(10),
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    // p2 will flip Ace (14), p3 will flip 9
    // p2 wins squabble, and 14 > 10, so p2 takes all including p1's card
    let afterSacrifice = executeWarSacrifice(state);
    let afterFlip = executeWarFlip(afterSacrifice);

    expect(afterFlip.players[1].flippedCard?.rank).toBe(14); // p2 flipped Ace

    const resolved = resolveWar(afterFlip);

    // p2 should win and take everything
    expect(resolved.log.some(l => l.includes('OVERTAKES'))).toBe(true);
  });

  it('Squabble winner cant beat high card - high card takes all', () => {
    const state = createGameState([
      createPlayer('p1', [], { flippedCard: card(14) }), // Ace - watching
      createPlayer('p2', [card(3), card(4), card(5), card(10)], { flippedCard: card(7) }), // Will flip 10
      createPlayer('p3', [card(6), card(7), card(8), card(9)], { flippedCard: card(7) }),
    ], {
      warState: {
        type: 'squabble',
        participants: ['p2', 'p3'],
        sacrificeCount: { p2: 3, p3: 3 },
        pot: [],
        round: 1,
        nonParticipantId: 'p1',
        nonParticipantCard: card(14), // Ace
        originalCards: {},
        warFlipCards: {},
      },
      currentPhase: 'war_sacrifice',
    });

    // p2 will flip 10, p3 will flip 9
    // p2 wins squabble, but 10 < 14, so p1 (Ace holder) takes all
    let afterSacrifice = executeWarSacrifice(state);
    let afterFlip = executeWarFlip(afterSacrifice);

    const resolved = resolveWar(afterFlip);

    // p1 should end up with the cards
    expect(resolved.log.some(l => l.includes("can't beat") || l.includes('takes all'))).toBe(true);
  });
});
