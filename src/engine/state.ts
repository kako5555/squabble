import { Card, createGameDeck } from './cards';
import { WarType } from '../utils/constants';

export interface Player {
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

export interface WarState {
  type: WarType;
  participants: string[]; // player IDs in the war
  sacrificeCount: Record<string, number>; // player ID -> sacrifice count
  pot: Card[]; // all cards in the war pot
  round: number; // war round (for recursive wars)
  nonParticipantId?: string; // for Squabbles - the high card holder who watches
  nonParticipantCard?: Card; // the high card that Squabble winner must beat
  originalCards: Record<string, Card>; // player ID -> their original card that triggered war
  warFlipCards: Record<string, Card>; // player ID -> their war flip card
  matchType?: WarType; // For compound types like "Bitch Fight Squabble" - what the matching cards are
}

export type GamePhase =
  | 'flip'
  | 'resolve'
  | 'war_declare'
  | 'war_sacrifice'
  | 'war_flip'
  | 'war_resolve'
  | 'game_over';

export interface WarResult {
  winnerId: string;
  winnerName: string;
  warType: string;
  winningCard: string;
  potSize: number; // Total cards won from the war
}

export interface GameState {
  players: Player[];
  currentPhase: GamePhase;
  warState: WarState | null;
  pendingEscalation: string | null; // player ID who can escalate
  canUseReserve: string[]; // player IDs who can use reserve this turn
  isEndgame: boolean;
  turnNumber: number;
  log: string[];
  winner: string | null;
  lastWarResult: WarResult | null; // Result of the last war for display
}

/**
 * Creates initial game state with 3 players (1 human, 2 AI)
 * Deals 156 cards evenly (52 each)
 * Draws 1 reserve card per player from their deck
 */
export function initializeGame(): GameState {
  const gameDeck = createGameDeck();

  // Deal 52 cards to each player
  const cardsPerPlayer = 52;

  const players: Player[] = [
    {
      id: 'human',
      name: 'You',
      isHuman: true,
      deck: gameDeck.slice(0, cardsPerPlayer),
      flippedCard: null,
      reserveCard: null,
      reserveUsed: false,
      isEliminated: false,
      warWins: 0,
    },
    {
      id: 'bot1',
      name: 'Bot 1',
      isHuman: false,
      deck: gameDeck.slice(cardsPerPlayer, cardsPerPlayer * 2),
      flippedCard: null,
      reserveCard: null,
      reserveUsed: false,
      isEliminated: false,
      warWins: 0,
    },
    {
      id: 'bot2',
      name: 'Bot 2',
      isHuman: false,
      deck: gameDeck.slice(cardsPerPlayer * 2, cardsPerPlayer * 3),
      flippedCard: null,
      reserveCard: null,
      reserveUsed: false,
      isEliminated: false,
      warWins: 0,
    },
  ];

  // Draw 1 reserve card per player from their deck
  for (const player of players) {
    if (player.deck.length > 0) {
      player.reserveCard = player.deck.shift()!;
    }
  }

  return {
    players,
    currentPhase: 'flip',
    warState: null,
    pendingEscalation: null,
    canUseReserve: [],
    isEndgame: false,
    turnNumber: 0,
    log: ['Game started! Each player has 51 cards + 1 reserve.'],
    winner: null,
    lastWarResult: null,
  };
}

/**
 * Returns non-eliminated players
 */
export function getActivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.isEliminated);
}

/**
 * Gets a player by ID
 */
export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Returns the total card count for a player (deck + reserve if unused)
 */
export function getPlayerCardCount(player: Player): number {
  let count = player.deck.length;
  if (player.reserveCard && !player.reserveUsed) {
    count += 1;
  }
  if (player.flippedCard) {
    count += 1;
  }
  return count;
}

/**
 * Returns average card count among active players
 */
export function getAverageCardCount(state: GameState): number {
  const activePlayers = getActivePlayers(state);
  if (activePlayers.length === 0) return 0;
  const total = activePlayers.reduce((sum, p) => sum + getPlayerCardCount(p), 0);
  return total / activePlayers.length;
}
