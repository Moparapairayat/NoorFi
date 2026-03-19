import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { WalletSelector } from '../../components/WalletSelector';
import { useWallet } from '../../context/WalletContext';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'FeesLimits'>;

export function FeesLimitsScreen({ navigation }: Props) {
  const { selectedWallet, formatFromUsd } = useWallet();

  const limits = useMemo(() => {
    if (selectedWallet === 'sol') {
      return { daily: 19_500, monthly: 120_000, minWithdraw: 15 };
    }

    return { daily: 25_000, monthly: 180_000, minWithdraw: 10 };
  }, [selectedWallet]);

  const feeRows = useMemo(
    () => [
      { label: 'Top up', value: formatFromUsd(0.3) },
      { label: 'Send transfer', value: formatFromUsd(0.15) },
      { label: 'Withdraw', value: formatFromUsd(0.65) },
      { label: 'Exchange', value: '0.25%' },
    ],
    [formatFromUsd]
  );

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Fees & limits</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <WalletSelector style={styles.walletSelector} />

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Current limits</Text>

        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Daily outgoing cap</Text>
          <Text style={styles.limitValue}>{formatFromUsd(limits.daily)}</Text>
        </View>
        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Monthly outgoing cap</Text>
          <Text style={styles.limitValue}>{formatFromUsd(limits.monthly)}</Text>
        </View>
        <View style={styles.limitRowLast}>
          <Text style={styles.limitLabel}>Minimum withdraw</Text>
          <Text style={styles.limitValue}>{formatFromUsd(limits.minWithdraw)}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Fee schedule</Text>

        {feeRows.map((row, index) => (
          <View key={row.label} style={[styles.feeRow, index === feeRows.length - 1 && styles.feeRowLast]}>
            <Text style={styles.feeLabel}>{row.label}</Text>
            <Text style={styles.feeValue}>{row.value}</Text>
          </View>
        ))}
      </GlassCard>

      <AppButton title="Upgrade limits via KYC" onPress={() => navigation.navigate('Kyc')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
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
  title: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 18,
  },
  walletSelector: {
    marginBottom: spacing.lg,
  },
  card: {
    borderColor: '#D5E2DA',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  limitRow: {
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  limitRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  limitLabel: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 14,
  },
  limitValue: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  feeRow: {
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  feeRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  feeLabel: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 14,
  },
  feeValue: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});
