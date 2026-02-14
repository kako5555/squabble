import React, { useReducer, useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameState, initializeGame, getActivePlayers, getPlayer } from '../engine/state';
import { Card } from '../engine/cards';
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
  skipEscalation,
  declareWarEscalation,
  skipWarEscalation,
} from '../engine/turns';
import { shouldAIEscalate, shouldAIUseReserve } from '../engine/ai';
import { PlayerZone } from '../components/PlayerZone';
import { Battlefield } from '../components/Battlefield';
import { GameLog } from '../components/GameLog';
import { ActionBar } from '../components/ActionBar';

// Extended phases for slower gameplay
type UIPhase =
  | 'waiting_for_flip'      // User needs to tap FLIP
  | 'flipping_cards'        // Cards are being revealed one by one
  | 'showing_result'        // All cards shown, showing who won
  | 'reserve_decision'      // User can swap reserve
  | 'escalation_decision'   // User can escalate
  | 'war_escalation_decision' // User can escalate during war
  | 'war_setup'             // War declared, showing sacrifice counts
  | 'waiting_for_war_flip'  // User needs to tap FLIP WAR CARDS
  | 'war_flipping'          // War cards being revealed one by one
  | 'war_result'            // Showing war winner
  | 'game_over';

interface UIState {
  phase: UIPhase;
  revealedPlayers: string[]; // Which players' cards have been revealed
  revealedWarPlayers: string[]; // Which players' war flip cards have been revealed
  message: string;
  warResultInfo?: {
    winnerName: string;
    warType: string;
    winningCard: string;
    potSize: number;
    potCards?: import('../engine/cards').Card[]; // Captured pot cards to show after war
  };
}

type GameAction =
  | { type: 'FLIP' }
  | { type: 'REVEAL_NEXT_CARD' }
  | { type: 'USE_RESERVE'; playerId: string }
  | { type: 'ESCALATE'; playerId: string }
  | { type: 'SKIP_ESCALATE' }
  | { type: 'WAR_ESCALATE'; playerId: string }
  | { type: 'SKIP_WAR_ESCALATE' }
  | { type: 'PROCESS_OUTCOME' }
  | { type: 'INITIATE_WAR' }
  | { type: 'WAR_SACRIFICE' }
  | { type: 'WAR_FLIP' }
  | { type: 'WAR_RESOLVE' }
  | { type: 'CONTINUE_AFTER_RESULT' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_STATE'; state: GameState };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'FLIP':
      return flipCards(state);

    case 'USE_RESERVE':
      return useReserve(state, action.playerId);

    case 'ESCALATE':
      return declareEscalation(state, action.playerId);

    case 'SKIP_ESCALATE':
      return skipEscalation(state);

    case 'WAR_ESCALATE':
      return declareWarEscalation(state, action.playerId);

    case 'SKIP_WAR_ESCALATE':
      return skipWarEscalation(state);

    case 'PROCESS_OUTCOME': {
      const outcome = detectOutcome(state);

      if (outcome.type === 'win' && outcome.winnerId) {
        return resolveTurn(state, outcome.winnerId);
      }

      if (outcome.type === 'war' || outcome.type === 'squabble') {
        return initiateWar(state, outcome);
      }

      if (outcome.type === 'escalation_eligible') {
        const eligible = outcome.escalationEligible || [];
        const humanEligible = eligible.includes('human');

        if (humanEligible) {
          return {
            ...state,
            pendingEscalation: 'human',
          };
        }

        for (const playerId of eligible) {
          if (shouldAIEscalate(state, playerId)) {
            return declareEscalation(state, playerId);
          }
        }

        if (outcome.winnerId) {
          return resolveTurn(state, outcome.winnerId);
        }
      }

      return state;
    }

    case 'WAR_SACRIFICE':
      return executeWarSacrifice(state);

    case 'WAR_FLIP':
      return executeWarFlip(state);

    case 'WAR_RESOLVE':
      return resolveWar(state);

    case 'NEW_GAME':
      return initializeGame();

    case 'SET_STATE':
      return action.state;

    default:
      return state;
  }
}

export function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, null, initializeGame);
  const [uiState, setUIState] = useState<UIState>({
    phase: 'waiting_for_flip',
    revealedPlayers: [],
    revealedWarPlayers: [],
    message: 'Tap FLIP to start!',
  });

  // Ref to capture pot cards before war resolves
  const capturedPotRef = useRef<Card[]>([]);

  const humanPlayer = getPlayer(state, 'human')!;
  const aiPlayers = state.players.filter((p) => !p.isHuman);
  const activePlayers = getActivePlayers(state);

  // Sequential card reveal effect
  useEffect(() => {
    if (uiState.phase === 'flipping_cards') {
      const unrevealed = activePlayers.filter(
        (p) => !uiState.revealedPlayers.includes(p.id) && p.flippedCard
      );

      if (unrevealed.length > 0) {
        const timer = setTimeout(() => {
          const nextPlayer = unrevealed[0];
          setUIState((prev) => ({
            ...prev,
            revealedPlayers: [...prev.revealedPlayers, nextPlayer.id],
            message: `${nextPlayer.name} flips...`,
          }));
        }, 800);
        return () => clearTimeout(timer);
      } else {
        // All cards revealed, move to next phase
        const timer = setTimeout(() => {
          // Check if human can use reserve
          if (state.canUseReserve.includes('human')) {
            setUIState({
              phase: 'reserve_decision',
              revealedPlayers: uiState.revealedPlayers,
              revealedWarPlayers: [],
              message: 'You can swap your reserve card!',
            });
          } else {
            // Process AI reserve decisions then outcome
            processAIReserveAndOutcome();
          }
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [uiState.phase, uiState.revealedPlayers.length]);

  // Handle war phases
  useEffect(() => {
    if (uiState.phase === 'war_setup' && state.warState) {
      const humanInWar = state.warState.participants.includes('human');

      if (humanInWar) {
        // Human is participating - wait for them to tap FLIP WAR CARDS
        setUIState((prev) => ({
          ...prev,
          message: `${state.warState!.type.replace('_', ' ').toUpperCase()}! Tap to flip war cards.`,
        }));
      } else {
        // Human is NOT participating (watching a Squabble) - auto-proceed
        setUIState((prev) => ({
          ...prev,
          message: `${state.warState!.type.replace('_', ' ').toUpperCase()}! Watching the battle...`,
        }));

        // Auto-flip after a delay
        const timer = setTimeout(() => {
          dispatch({ type: 'WAR_SACRIFICE' });
          setTimeout(() => {
            dispatch({ type: 'WAR_FLIP' });
            setUIState({
              phase: 'war_flipping',
              revealedPlayers: [],
              revealedWarPlayers: [],
              message: 'War cards flipping...',
            });
          }, 800);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [uiState.phase, state.warState]);

  // Handle war card revealing one at a time
  useEffect(() => {
    if (uiState.phase === 'war_flipping' && state.warState) {
      const participants = state.warState.participants;
      const unrevealed = participants.filter(
        (pid) => !uiState.revealedWarPlayers.includes(pid) && state.warState?.warFlipCards[pid]
      );

      if (unrevealed.length > 0) {
        const timer = setTimeout(() => {
          const nextPlayer = unrevealed[0];
          const playerName = getPlayer(state, nextPlayer)?.name || nextPlayer;
          setUIState((prev) => ({
            ...prev,
            revealedWarPlayers: [...prev.revealedWarPlayers, nextPlayer],
            message: `${playerName} flips their war card...`,
          }));
        }, 800);
        return () => clearTimeout(timer);
      } else {
        // All war cards revealed - capture pot cards before resolving
        capturedPotRef.current = state.warState?.pot ? [...state.warState.pot] : [];

        const timer = setTimeout(() => {
          dispatch({ type: 'WAR_RESOLVE' });
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [uiState.phase, uiState.revealedWarPlayers.length, state.warState]);

  // Transition after war resolve - check for escalation or result
  useEffect(() => {
    if (uiState.phase === 'war_flipping' && state.lastWarResult && !state.warState) {
      // War was resolved and we have a result - use captured pot cards
      setUIState({
        phase: 'war_result',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: '',
        warResultInfo: {
          winnerName: state.lastWarResult.winnerName,
          warType: state.lastWarResult.warType,
          winningCard: state.lastWarResult.winningCard,
          potSize: state.lastWarResult.potSize,
          potCards: capturedPotRef.current,
        },
      });
    } else if (uiState.phase === 'war_flipping' && state.warState && state.pendingEscalation) {
      // Someone can escalate during war!
      if (state.pendingEscalation === 'human') {
        // Human can escalate
        const humanCard = humanPlayer.flippedCard;
        setUIState({
          phase: 'war_escalation_decision',
          revealedPlayers: [],
          revealedWarPlayers: state.warState.participants,
          message: humanCard ? `Your ${humanCard.display} is 1 below! ESCALATE?` : 'You can ESCALATE!',
        });
      } else {
        // AI decides
        if (shouldAIEscalate(state, state.pendingEscalation)) {
          const aiPlayer = getPlayer(state, state.pendingEscalation);
          dispatch({ type: 'WAR_ESCALATE', playerId: state.pendingEscalation });
          setUIState((prev) => ({
            ...prev,
            message: `${aiPlayer?.name} ESCALATES!`,
          }));
        } else {
          dispatch({ type: 'SKIP_WAR_ESCALATE' });
        }
      }
    } else if (uiState.phase === 'war_flipping' && state.warState && state.currentPhase === 'war_flip') {
      // War tied, need another round (double war)
      setUIState({
        phase: 'waiting_for_war_flip',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: 'DOUBLE WAR! Tap to flip again!',
      });
    } else if (uiState.phase === 'war_flipping' && state.warState && state.currentPhase === 'war_sacrifice') {
      // War escalation was declared, continue to sacrifice phase
      setUIState({
        phase: 'war_setup',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: 'War continues! Tap to flip war cards.',
      });
    }
  }, [uiState.phase, state.lastWarResult, state.warState, state.currentPhase, state.pendingEscalation]);

  // Handle war escalation decision result
  useEffect(() => {
    if (uiState.phase === 'war_escalation_decision' && state.lastWarResult && !state.warState) {
      // War was finalized after skipping escalation
      setUIState({
        phase: 'war_result',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: '',
        warResultInfo: {
          winnerName: state.lastWarResult.winnerName,
          warType: state.lastWarResult.warType,
          winningCard: state.lastWarResult.winningCard,
          potSize: state.lastWarResult.potSize,
          potCards: capturedPotRef.current,
        },
      });
    }
  }, [uiState.phase, state.lastWarResult, state.warState]);

  // Handle post-war - show result then continue
  useEffect(() => {
    if (uiState.phase === 'war_result') {
      const timer = setTimeout(() => {
        if (state.currentPhase === 'game_over') {
          setUIState({
            phase: 'game_over',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: state.winner === 'human' ? 'YOU WIN THE GAME!' : `${getPlayer(state, state.winner!)?.name} WINS THE GAME!`,
          });
        } else if (state.warState && state.currentPhase === 'war_flip') {
          // Another war round (tie) - need to flip again
          setUIState({
            phase: 'waiting_for_war_flip',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: 'Tie! Another war round... tap to flip!',
          });
        } else {
          setUIState({
            phase: 'waiting_for_flip',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: 'Next round - tap FLIP!',
          });
        }
      }, 3000); // Longer delay to show war result
      return () => clearTimeout(timer);
    }
  }, [uiState.phase, state.currentPhase, state.warState]);

  // Check for game over after normal turn
  useEffect(() => {
    if (uiState.phase === 'showing_result') {
      const timer = setTimeout(() => {
        if (state.currentPhase === 'game_over') {
          setUIState({
            phase: 'game_over',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: state.winner === 'human' ? 'YOU WIN!' : `${getPlayer(state, state.winner!)?.name} wins!`,
          });
        } else if (state.warState) {
          setUIState({
            phase: 'war_setup',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: 'WAR!',
          });
        } else {
          setUIState({
            phase: 'waiting_for_flip',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: 'Next round - tap FLIP!',
          });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [uiState.phase, state.currentPhase, state.warState]);

  const processAIReserveAndOutcome = useCallback(async () => {
    let currentState = state;

    // AI reserve decisions
    for (const playerId of currentState.canUseReserve) {
      const player = getPlayer(currentState, playerId);
      if (player && !player.isHuman && shouldAIUseReserve(currentState, playerId)) {
        currentState = useReserve(currentState, playerId);
        dispatch({ type: 'SET_STATE', state: currentState });
        setUIState((prev) => ({
          ...prev,
          message: `${player.name} uses their reserve!`,
        }));
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Now process outcome
    const outcome = detectOutcome(currentState);

    if (outcome.type === 'escalation_eligible' && outcome.escalationEligible?.includes('human')) {
      // Get card info for the message
      const humanCard = humanPlayer.flippedCard;
      const winnerPlayer = outcome.winnerId ? getPlayer(currentState, outcome.winnerId) : null;
      const winnerCard = winnerPlayer?.flippedCard;
      const humanCardName = humanCard ? `${humanCard.display}` : 'your card';
      const winnerCardName = winnerCard ? `${winnerCard.display}` : 'their card';

      setUIState({
        phase: 'escalation_decision',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: `ESCALATE? Your ${humanCardName} is 1 below ${winnerCardName}!`,
      });
    } else {
      // Check if AI will escalate so we can show who
      let aiEscalated: string | null = null;
      if (outcome.type === 'escalation_eligible') {
        for (const playerId of outcome.escalationEligible || []) {
          const player = getPlayer(currentState, playerId);
          if (player && !player.isHuman && shouldAIEscalate(currentState, playerId)) {
            aiEscalated = player.name;
            break;
          }
        }
      }

      dispatch({ type: 'PROCESS_OUTCOME' });

      setTimeout(() => {
        if (aiEscalated) {
          setUIState({
            phase: 'war_setup',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: `${aiEscalated} ESCALATES!`,
          });
        } else if (outcome.type === 'win' && outcome.winnerId) {
          const winner = getPlayer(currentState, outcome.winnerId);
          const winnerName = outcome.winnerId === 'human' ? 'You' : winner?.name;
          setUIState({
            phase: 'showing_result',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: `${winnerName} ${outcome.winnerId === 'human' ? 'win' : 'wins'} this round!`,
          });
        } else if (outcome.type === 'war' || outcome.type === 'squabble') {
          setUIState({
            phase: 'war_setup',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: outcome.type === 'squabble' ? 'SQUABBLE!' : 'WAR!',
          });
        } else {
          setUIState({
            phase: 'showing_result',
            revealedPlayers: [],
            revealedWarPlayers: [],
            message: 'Round complete!',
          });
        }
      }, 500);
    }
  }, [state]);

  const handleFlip = useCallback(() => {
    dispatch({ type: 'FLIP' });
    setUIState({
      phase: 'flipping_cards',
      revealedPlayers: [],
      revealedWarPlayers: [],
      message: 'Flipping cards...',
    });
  }, []);

  const handleUseReserve = useCallback(() => {
    dispatch({ type: 'USE_RESERVE', playerId: 'human' });
    setUIState((prev) => ({
      ...prev,
      message: 'You swapped your reserve!',
    }));
    setTimeout(() => processAIReserveAndOutcome(), 800);
  }, [processAIReserveAndOutcome]);

  const handleSkipReserve = useCallback(() => {
    processAIReserveAndOutcome();
  }, [processAIReserveAndOutcome]);

  const handleEscalate = useCallback(() => {
    dispatch({ type: 'ESCALATE', playerId: 'human' });
    setTimeout(() => {
      setUIState({
        phase: 'war_setup',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: 'YOU ESCALATE! Sacrificing 4 cards!',
      });
    }, 500);
  }, []);

  const handleSkipEscalate = useCallback(() => {
    dispatch({ type: 'SKIP_ESCALATE' });
    setUIState({
      phase: 'showing_result',
      revealedPlayers: [],
      revealedWarPlayers: [],
      message: 'Round complete!',
    });
  }, []);

  const handleWarEscalate = useCallback(() => {
    dispatch({ type: 'WAR_ESCALATE', playerId: 'human' });
    setTimeout(() => {
      setUIState({
        phase: 'war_setup',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: 'YOU ESCALATE! Sacrificing 4 more cards!',
      });
    }, 500);
  }, []);

  const handleSkipWarEscalate = useCallback(() => {
    dispatch({ type: 'SKIP_WAR_ESCALATE' });
    // After skipping, the war finalizes - wait for lastWarResult
  }, []);

  const handleFlipWar = useCallback(() => {
    dispatch({ type: 'WAR_SACRIFICE' });
    setTimeout(() => {
      dispatch({ type: 'WAR_FLIP' });
      setUIState({
        phase: 'war_flipping',
        revealedPlayers: [],
        revealedWarPlayers: [],
        message: 'Flipping war cards...',
      });
    }, 800);
  }, []);

  const handleNewGame = useCallback(() => {
    dispatch({ type: 'NEW_GAME' });
    setUIState({
      phase: 'waiting_for_flip',
      revealedPlayers: [],
      revealedWarPlayers: [],
      message: 'New game! Tap FLIP to start.',
    });
  }, []);

  // Determine button visibility
  const canFlip = uiState.phase === 'waiting_for_flip' && !humanPlayer.isEliminated;
  const canUseReserve = uiState.phase === 'reserve_decision';
  const canEscalate = uiState.phase === 'escalation_decision' || uiState.phase === 'war_escalation_decision';
  const humanInWar = state.warState?.participants.includes('human') ?? false;
  const canFlipWar = (uiState.phase === 'war_setup' || uiState.phase === 'waiting_for_war_flip') && humanInWar;
  const isGameOver = uiState.phase === 'game_over';
  const showWarResult = uiState.phase === 'war_result' && uiState.warResultInfo;
  const isWarEscalation = uiState.phase === 'war_escalation_decision';

  // Filter cards to show based on reveal state
  const getDisplayPlayers = () => {
    if (uiState.phase === 'flipping_cards') {
      return state.players.map((p) => ({
        ...p,
        flippedCard: uiState.revealedPlayers.includes(p.id) ? p.flippedCard : null,
      }));
    }
    return state.players;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* AI Players Zone */}
      <View style={styles.aiZone}>
        {aiPlayers.map((player) => (
          <PlayerZone key={player.id} player={player} />
        ))}
      </View>

      {/* Status Message */}
      <View style={styles.messageZone}>
        <Text style={styles.messageText}>{uiState.message}</Text>
      </View>

      {/* Battlefield */}
      <View style={styles.battlefield}>
        <Battlefield
          players={getDisplayPlayers()}
          warState={state.warState}
          showSacrificeInfo={uiState.phase === 'war_setup' || uiState.phase === 'waiting_for_war_flip'}
          revealedWarPlayers={uiState.revealedWarPlayers}
          isFlippingPhase={uiState.phase === 'war_flipping'}
          revealedPotCards={uiState.phase === 'war_result' ? uiState.warResultInfo?.potCards : undefined}
        />

        {/* War Result Banner */}
        {showWarResult && uiState.warResultInfo && (
          <View style={styles.warResultBanner}>
            <Text style={styles.warResultTitle}>
              {uiState.warResultInfo.winnerName} wins {uiState.warResultInfo.warType}!
            </Text>
            {uiState.warResultInfo.winningCard && (
              <Text style={styles.warResultCard}>
                with {uiState.warResultInfo.winningCard}
              </Text>
            )}
            <Text style={styles.warResultPot}>
              +{uiState.warResultInfo.potSize} cards won
            </Text>
          </View>
        )}
      </View>

      {/* Game Log */}
      <View style={styles.logZone}>
        <GameLog logs={state.log} />
      </View>

      {/* Human Player Action Bar */}
      <ActionBar
        player={humanPlayer}
        canFlip={canFlip}
        canEscalate={canEscalate}
        canUseReserve={canUseReserve}
        canFlipWar={canFlipWar}
        onFlip={handleFlip}
        onEscalate={isWarEscalation ? handleWarEscalate : handleEscalate}
        onSkipEscalate={isWarEscalation ? handleSkipWarEscalate : handleSkipEscalate}
        onUseReserve={handleUseReserve}
        onSkipReserve={handleSkipReserve}
        onFlipWar={handleFlipWar}
        isGameOver={isGameOver}
        onNewGame={handleNewGame}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  aiZone: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#f3f4f6',
  },
  messageZone: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  battlefield: {
    flex: 1,
    justifyContent: 'center',
  },
  logZone: {
    padding: 12,
  },
  warResultBanner: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warResultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  warResultCard: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 8,
  },
  warResultPot: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
});
