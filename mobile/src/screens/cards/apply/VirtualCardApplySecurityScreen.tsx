import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../../components/AppButton';
import { GlassCard } from '../../../components/GlassCard';
import { Screen } from '../../../components/Screen';
import { colors, radius, spacing, typography, pressStyles } from '../../../theme';
import { RootStackParamList } from '../../../types/navigation';
import { ApplyFlowHeader } from './components/ApplyFlowHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'VirtualCardApplySecurity'>;

const dailyLimitOptions = [200, 500, 1000, 2000];
const monthlyLimitOptions = [3000, 5000, 8000, 12000];

export function VirtualCardApplySecurityScreen({ navigation, route }: Props) {
  const [dailyLimit, setDailyLimit] = useState(500);
  const [monthlyLimit, setMonthlyLimit] = useState(5000);
  const [allowOnline, setAllowOnline] = useState(true);
  const [allowInternational, setAllowInternational] = useState(true);
  const allowAtm = false;

  const protectionScore = useMemo(() => {
    let score = 56;

    if (!allowInternational) score += 14;
    if (allowAtm === false) score += 10;
    if (dailyLimit <= 500) score += 10;
    if (monthlyLimit <= 5000) score += 7;
    if (!allowOnline) score += 9;

    return Math.max(45, Math.min(score, 96));
  }, [allowAtm, allowInternational, allowOnline, dailyLimit, monthlyLimit]);

  const scoreLabel =
    protectionScore >= 82 ? 'Strong' : protectionScore >= 68 ? 'Balanced' : 'Open';

  return (
    <Screen scroll>
      <ApplyFlowHeader
        onBack={() => navigation.goBack()}
        step={2}
        subtitle="Strowallet-aligned limits and controls"
        title="Security settings"
        totalSteps={4}
      />

      <GlassCard style={styles.scoreCard}>
        <View style={styles.scoreTop}>
          <View>
            <Text style={styles.scoreTitle}>Protection score</Text>
            <Text style={styles.scoreValue}>{protectionScore}/100</Text>
          </View>
          <View style={[styles.scorePill, protectionScore >= 82 ? styles.scorePillStrong : styles.scorePillBalanced]}>
            <Text
              style={[
                styles.scorePillText,
                protectionScore >= 82 ? styles.scorePillTextStrong : styles.scorePillTextBalanced,
              ]}
            >
              {scoreLabel}
            </Text>
          </View>
        </View>

        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${protectionScore}%` }]} />
        </View>

        <Text style={styles.scoreHint}>
          Higher score means stricter policy. Limit and card-state controls can be changed after issue.
        </Text>
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Daily spend limit (NoorFi policy)</Text>
        <View style={styles.limitRow}>
          {dailyLimitOptions.map((value) => {
            const selected = dailyLimit === value;
            const recommended = value === 500;

            return (
              <Pressable
                key={value}
                onPress={() => setDailyLimit(value)}
                style={({ pressed }) => [
                  styles.limitChip,
                  selected && styles.limitChipSelected,
                  pressed && styles.limitChipPressed,
                ]}
              >
                <Text style={[styles.limitChipText, selected && styles.limitChipTextSelected]}>${value}</Text>
                {recommended ? <Text style={styles.limitMeta}>Recommended</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Monthly limit (NoorFi policy)</Text>
        <View style={styles.limitRow}>
          {monthlyLimitOptions.map((value) => {
            const selected = monthlyLimit === value;
            const recommended = value === 5000;

            return (
              <Pressable
                key={value}
                onPress={() => setMonthlyLimit(value)}
                style={({ pressed }) => [
                  styles.limitChip,
                  selected && styles.limitChipSelected,
                  pressed && styles.limitChipPressed,
                ]}
              >
                <Text style={[styles.limitChipText, selected && styles.limitChipTextSelected]}>${value}</Text>
                {recommended ? <Text style={styles.limitMeta}>Recommended</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Transaction controls</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={styles.switchLabel}>Online payments</Text>
            <Text style={styles.switchHint}>Allow checkout on websites and apps</Text>
          </View>
          <Switch
            onValueChange={setAllowOnline}
            trackColor={{ false: '#C6D5CC', true: '#B7DCC8' }}
            thumbColor={allowOnline ? colors.primary : '#FFFFFF'}
            value={allowOnline}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={styles.switchLabel}>International use</Text>
            <Text style={styles.switchHint}>Allow transactions outside your current region</Text>
          </View>
          <Switch
            onValueChange={setAllowInternational}
            trackColor={{ false: '#C6D5CC', true: '#B7DCC8' }}
            thumbColor={allowInternational ? colors.primary : '#FFFFFF'}
            value={allowInternational}
          />
        </View>

        <View style={styles.switchRowLast}>
          <View style={styles.switchMeta}>
            <Text style={styles.switchLabel}>ATM withdrawals</Text>
            <Text style={styles.switchHint}>Locked off for Strowallet virtual USD cards</Text>
          </View>
          <View style={styles.lockedBadge}>
            <Ionicons color={colors.textSecondary} name="lock-closed-outline" size={13} />
            <Text style={styles.lockedBadgeText}>Locked off</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.providerCard}>
        <View style={styles.providerHeaderRow}>
          <Ionicons color={colors.primary} name="shield-checkmark-outline" size={16} />
          <Text style={styles.providerTitle}>Strowallet controls after issue</Text>
        </View>
        <View style={styles.providerItemRow}>
          <Ionicons color={colors.primaryDark} name="snow-outline" size={14} />
          <Text style={styles.providerItemText}>Freeze or unfreeze card instantly</Text>
        </View>
        <View style={styles.providerItemRow}>
          <Ionicons color={colors.primaryDark} name="trending-up-outline" size={14} />
          <Text style={styles.providerItemText}>Upgrade spend limits when needed</Text>
        </View>
        <View style={styles.providerItemRowLast}>
          <Ionicons color={colors.primaryDark} name="receipt-outline" size={14} />
          <Text style={styles.providerItemText}>Live provider transaction tracking</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.tipCard}>
        <Ionicons color={colors.primary} name="shield-checkmark-outline" size={16} />
        <Text style={styles.tipText}>
          Card number and CVV reveal will always require your transaction PIN.
        </Text>
      </GlassCard>

      <AppButton
        title="Review application"
        onPress={() =>
          navigation.navigate('VirtualCardApplyReview', {
            ...route.params,
            dailyLimit,
            monthlyLimit,
            allowOnline,
            allowInternational,
            allowAtm,
          })
        }
      />

      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreCard: {
    borderColor: '#CFE4D7',
    marginBottom: spacing.lg,
  },
  scoreTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  scoreTitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  scoreValue: {
    color: colors.textPrimary,
    fontFamily: typography.display,
    fontSize: 28,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  scorePill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 84,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  scorePillStrong: {
    backgroundColor: '#EAF9F1',
    borderColor: '#BEE8CF',
  },
  scorePillBalanced: {
    backgroundColor: '#F7F2E4',
    borderColor: '#E7D5AE',
  },
  scorePillText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    textAlign: 'center',
  },
  scorePillTextStrong: {
    color: colors.success,
  },
  scorePillTextBalanced: {
    color: '#8C6B2D',
  },
  scoreTrack: {
    backgroundColor: '#E1E9E4',
    borderRadius: radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  scoreFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
  },
  scoreHint: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  block: {
    marginBottom: spacing.lg,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  limitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  limitChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 78,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  limitChipSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  limitChipPressed: pressStyles.chip,
  limitChipText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  limitChipTextSelected: {
    color: colors.textPrimary,
  },
  limitMeta: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 10,
    marginTop: 2,
  },
  switchRow: {
    alignItems: 'center',
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  switchRowLast: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchMeta: {
    flex: 1,
    paddingRight: spacing.md,
  },
  switchLabel: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  switchHint: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  lockedBadge: {
    alignItems: 'center',
    backgroundColor: '#EFF3F1',
    borderColor: '#D9E3DE',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 10,
  },
  lockedBadgeText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  providerCard: {
    borderColor: '#CDE4D5',
    marginBottom: spacing.lg,
  },
  providerHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  providerTitle: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  providerItemRow: {
    alignItems: 'center',
    borderBottomColor: '#E4ECE7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
  },
  providerItemRowLast: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  providerItemText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  tipCard: {
    alignItems: 'center',
    backgroundColor: '#F5FAF7',
    borderColor: '#CFE5D7',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tipText: {
    color: colors.primaryDark,
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  footerSpace: {
    height: spacing.xl,
  },
});
