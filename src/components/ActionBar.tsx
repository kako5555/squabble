import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Player, getPlayerCardCount } from '../engine/state';
import { CardView } from './CardView';

interface ActionBarProps {
  player: Player;
  canFlip: boolean;
  canEscalate: boolean;
  canUseReserve: boolean;
  canFlipWar: boolean;
  onFlip: () => void;
  onEscalate: () => void;
  onSkipEscalate: () => void;
  onUseReserve: () => void;
  onSkipReserve: () => void;
  onFlipWar: () => void;
  isGameOver: boolean;
  onNewGame: () => void;
}

export function ActionBar({
  player,
  canFlip,
  canEscalate,
  canUseReserve,
  canFlipWar,
  onFlip,
  onEscalate,
  onSkipEscalate,
  onUseReserve,
  onSkipReserve,
  onFlipWar,
  isGameOver,
  onNewGame,
}: ActionBarProps) {
  const cardCount = getPlayerCardCount(player);

  return (
    <View style={styles.container}>
      {/* Top row: Player info and reserve card */}
      <View style={styles.topRow}>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.cardCount}>{cardCount} cards</Text>
        </View>

        {/* Show reserve card if available */}
        {!player.reserveUsed && player.reserveCard && (
          <View style={styles.reserveSection}>
            <Text style={styles.reserveLabel}>Reserve:</Text>
            <CardView card={player.reserveCard} size="small" />
          </View>
        )}
        {player.reserveUsed && (
          <Text style={styles.reserveUsedText}>Reserve Used</Text>
        )}
      </View>

      {/* Centered action buttons */}
      <View style={styles.buttonRow}>
        {isGameOver && (
          <TouchableOpacity style={styles.primaryButton} onPress={onNewGame}>
            <Text style={styles.buttonText}>NEW GAME</Text>
          </TouchableOpacity>
        )}

        {canFlip && (
          <TouchableOpacity style={styles.primaryButton} onPress={onFlip}>
            <Text style={styles.buttonText}>FLIP</Text>
          </TouchableOpacity>
        )}

        {canFlipWar && (
          <TouchableOpacity style={styles.warButton} onPress={onFlipWar}>
            <Text style={styles.buttonText}>FLIP WAR CARDS</Text>
          </TouchableOpacity>
        )}

        {canUseReserve && (
          <>
            <TouchableOpacity style={styles.swapButton} onPress={onUseReserve}>
              <Text style={styles.buttonText}>SWAP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keepButton} onPress={onSkipReserve}>
              <Text style={styles.keepButtonText}>KEEP</Text>
            </TouchableOpacity>
          </>
        )}

        {canEscalate && (
          <>
            <TouchableOpacity style={styles.escalateButton} onPress={onEscalate}>
              <Text style={styles.buttonText}>ESCALATE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.passButton} onPress={onSkipEscalate}>
              <Text style={styles.passButtonText}>PASS</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Hint text for special actions */}
      {canUseReserve && (
        <Text style={styles.hintText}>Swap your flipped card with your reserve?</Text>
      )}
      {canEscalate && (
        <Text style={styles.hintText}>Sacrifice 4 cards to challenge the winner!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerInfo: {
    flexDirection: 'column',
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  reserveSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reserveLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  reserveUsedText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  warButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  swapButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  keepButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  keepButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: 'bold',
  },
  escalateButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  passButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hintText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
});
