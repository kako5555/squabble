import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Player, getPlayerCardCount } from '../engine/state';

interface PlayerZoneProps {
  player: Player;
  isCurrentTurn?: boolean;
}

export function PlayerZone({ player, isCurrentTurn = false }: PlayerZoneProps) {
  const cardCount = getPlayerCardCount(player);

  return (
    <View style={[styles.container, isCurrentTurn && styles.currentTurn]}>
      <Text style={styles.name}>{player.name}</Text>
      <Text style={styles.cardCount}>{cardCount} cards</Text>
      <View style={styles.indicators}>
        <View
          style={[
            styles.reserveIndicator,
            player.reserveUsed ? styles.reserveUsed : styles.reserveAvailable,
          ]}
        />
        {player.isEliminated && <Text style={styles.eliminated}>OUT</Text>}
      </View>
      {player.warWins > 0 && (
        <Text style={styles.warWins}>Wars: {player.warWins}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  currentTurn: {
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardCount: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  reserveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  reserveAvailable: {
    backgroundColor: '#22c55e',
  },
  reserveUsed: {
    backgroundColor: '#9ca3af',
  },
  eliminated: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  warWins: {
    fontSize: 12,
    color: '#7c3aed',
    marginTop: 4,
    fontWeight: '600',
  },
});
