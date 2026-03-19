import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing, typography, pressStyles } from '../../../../theme';

type ApplyFlowHeaderProps = {
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  onBack?: () => void;
};

export function ApplyFlowHeader({
  title,
  subtitle,
  step,
  totalSteps,
  onBack,
}: ApplyFlowHeaderProps) {
  const safeStep = Math.max(1, Math.min(step, totalSteps));
  const progress = (safeStep / totalSteps) * 100;
  const segments = Array.from({ length: totalSteps }, (_, index) => index + 1);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#113A2E', '#1B5B44', '#257357']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.headPanel}
      >
        <View style={styles.patternOne} />
        <View style={styles.patternTwo} />
        <View style={styles.headRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
              <Ionicons color="#F2E5C4" name="chevron-back" size={20} />
            </Pressable>
          ) : (
            <View style={styles.iconPlaceholder} />
          )}

          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {safeStep}/{totalSteps}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.segmentRow}>
        {segments.map((item) => (
          <View
            key={item}
            style={[styles.segment, item <= safeStep ? styles.segmentActive : styles.segmentIdle]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  headPanel: {
    borderColor: '#2F7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.md,
    position: 'relative',
  },
  patternOne: {
    backgroundColor: 'rgba(237, 220, 183, 0.16)',
    borderRadius: radius.pill,
    height: 94,
    position: 'absolute',
    right: -20,
    top: -22,
    width: 94,
  },
  patternTwo: {
    borderColor: 'rgba(237, 220, 183, 0.23)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 58,
    position: 'absolute',
    right: 8,
    top: 6,
    width: 46,
  },
  headRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(232, 242, 235, 0.2)',
    borderColor: 'rgba(212, 180, 106, 0.28)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconBtnPressed: pressStyles.icon,
  iconPlaceholder: {
    width: 38,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: '#F5FBF8',
    fontFamily: typography.heading,
    fontSize: 19,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: 'rgba(229, 238, 232, 0.86)',
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 1,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(238, 222, 188, 0.2)',
    borderColor: 'rgba(238, 222, 188, 0.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 54,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepBadgeText: {
    color: '#F1E3C0',
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  track: {
    backgroundColor: '#DFE8E2',
    borderRadius: radius.pill,
    height: 6,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  segment: {
    borderRadius: radius.pill,
    flex: 1,
    height: 4,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentIdle: {
    backgroundColor: '#CEDAD2',
  },
});
