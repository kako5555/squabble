import { Card, compareCards } from './cards';
import {
  GameState,
  Player,
  getActivePlayers,
  getAverageCardCount,
  getPlayerCardCount,
} from './state';
import { AI_ESCALATION_BASE_CHANCE, AI_MIN_TURNS_BEFORE_RESERVE } from '../utils/constants';

/**
 * Determines if AI should declare escalation
 */
export function shouldAIEscalate(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  const cardCount = getPlayerCardCount(player);
  const avgCount = getAverageCardCount(state);

  let probability: number;

  if (cardCount > avgCount) {
    // AI has more cards than average - more aggressive
    probability = 0.6;
  } else if (cardCount < avgCount) {
    // AI has fewer cards than average - more conservative
    probability = 0.2;
  } else {
    probability = AI_ESCALATION_BASE_CHANCE; // 0.4
  }

  return Math.random() < probability;
}

/**
 * Determines if AI should use their reserve card
 */
export function shouldAIUseReserve(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.reserveUsed || !player.reserveCard || !player.flippedCard) {
    return false;
  }

  // Never use in first 5 turns
  if (state.turnNumber < AI_MIN_TURNS_BEFORE_RESERVE) {
    return false;
  }

  const activePlayers = getActivePlayers(state);
  const opponents = activePlayers.filter((p) => p.id !== playerId && p.flippedCard);

  if (opponents.length === 0) {
    return false;
  }

  const currentCard = player.flippedCard;
  const reserveCard = player.reserveCard;

  // Check if current card would lose to any opponent
  const wouldLose = opponents.some((opp) => {
    if (!opp.flippedCard) return false;
    return compareCards(currentCard, opp.flippedCard) < 0;
  });

  if (!wouldLose) {
    return false; // No need to swap if we're not losing
  }

  // Check if reserve card would win or at least tie
  const reserveWouldWinOrTie = opponents.every((opp) => {
    if (!opp.flippedCard) return true;
    return compareCards(reserveCard, opp.flippedCard) >= 0;
  });

  if (reserveWouldWinOrTie) {
    return true;
  }

  // If AI is in bottom half by card count, be more aggressive with reserve
  const cardCount = getPlayerCardCount(player);
  const avgCount = getAverageCardCount(state);

  if (cardCount < avgCount) {
    // More aggressive - use reserve if it would at least trigger a war
    const reserveWouldTriggerWar = opponents.some((opp) => {
      if (!opp.flippedCard) return false;
      return compareCards(reserveCard, opp.flippedCard) === 0;
    });

    return reserveWouldTriggerWar;
  }

  return false;
}

/**
 * Gets all AI decisions for the current state
 */
export interface AIDecision {
  playerId: string;
  action: 'escalate' | 'use_reserve' | 'none';
}

export function getAIDecisions(state: GameState): AIDecision[] {
  const decisions: AIDecision[] = [];
  const activePlayers = getActivePlayers(state);

  for (const player of activePlayers) {
    if (player.isHuman) continue;

    // Check for reserve usage first
    if (state.canUseReserve.includes(player.id) && shouldAIUseReserve(state, player.id)) {
      decisions.push({ playerId: player.id, action: 'use_reserve' });
      continue;
    }

    // Check for escalation
    if (state.pendingEscalation === player.id && shouldAIEscalate(state, player.id)) {
      decisions.push({ playerId: player.id, action: 'escalate' });
      continue;
    }

    decisions.push({ playerId: player.id, action: 'none' });
  }

  return decisions;
}
