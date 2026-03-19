import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, shadows, spacing, typography } from '../theme';

export function MoneyCard() {
  return (
    <LinearGradient
      colors={['#151A25', '#151F35', '#1B3142']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>Available Balance</Text>
      <Text style={styles.amount}>$12,480.32</Text>
      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.metaLabel}>Main Wallet</Text>
          <Text style={styles.metaValue}>USD Account</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Tier 2</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.heavy,
  },
  label: {
    color: 'rgba(244,247,255,0.74)',
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  amount: {
    color: '#FAFCFF',
    fontFamily: typography.display,
    fontSize: 34,
    letterSpacing: -0.5,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaLabel: {
    color: 'rgba(244,247,255,0.65)',
    fontFamily: typography.body,
    fontSize: 12,
  },
  metaValue: {
    color: '#FAFCFF',
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(30, 207, 157, 0.2)',
    borderColor: 'rgba(30, 207, 157, 0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#7FF6CE',
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
});
