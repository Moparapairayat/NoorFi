import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WalletId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ExchangeReview'>;

const walletMetaMap: Record<WalletId, { unit: 'USD' | 'USDT' | 'SOL'; decimals: number }> = {
  usd: { unit: 'USD', decimals: 2 },
  usdt: { unit: 'USDT', decimals: 2 },
  sol: { unit: 'SOL', decimals: 4 },
};

function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatWalletAmount(walletId: WalletId, amount: number): string {
  const wallet = walletMetaMap[walletId];
  return `${wallet.unit} ${formatNumber(Math.max(amount, 0), wallet.decimals)}`;
}

function formatUsd(usd: number): string {
  return `USD ${formatNumber(Math.max(usd, 0), 2)}`;
}

export function ExchangeReviewScreen({ navigation, route }: Props) {
  const {
    fromWallet,
    toWallet,
    amountFrom,
    amountTo,
    usdValue,
    feeUsd,
    rate,
    slippagePct,
    note,
    quoteId,
  } = route.params;

  const fromUnit = walletMetaMap[fromWallet].unit;
  const toUnit = walletMetaMap[toWallet].unit;

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Review exchange</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <GlassCard style={styles.stepCard}>
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>Step 2 of 4</Text>
        </View>
        <Text style={styles.stepTitle}>Confirm quote details</Text>
        <Text style={styles.stepDesc}>
          Check pair, rate and expected output before PIN authorization.
        </Text>
      </GlassCard>

      <GlassCard style={styles.block}>
        <View style={styles.row}>
          <Text style={styles.key}>Trading pair</Text>
          <Text style={styles.val}>{fromUnit}/{toUnit}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Quote ID</Text>
          <Text style={styles.val}>{quoteId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Exchange ref</Text>
          <Text style={styles.val}>Generated after PIN authorization</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Rate</Text>
          <Text style={styles.val}>
            1 {fromUnit} = {formatNumber(rate, walletMetaMap[toWallet].decimals)} {toUnit}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Trade value</Text>
          <Text style={styles.val}>{formatUsd(usdValue)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Route fee</Text>
          <Text style={styles.val}>{formatUsd(feeUsd)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Slippage cap</Text>
          <Text style={styles.val}>{slippagePct.toFixed(1)}%</Text>
        </View>
        {note?.length ? (
          <View style={styles.row}>
            <Text style={styles.key}>Reference note</Text>
            <Text style={styles.val}>{note}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.key}>You send</Text>
          <Text style={styles.val}>{formatWalletAmount(fromWallet, amountFrom)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>You receive</Text>
          <Text style={styles.totalVal}>{formatWalletAmount(toWallet, amountTo)}</Text>
        </View>
      </GlassCard>

      <AppButton
        title="Continue to PIN"
        onPress={() =>
          navigation.navigate('ExchangeSecurity', {
            fromWallet,
            toWallet,
            amountFrom,
            amountTo,
            usdValue,
            feeUsd,
            rate,
            slippagePct,
            note,
            quoteId,
          })
        }
      />
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
  stepCard: {
    backgroundColor: '#EDF7F2',
    borderColor: '#CEE7DA',
    marginBottom: spacing.lg,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F1E8',
    borderColor: '#BFDCCB',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: spacing.md,
  },
  stepPillText: {
    color: '#1A6B4E',
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  stepTitle: {
    color: '#183B2E',
    fontFamily: typography.heading,
    fontSize: 20,
    marginTop: spacing.md,
  },
  stepDesc: {
    color: '#4C665B',
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: 3,
  },
  block: {
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowLast: {
    borderTopColor: '#E5ECE8',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  key: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 14,
  },
  val: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    maxWidth: '56%',
    textAlign: 'right',
  },
  totalKey: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  totalVal: {
    color: colors.primary,
    fontFamily: typography.display,
    fontSize: 24,
    letterSpacing: -0.2,
  },
});
