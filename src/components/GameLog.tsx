import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface GameLogProps {
  logs: string[];
}

export function GameLog({ logs }: GameLogProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs added
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [logs.length]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Game Log</Text>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {logs.map((log, index) => (
          <Text key={index} style={styles.logEntry}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    minHeight: 120,
  },
  header: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  logEntry: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 6,
    lineHeight: 20,
  },
});
