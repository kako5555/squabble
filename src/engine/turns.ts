import { Card, compareCards, compareCardsKerfuffle, getCardDisplay } from './cards';
import {
  GameState,
  Player,
  WarState,
  getActivePlayers,
  getPlayer,
  getPlayerCardCount,
} from './state';
import { WAR_SACRIFICE_COUNTS, ENDGAME_WARS_TO_WIN, WarType } from '../utils/constants';

export interface Outcome {
  type: 'win' | 'war' | 'squabble' | 'escalation_eligible';
  winnerId?: string;
  warType?: WarType;
  participants?: string[];
  escalationEligible?: string[]; // players who can escalate
  squabbleInfo?: {
    matchingPlayers: string[];
    highPlayer: string;
    matchingRank: number;
  };
}

/**
 * Each active player flips their top card
 */
export function flipCards(state: GameState): GameState {
  const newState = cloneState(state);
  const activePlayers = getActivePlayers(newState);

  for (const player of activePlayers) {
    const statePlayer = newState.players.find((p) => p.id === player.id)!;
    if (statePlayer.deck.length > 0) {
      statePlayer.flippedCard = statePlayer.deck.shift()!;
    }
  }

  newState.turnNumber += 1;
  newState.currentPhase = 'resolve';
  // All players with unused reserves can potentially use them on initial flip
  newState.canUseReserve = activePlayers
    .filter((p) => !p.reserveUsed && p.reserveCard !== null)
    .map((p) => p.id);

  return newState;
}

/**
 * Analyzes flipped cards and returns the outcome type
 */
export function detectOutcome(state: GameState): Outcome {
  const activePlayers = getActivePlayers(state);
  const flippedCards = activePlayers
    .filter((p) => p.flippedCard !== null)
    .map((p) => ({ playerId: p.id, card: p.flippedCard! }));

  if (flippedCards.length === 0) {
    return { type: 'win' };
  }

  // Find the highest card(s) using compareCards (respects Dagger rule)
  let highestCards = [flippedCards[0]];
  for (let i = 1; i < flippedCards.length; i++) {
    const comparison = compareCards(flippedCards[i].card, highestCards[0].card);
    if (comparison > 0) {
      highestCards = [flippedCards[i]];
    } else if (comparison === 0) {
      highestCards.push(flippedCards[i]);
    }
  }
  const maxRank = highestCards[0].card.rank;

  // Check for Squabble first (3+ players: two+ lower matching values while a higher card exists)
  if (activePlayers.length >= 3 && highestCards.length === 1) {
    const lowerCards = flippedCards.filter((fc) => fc.card.rank < maxRank);

    // Group lower cards by rank
    const rankGroups = new Map<number, typeof flippedCards>();
    for (const fc of lowerCards) {
      const group = rankGroups.get(fc.card.rank) || [];
      group.push(fc);
      rankGroups.set(fc.card.rank, group);
    }

    // Check if any lower rank has 2+ matching cards
    for (const [rank, group] of rankGroups) {
      if (group.length >= 2) {
        return {
          type: 'squabble',
          squabbleInfo: {
            matchingPlayers: group.map((fc) => fc.playerId),
            highPlayer: highestCards[0].playerId,
            matchingRank: rank,
          },
        };
      }
    }
  }

  // Check for matching pairs (war)
  if (highestCards.length >= 2) {
    const warType = determineWarType(maxRank);
    const participants = highestCards.map((fc) => fc.playerId);

    return {
      type: 'war',
      warType,
      participants,
    };
  }

  // Check for escalation eligibility (card exactly 1 rank below highest)
  const escalationEligible: string[] = [];
  for (const fc of flippedCards) {
    if (fc.card.rank === maxRank - 1) {
      escalationEligible.push(fc.playerId);
    }
  }

  if (escalationEligible.length > 0) {
    return {
      type: 'escalation_eligible',
      winnerId: highestCards[0].playerId,
      escalationEligible,
    };
  }

  // Single highest card wins
  return {
    type: 'win',
    winnerId: highestCards[0].playerId,
  };
}

/**
 * Determines war type based on matching rank
 */
function determineWarType(rank: number): WarType {
  switch (rank) {
    case 14: return 'nuke';      // Ace vs Ace
    case 12: return 'bitch_fight'; // Queen vs Queen
    case 2:  return 'kerfuffle';  // 2 vs 2
    case 11: return 'jack_off';   // Jack vs Jack
    default: return 'standard';
  }
}

/**
 * Player opts into escalation
 */
export function declareEscalation(state: GameState, playerId: string): GameState {
  const newState = cloneState(state);
  const outcome = detectOutcome(state);

  if (outcome.type !== 'escalation_eligible' || !outcome.winnerId) {
    return state; // Can't escalate
  }

  const participants = [playerId, outcome.winnerId];

  // Create war state with escalation sacrifices
  const sacrificeCount: Record<string, number> = {};
  sacrificeCount[playerId] = WAR_SACRIFICE_COUNTS.escalation; // 4 cards
  sacrificeCount[outcome.winnerId] = WAR_SACRIFICE_COUNTS.standard; // 3 cards

  // Store original cards
  const originalCards: Record<string, Card> = {};
  for (const pid of participants) {
    const p = getPlayer(newState, pid);
    if (p?.flippedCard) {
      originalCards[pid] = { ...p.flippedCard };
    }
  }

  newState.warState = {
    type: 'escalation',
    participants,
    sacrificeCount,
    pot: [],
    round: 1,
    originalCards,
    warFlipCards: {},
  };

  newState.currentPhase = 'war_sacrifice';
  newState.pendingEscalation = null;
  newState.canUseReserve = []; // Can't use reserve during war

  const escalatingPlayer = getPlayer(newState, playerId);
  newState.log.push(
    `📈 ESCALATION! ${escalatingPlayer?.name} is going in heavy — 4 cards sacrificed!`
  );

  return newState;
}

/**
 * Escalate during an existing war (after war flip shows 1 rank below)
 */
export function declareWarEscalation(state: GameState, playerId: string): GameState {
  const newState = cloneState(state);
  const war = newState.warState;

  if (!war || newState.pendingEscalation !== playerId) {
    return state; // Can't escalate
  }

  const escalatingPlayer = getPlayer(newState, playerId);
  if (!escalatingPlayer) return state;

  // Find the current winner (highest card)
  const participants = war.participants
    .map((pid) => {
      const p = getPlayer(newState, pid);
      return { player: p!, card: p?.flippedCard };
    })
    .filter((p) => p.card !== null);

  let winnerId = participants[0]?.player.id;
  let winnerCard = participants[0]?.card;

  for (const p of participants) {
    if (p.card && winnerCard && compareCards(p.card, winnerCard) > 0) {
      winnerId = p.player.id;
      winnerCard = p.card;
    }
  }

  if (!winnerId) return state;

  // Add current flipped cards to pot
  for (const p of participants) {
    if (p.card) {
      war.pot.push(p.card);
      p.player.flippedCard = null;
    }
  }

  // Set up next war round with escalation
  war.round += 1;
  war.participants = [playerId, winnerId];
  war.sacrificeCount = {
    [playerId]: WAR_SACRIFICE_COUNTS.escalation, // 4 cards for escalator
    [winnerId]: WAR_SACRIFICE_COUNTS.standard, // 3 cards for defender
  };
  war.warFlipCards = {};

  newState.currentPhase = 'war_sacrifice';
  newState.pendingEscalation = null;

  newState.log.push(
    `📈 WAR ESCALATION! ${escalatingPlayer.name} challenges with 4 cards!`
  );

  return newState;
}

/**
 * Skip war escalation and finalize the winner
 */
export function skipWarEscalation(state: GameState): GameState {
  const newState = cloneState(state);
  const war = newState.warState;

  if (!war) return state;

  // Find the winner (highest card)
  const participants = war.participants
    .map((pid) => {
      const p = getPlayer(newState, pid);
      return { player: p!, card: p?.flippedCard };
    })
    .filter((p) => p.card !== null);

  let winnerId = participants[0]?.player.id;
  let winnerCard = participants[0]?.card;

  for (const p of participants) {
    if (p.card && winnerCard && compareCards(p.card, winnerCard) > 0) {
      winnerId = p.player.id;
      winnerCard = p.card;
    }
  }

  newState.pendingEscalation = null;

  if (winnerId) {
    return finalizeWarWinner(newState, winnerId);
  }

  return newState;
}

/**
 * Swap flipped card with reserve card
 */
export function useReserve(state: GameState, playerId: string): GameState {
  const newState = cloneState(state);
  const player = newState.players.find((p) => p.id === playerId);

  if (!player || player.reserveUsed || !player.reserveCard || !player.flippedCard) {
    return state; // Can't use reserve
  }

  if (!newState.canUseReserve.includes(playerId)) {
    return state; // Not eligible to use reserve this turn
  }

  // Swap: reserve becomes flipped, original flipped goes to bottom of deck
  const originalFlipped = player.flippedCard;
  player.flippedCard = player.reserveCard;
  player.reserveCard = null;
  player.reserveUsed = true;
  player.deck.push(originalFlipped);

  // Remove from canUseReserve list
  newState.canUseReserve = newState.canUseReserve.filter((id) => id !== playerId);

  newState.log.push(`🎴 RESERVE SWAP! ${player.name} played their hidden card!`);

  return newState;
}

/**
 * Initiates a war based on outcome
 */
export function initiateWar(state: GameState, outcome: Outcome): GameState {
  const newState = cloneState(state);

  if (outcome.type === 'squabble' && outcome.squabbleInfo) {
    // Squabble: matching lower players enter war, high player watches
    const { matchingPlayers, highPlayer, matchingRank } = outcome.squabbleInfo;
    const highPlayerObj = getPlayer(state, highPlayer);
    const highCard = highPlayerObj?.flippedCard;

    // Determine the match type based on what cards are matching
    const matchType = determineWarType(matchingRank);
    // Use the sacrifice count from the match type (e.g., Queens = 5, Jacks = 3, etc.)
    const baseSacrifice = WAR_SACRIFICE_COUNTS[matchType];

    const sacrificeCount: Record<string, number> = {};
    const originalCards: Record<string, Card> = {};
    for (const pid of matchingPlayers) {
      sacrificeCount[pid] = baseSacrifice;
      const p = getPlayer(newState, pid);
      if (p?.flippedCard) {
        originalCards[pid] = { ...p.flippedCard };
      }
    }

    newState.warState = {
      type: 'squabble',
      participants: matchingPlayers,
      sacrificeCount,
      pot: [],
      round: 1,
      nonParticipantId: highPlayer,
      nonParticipantCard: highCard || undefined,
      originalCards,
      warFlipCards: {},
      matchType, // Store the match type for compound display
    };

    const matchingNames = matchingPlayers
      .map((id) => getPlayer(newState, id)?.name)
      .join(' and ');

    // Build compound log message
    let warTypeName = '';
    if (matchType === 'bitch_fight') {
      warTypeName = 'BITCH FIGHT SQUABBLE';
    } else if (matchType === 'kerfuffle') {
      warTypeName = 'KERFUFFLE SQUABBLE';
    } else if (matchType === 'jack_off') {
      warTypeName = 'JACK OFF SQUABBLE';
    } else {
      warTypeName = 'SQUABBLE';
    }

    if (matchType === 'bitch_fight') {
      newState.log.push(
        `👑⚔️ ${warTypeName}! ${matchingNames} have matching Queens! 5 cards sacrificed, fighting for a shot at ${highPlayerObj?.name}'s ${getCardDisplay(highCard!)}!`
      );
    } else if (matchType === 'kerfuffle') {
      newState.log.push(
        `🗡️⚔️ ${warTypeName}! ${matchingNames} have matching Daggers! Lowest wins, fighting for a shot at ${highPlayerObj?.name}'s ${getCardDisplay(highCard!)}!`
      );
    } else if (matchType === 'jack_off') {
      newState.log.push(
        `🃏⚔️ ${warTypeName}! ${matchingNames} have matching Jacks! Fighting for a shot at ${highPlayerObj?.name}'s ${getCardDisplay(highCard!)}!`
      );
    } else {
      newState.log.push(
        `⚔️ SQUABBLE! ${matchingNames} match at ${matchingRank} — they're forced to fight for a shot at ${highPlayerObj?.name}'s ${getCardDisplay(highCard!)}!`
      );
    }
  } else if (outcome.type === 'war' && outcome.warType && outcome.participants) {
    const sacrificeCount: Record<string, number> = {};
    const originalCards: Record<string, Card> = {};
    const baseSacrifice = WAR_SACRIFICE_COUNTS[outcome.warType];
    for (const pid of outcome.participants) {
      sacrificeCount[pid] = baseSacrifice;
      const p = getPlayer(newState, pid);
      if (p?.flippedCard) {
        originalCards[pid] = { ...p.flippedCard };
      }
    }

    newState.warState = {
      type: outcome.warType,
      participants: outcome.participants,
      sacrificeCount,
      pot: [],
      round: 1,
      originalCards,
      warFlipCards: {},
    };

    const participantNames = outcome.participants
      .map((id) => getPlayer(newState, id)?.name)
      .join(' vs ');

    switch (outcome.warType) {
      case 'nuke':
        newState.log.push(
          `☢️ NUKE! ACE vs ACE! 10 cards sacrificed. This is MASSIVE.`
        );
        break;
      case 'bitch_fight':
        newState.log.push(
          `👑 BITCH FIGHT! Queen vs Queen! 5 cards down, one queen stands.`
        );
        break;
      case 'kerfuffle':
        newState.log.push(
          `🗡️ KERFUFFLE! Dagger vs Dagger! Lowest card wins this one...`
        );
        break;
      case 'jack_off':
        newState.log.push(
          `🃏 JACK OFF! Jack vs Jack. Standard war. Yes, that's really what it's called.`
        );
        break;
      default:
        const cards = outcome.participants
          .map((id) => getPlayer(newState, id)?.flippedCard?.rank)
          .join(' vs ');
        newState.log.push(
          `WAR! ${cards} — ${baseSacrifice} cards on the line!`
        );
    }
  }

  newState.currentPhase = 'war_sacrifice';
  newState.canUseReserve = []; // Can't use reserve during war

  return newState;
}

/**
 * Execute war sacrifice phase
 */
export function executeWarSacrifice(state: GameState): GameState {
  const newState = cloneState(state);
  const war = newState.warState;

  if (!war) return state;

  // Collect sacrifice cards from each participant
  for (const playerId of war.participants) {
    const player = newState.players.find((p) => p.id === playerId)!;
    const requiredSacrifice = war.sacrificeCount[playerId];
    const actualSacrifice = Math.min(requiredSacrifice, player.deck.length);

    // Handle all-in scenario
    if (actualSacrifice < requiredSacrifice && player.deck.length > 0) {
      newState.log.push(
        `🎲 ${player.name} goes ALL IN with only ${player.deck.length + 1} cards left!`
      );
    }

    // Move sacrifice cards to pot
    const sacrificed = player.deck.splice(0, actualSacrifice);
    war.pot.push(...sacrificed);
  }

  // Also add all flipped cards to pot
  for (const player of getActivePlayers(newState)) {
    if (player.flippedCard) {
      war.pot.push(player.flippedCard);
      player.flippedCard = null;
    }
  }

  newState.currentPhase = 'war_flip';
  return newState;
}

/**
 * Execute war flip phase - participants flip their war cards
 */
export function executeWarFlip(state: GameState): GameState {
  const newState = cloneState(state);
  const war = newState.warState;

  if (!war) return state;

  // Each participant flips their top card
  for (const playerId of war.participants) {
    const player = newState.players.find((p) => p.id === playerId)!;
    if (player.deck.length > 0) {
      player.flippedCard = player.deck.shift()!;
      // Store the war flip card
      war.warFlipCards[playerId] = { ...player.flippedCard };
    }
    // If they have no cards, flippedCard remains null (they're eliminated after war)
  }

  newState.currentPhase = 'war_resolve';
  return newState;
}

/**
 * Resolve the war - determine winner
 */
export function resolveWar(state: GameState): GameState {
  let newState = cloneState(state);
  const war = newState.warState;

  if (!war) return state;

  const participants = war.participants
    .map((id) => {
      const player = newState.players.find((p) => p.id === id)!;
      return { player, card: player.flippedCard };
    })
    .filter((p) => p.card !== null);

  // If only one participant has a card, they win by default
  if (participants.length === 0) {
    // No one has cards - edge case, shouldn't happen normally
    newState.warState = null;
    newState.currentPhase = 'flip';
    return newState;
  }

  if (participants.length === 1) {
    // Only one player has a card - they win
    return finalizeWarWinner(newState, participants[0].player.id);
  }

  // Compare cards - use Kerfuffle rules if it's a kerfuffle (or kerfuffle squabble)
  const isKerfuffle = war.type === 'kerfuffle' || war.matchType === 'kerfuffle';
  const compareFn = isKerfuffle ? compareCardsKerfuffle : compareCards;

  // Find winner(s) among participants
  let bestPlayers = [participants[0]];

  for (let i = 1; i < participants.length; i++) {
    const comparison = compareFn(participants[i].card!, bestPlayers[0].card!);
    if (comparison > 0) {
      bestPlayers = [participants[i]];
    } else if (comparison === 0) {
      bestPlayers.push(participants[i]);
    }
  }

  // If tie, recursive war (double war)
  if (bestPlayers.length > 1) {
    const tiedIds = bestPlayers.map((p) => p.player.id);
    newState.log.push(`DOUBLE WAR! ${tiedIds.map((id) => getPlayer(newState, id)?.name).join(' and ')} clash again!`);

    // Reset for next war round
    war.round += 1;
    war.participants = tiedIds;

    // Update sacrifice counts for next round
    for (const id of tiedIds) {
      war.sacrificeCount[id] = WAR_SACRIFICE_COUNTS[war.type === 'escalation' ? 'standard' : war.type];
    }

    // Add current flipped cards to pot
    for (const p of participants) {
      if (p.card) {
        war.pot.push(p.card);
        p.player.flippedCard = null;
      }
    }

    // Clear war flip cards for next round
    war.warFlipCards = {};

    newState.currentPhase = 'war_flip';
    return newState;
  }

  // Check for war escalation eligibility (someone is 1 rank below winner)
  // Skip for Squabbles - they have special resolution with high card check
  if (war.type !== 'squabble') {
    const winnerCard = bestPlayers[0].card!;
    const winnerRank = winnerCard.rank;
    const escalationEligible: string[] = [];

    for (const p of participants) {
      if (p.player.id !== bestPlayers[0].player.id && p.card) {
        // Check if exactly 1 rank below (not using Kerfuffle rules for escalation check)
        if (p.card.rank === winnerRank - 1) {
          escalationEligible.push(p.player.id);
        }
      }
    }

    if (escalationEligible.length > 0) {
      // Someone can escalate - set pending escalation
      newState.pendingEscalation = escalationEligible.includes('human') ? 'human' : escalationEligible[0];
      newState.currentPhase = 'war_resolve'; // Stay in war_resolve, UI will check pendingEscalation
      return newState;
    }
  }

  // Single winner, no escalation possible (or Squabble)
  return finalizeWarWinner(newState, bestPlayers[0].player.id);
}

/**
 * Finalize war winner and handle Squabble overtake
 */
function finalizeWarWinner(state: GameState, winnerId: string): GameState {
  const newState = cloneState(state);
  const war = newState.warState!;
  const winner = newState.players.find((p) => p.id === winnerId)!;

  // Build war type name (including compound types)
  let warTypeName = war.type.replace('_', ' ').toUpperCase();
  if (war.type === 'squabble' && war.matchType && war.matchType !== 'standard') {
    warTypeName = `${war.matchType.replace('_', ' ').toUpperCase()} SQUABBLE`;
  }

  // Calculate total pot size (sacrificed cards + flipped cards from all players)
  let totalPotSize = war.pot.length;
  // Count flipped cards from participants
  for (const pid of war.participants) {
    const player = newState.players.find((p) => p.id === pid);
    if (player?.flippedCard) totalPotSize++;
  }
  // Add non-participant card in squabble
  if (war.nonParticipantCard) totalPotSize++;

  // Handle Squabble overtake check
  if (war.type === 'squabble' && war.nonParticipantId && war.nonParticipantCard) {
    const winnerCard = winner.flippedCard;
    const highCard = war.nonParticipantCard;
    const highPlayer = newState.players.find((p) => p.id === war.nonParticipantId)!;

    if (winnerCard) {
      const comparison = compareCards(winnerCard, highCard);

      if (comparison > 0) {
        // Squabble winner beats the high card - takes everything
        newState.log.push(
          `${winner.name} wins the ${warTypeName} with ${getCardDisplay(winnerCard)} and OVERTAKES ${highPlayer.name}'s ${getCardDisplay(highCard)}!`
        );
        // Set war result
        newState.lastWarResult = {
          winnerId: winner.id,
          winnerName: winner.id === 'human' ? 'You' : winner.name,
          warType: warTypeName,
          winningCard: getCardDisplay(winnerCard),
          potSize: totalPotSize,
        };
      } else {
        // High card holder wins everything
        newState.log.push(
          `${winner.name} wins the Squabble but can't beat ${highPlayer.name}'s ${getCardDisplay(highCard)}. ${highPlayer.name} takes all!`
        );
        // Set war result for high player
        newState.lastWarResult = {
          winnerId: highPlayer.id,
          winnerName: highPlayer.id === 'human' ? 'You' : highPlayer.name,
          warType: warTypeName,
          winningCard: getCardDisplay(highCard),
          potSize: totalPotSize,
        };
        // Switch winner to high card holder
        return resolveTurn(newState, highPlayer.id);
      }
    }
  } else {
    newState.log.push(
      `${winner.name} wins the ${warTypeName}${winner.flippedCard ? ` with ${getCardDisplay(winner.flippedCard)}` : ''}!`
    );
    // Set war result
    newState.lastWarResult = {
      winnerId: winner.id,
      winnerName: winner.id === 'human' ? 'You' : winner.name,
      warType: warTypeName,
      winningCard: winner.flippedCard ? getCardDisplay(winner.flippedCard) : '',
      potSize: totalPotSize,
    };
  }

  return resolveTurn(newState, winnerId);
}

/**
 * Winner takes all cards in play and adds to bottom of their deck
 */
export function resolveTurn(state: GameState, winnerId: string): GameState {
  const newState = cloneState(state);
  const winner = newState.players.find((p) => p.id === winnerId)!;

  // Collect all cards in play
  const collectedCards: Card[] = [];

  // Add war pot if exists
  if (newState.warState) {
    collectedCards.push(...newState.warState.pot);

    // Track war win for endgame
    if (newState.isEndgame) {
      winner.warWins += 1;
      newState.log.push(`${winner.name} now has ${winner.warWins}/${ENDGAME_WARS_TO_WIN} war wins!`);
    }
  }

  // Add all flipped cards from all players
  for (const player of newState.players) {
    if (player.flippedCard) {
      collectedCards.push(player.flippedCard);
      player.flippedCard = null;
    }
  }

  // Add to bottom of winner's deck
  winner.deck.push(...collectedCards);

  if (!newState.warState) {
    // Normal turn win
    const cardCount = collectedCards.length;
    const otherCards = collectedCards.length > 1
      ? collectedCards.slice(1).map((c) => getCardDisplay(c)).join(' and ')
      : '';

    if (collectedCards.length > 0) {
      newState.log.push(
        `${winner.name} snags it with ${getCardDisplay(collectedCards[0])}${otherCards ? ` over ${otherCards}` : ''}.`
      );
    }
  }

  // Clear war state
  newState.warState = null;
  newState.pendingEscalation = null;
  newState.canUseReserve = [];

  // Check for eliminations and endgame
  return checkGameState(newState);
}

/**
 * Check for eliminations and game over conditions
 */
function checkGameState(state: GameState): GameState {
  const newState = cloneState(state);

  // Check for eliminations
  for (const player of newState.players) {
    if (!player.isEliminated && getPlayerCardCount(player) === 0) {
      player.isEliminated = true;
      newState.log.push(`💀 ${player.name} is OUT!`);
    }
  }

  const activePlayers = getActivePlayers(newState);

  // Check for game over
  if (activePlayers.length === 1) {
    newState.currentPhase = 'game_over';
    newState.winner = activePlayers[0].id;
    newState.log.push(`🏆 ${activePlayers[0].name} WINS THE GAME!`);
    return newState;
  }

  // Check for endgame trigger (2 players remaining)
  if (activePlayers.length === 2 && !newState.isEndgame) {
    newState.isEndgame = true;
    newState.log.push(`⚡ ENDGAME! Two players left. First to ${ENDGAME_WARS_TO_WIN} war wins takes it all!`);
  }

  // Check for endgame war win condition
  if (newState.isEndgame) {
    for (const player of activePlayers) {
      if (player.warWins >= ENDGAME_WARS_TO_WIN) {
        newState.currentPhase = 'game_over';
        newState.winner = player.id;
        newState.log.push(`🏆 ${player.name} reaches ${ENDGAME_WARS_TO_WIN} war wins and WINS THE GAME!`);
        return newState;
      }
    }
  }

  // Ready for next turn
  newState.currentPhase = 'flip';
  return newState;
}

/**
 * Deep clone game state
 */
function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      deck: [...p.deck],
      flippedCard: p.flippedCard ? { ...p.flippedCard } : null,
      reserveCard: p.reserveCard ? { ...p.reserveCard } : null,
    })),
    warState: state.warState
      ? {
          ...state.warState,
          participants: [...state.warState.participants],
          sacrificeCount: { ...state.warState.sacrificeCount },
          pot: [...state.warState.pot],
          originalCards: { ...state.warState.originalCards },
          warFlipCards: { ...state.warState.warFlipCards },
          matchType: state.warState.matchType,
        }
      : null,
    canUseReserve: [...state.canUseReserve],
    log: [...state.log],
  };
}

/**
 * Skip escalation and resolve normally
 */
export function skipEscalation(state: GameState): GameState {
  const newState = cloneState(state);
  const outcome = detectOutcome(state);

  if (outcome.winnerId) {
    return resolveTurn(newState, outcome.winnerId);
  }

  newState.currentPhase = 'flip';
  return newState;
}
