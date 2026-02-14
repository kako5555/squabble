import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WarType, WAR_SACRIFICE_COUNTS } from '../utils/constants';

interface WarBannerProps {
  warType: WarType;
  matchType?: WarType; // For compound types like "Bitch Fight Squabble"
  visible: boolean;
}

const WAR_DISPLAY: Record<WarType, { name: string; emoji: string; color: string }> = {
  standard: { name: 'WAR', emoji: '', color: '#dc2626' },
  nuke: { name: 'NUKE', emoji: '\u2622\uFE0F', color: '#f59e0b' },
  bitch_fight: { name: 'BITCH FIGHT', emoji: '\uD83D\uDC51', color: '#ec4899' },
  kerfuffle: { name: 'KERFUFFLE', emoji: '\uD83D\uDDE1\uFE0F', color: '#8b5cf6' },
  jack_off: { name: 'JACK OFF', emoji: '\uD83C\uDCCB', color: '#3b82f6' },
  squabble: { name: 'SQUABBLE', emoji: '\u2694\uFE0F', color: '#10b981' },
  escalation: { name: 'ESCALATION', emoji: '\uD83D\uDCC8', color: '#f97316' },
};

export function WarBanner({ warType, matchType, visible }: WarBannerProps) {
  if (!visible) return null;

  // Handle compound types (e.g., Bitch Fight Squabble)
  const isCompound = warType === 'squabble' && matchType && matchType !== 'standard';

  let displayName: string;
  let displayEmoji: string;
  let displayColor: string;
  let sacrificeCount: number;

  if (isCompound && matchType) {
    const matchDisplay = WAR_DISPLAY[matchType];
    const squabbleDisplay = WAR_DISPLAY.squabble;
    displayName = `${matchDisplay.name} ${squabbleDisplay.name}`;
    displayEmoji = `${matchDisplay.emoji}${squabbleDisplay.emoji}`;
    displayColor = matchDisplay.color; // Use the match type's color
    sacrificeCount = WAR_SACRIFICE_COUNTS[matchType];
  } else {
    const display = WAR_DISPLAY[warType];
    displayName = display.name;
    displayEmoji = display.emoji;
    displayColor = display.color;
    sacrificeCount = WAR_SACRIFICE_COUNTS[warType];
  }

  const isKerfuffle = warType === 'kerfuffle' || matchType === 'kerfuffle';

  return (
    <View style={[styles.container, { backgroundColor: displayColor }]}>
      <Text style={styles.emoji}>{displayEmoji}</Text>
      <Text style={styles.title}>{displayName}!</Text>
      <Text style={styles.subtitle}>
        {isKerfuffle ? 'Lowest wins!' : `${sacrificeCount} cards sacrificed`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 4,
  },
});
