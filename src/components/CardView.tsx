import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, isRedSuit, getSuitSymbol } from '../engine/cards';
import { RANK_SYMBOLS } from '../utils/constants';

interface CardViewProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function CardView({ card, faceDown = false, size = 'medium' }: CardViewProps) {
  const sizeStyles = SIZE_STYLES[size];

  if (faceDown || !card) {
    return (
      <View style={[styles.card, styles.faceDown, sizeStyles.card]}>
        <Text style={[styles.backText, sizeStyles.text]}>?</Text>
      </View>
    );
  }

  const isRed = isRedSuit(card);
  const textColor = isRed ? '#dc2626' : '#1f2937';
  const rankSymbol = RANK_SYMBOLS[card.rank];
  const suitSymbol = getSuitSymbol(card.suit);

  return (
    <View style={[styles.card, styles.faceUp, sizeStyles.card]}>
      <Text style={[styles.cardText, sizeStyles.text, { color: textColor }]}>
        {rankSymbol}
      </Text>
      <Text style={[styles.suitText, sizeStyles.suit, { color: textColor }]}>
        {suitSymbol}
      </Text>
    </View>
  );
}

const SIZE_STYLES = {
  small: StyleSheet.create({
    card: { width: 50, height: 70 },
    text: { fontSize: 18 },
    suit: { fontSize: 20 },
  }),
  medium: StyleSheet.create({
    card: { width: 70, height: 100 },
    text: { fontSize: 24 },
    suit: { fontSize: 28 },
  }),
  large: StyleSheet.create({
    card: { width: 90, height: 130 },
    text: { fontSize: 32 },
    suit: { fontSize: 36 },
  }),
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  faceUp: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  faceDown: {
    backgroundColor: '#4b5563',
    borderColor: '#374151',
  },
  cardText: {
    fontWeight: 'bold',
  },
  suitText: {
    marginTop: 2,
  },
  backText: {
    color: '#9ca3af',
    fontWeight: 'bold',
  },
});
