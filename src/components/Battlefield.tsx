import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CardView } from './CardView';
import { WarBanner } from './WarBanner';
import { Player, WarState } from '../engine/state';
import { Card } from '../engine/cards';

interface BattlefieldProps {
  players: Player[];
  warState: WarState | null;
  showSacrificeInfo?: boolean;
  revealedWarPlayers?: string[];
  isFlippingPhase?: boolean;
  revealedPotCards?: Card[]; // Show these cards face-up after war ends
}

// Render sacrifice cards in a horizontal line
function SacrificeLine({ count }: { count: number }) {
  const displayCount = Math.min(count, 10);
  const cards = Array.from({ length: displayCount }, (_, i) => i);

  return (
    <View style={styles.sacrificeLine}>
      {cards.map((i) => (
        <View key={i} style={styles.sacrificeCard}>
          <Text style={styles.sacrificeCardText}>?</Text>
        </View>
      ))}
      {count > 10 && <Text style={styles.moreCards}>+{count - 10}</Text>}
    </View>
  );
}

// Single player's card area
function PlayerCardArea({
  player,
  warState,
  showSacrificeInfo,
  position,
  revealedWarPlayers,
  isFlippingPhase,
}: {
  player: Player;
  warState: WarState | null;
  showSacrificeInfo: boolean;
  position: 'top' | 'bottom';
  revealedWarPlayers?: string[];
  isFlippingPhase?: boolean;
}) {
  const isParticipant = warState?.participants.includes(player.id);
  const sacrificeCount = warState?.sacrificeCount[player.id];
  const originalCard = warState?.originalCards?.[player.id];
  const warFlipCard = warState?.warFlipCards?.[player.id];
  // Only show war flip card face-up if it's been revealed
  const isRevealed = !revealedWarPlayers || revealedWarPlayers.includes(player.id);
  const hasWarFlipCard = warState && isParticipant && warFlipCard;
  const showWarFlipFaceUp = hasWarFlipCard && isRevealed;
  const showWarFlipFaceDown = hasWarFlipCard && !isRevealed;

  return (
    <View style={[styles.playerArea, position === 'top' ? styles.topArea : styles.bottomArea]}>
      <Text style={styles.playerName}>{player.name}</Text>

      <View style={styles.cardsContainer}>
        {/* Show original card if in war (smaller) */}
        {warState && isParticipant && originalCard && (
          <View style={styles.originalCardWrapper}>
            <CardView card={originalCard} size="small" />
            <Text style={styles.cardLabel}>Original</Text>
          </View>
        )}

        {/* Sacrifice cards - keep visible during war setup AND during flipping */}
        {warState && isParticipant && sacrificeCount !== undefined && (showSacrificeInfo || isFlippingPhase) && (
          <View style={styles.sacrificeSection}>
            <SacrificeLine count={sacrificeCount} />
          </View>
        )}

        {/* War flip card revealed (larger) */}
        {showWarFlipFaceUp && (
          <View style={styles.warCardWrapper}>
            <CardView card={warFlipCard} size="large" />
            <Text style={styles.warCardLabel}>WAR FLIP</Text>
          </View>
        )}

        {/* War flip card face-down (not yet revealed OR waiting to be drawn) */}
        {(showWarFlipFaceDown || (warState && showSacrificeInfo && isParticipant && !hasWarFlipCard)) && (
          <View style={styles.warCardWrapper}>
            <View style={styles.faceDownCard}>
              <Text style={styles.faceDownText}>?</Text>
            </View>
            <Text style={styles.warCardLabel}>WAR FLIP</Text>
          </View>
        )}

        {/* Normal flipped card when not in war */}
        {!warState && player.flippedCard && (
          <View style={styles.mainCardWrapper}>
            <CardView card={player.flippedCard} size="medium" />
          </View>
        )}
      </View>
    </View>
  );
}

export function Battlefield({ players, warState, showSacrificeInfo = false, revealedWarPlayers, isFlippingPhase = false, revealedPotCards }: BattlefieldProps) {
  const activePlayers = players.filter((p) => !p.isEliminated);
  const humanPlayer = activePlayers.find((p) => p.isHuman);
  const aiPlayers = activePlayers.filter((p) => !p.isHuman);

  return (
    <View style={styles.container}>
      {/* AI Players at top */}
      <View style={styles.topSection}>
        {aiPlayers.map((player) => (
          <PlayerCardArea
            key={player.id}
            player={player}
            warState={warState}
            showSacrificeInfo={showSacrificeInfo}
            position="top"
            revealedWarPlayers={revealedWarPlayers}
            isFlippingPhase={isFlippingPhase}
          />
        ))}
      </View>

      {/* War banner in middle */}
      <View style={styles.middleSection}>
        {warState && (
          <WarBanner warType={warState.type} matchType={warState.matchType} visible={true} />
        )}

        {warState && warState.pot.length > 0 && (
          <View style={styles.potInfo}>
            <Text style={styles.potText}>
              Pot: {warState.pot.length} cards
            </Text>
            {warState.round > 1 && (
              <Text style={styles.roundText}>Round {warState.round}</Text>
            )}
          </View>
        )}

        {/* Squabble info */}
        {warState && warState.type === 'squabble' && warState.nonParticipantId && (
          <View style={styles.watchingInfo}>
            <Text style={styles.watchingText}>
              {players.find(p => p.id === warState.nonParticipantId)?.name} watches with high card
            </Text>
          </View>
        )}

        {/* Revealed pot cards after war ends */}
        {revealedPotCards && revealedPotCards.length > 0 && (
          <View style={styles.revealedPotSection}>
            <Text style={styles.revealedPotTitle}>Cards Won:</Text>
            <View style={styles.revealedPotCards}>
              {revealedPotCards.slice(0, 12).map((card, index) => (
                <View key={index} style={styles.revealedPotCardWrapper}>
                  <CardView card={card} size="small" />
                </View>
              ))}
              {revealedPotCards.length > 12 && (
                <Text style={styles.moreCardsText}>+{revealedPotCards.length - 12} more</Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Human player at bottom */}
      {humanPlayer && (
        <View style={styles.bottomSection}>
          <PlayerCardArea
            player={humanPlayer}
            warState={warState}
            showSacrificeInfo={showSacrificeInfo}
            position="bottom"
            revealedWarPlayers={revealedWarPlayers}
            isFlippingPhase={isFlippingPhase}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 8,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  middleSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  bottomSection: {
    alignItems: 'center',
  },
  playerArea: {
    alignItems: 'center',
    padding: 8,
  },
  topArea: {},
  bottomArea: {},
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  cardsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  mainCardWrapper: {
    alignItems: 'center',
  },
  originalCardWrapper: {
    alignItems: 'center',
    opacity: 0.7,
  },
  warCardWrapper: {
    alignItems: 'center',
  },
  faceDownCard: {
    width: 70,
    height: 100,
    backgroundColor: '#1f2937',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceDownText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  cardLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  warCardLabel: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: 'bold',
    marginTop: 2,
  },
  sacrificeSection: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sacrificeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sacrificeCard: {
    width: 20,
    height: 28,
    backgroundColor: '#4b5563',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sacrificeCardText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 'bold',
  },
  moreCards: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 4,
  },
  potInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  potText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  roundText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  watchingInfo: {
    marginTop: 8,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  watchingText: {
    fontSize: 11,
    color: '#1e40af',
    fontStyle: 'italic',
  },
  revealedPotSection: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  revealedPotTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  revealedPotCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    maxWidth: 300,
  },
  revealedPotCardWrapper: {
    margin: 2,
  },
  moreCardsText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
    alignSelf: 'center',
    marginLeft: 8,
  },
});
