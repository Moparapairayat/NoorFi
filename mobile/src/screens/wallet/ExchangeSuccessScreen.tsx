import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WalletId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ExchangeSuccess'>;

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

export function ExchangeSuccessScreen({ navigation, route }: Props) {
  const {
    fromWallet,
    toWallet,
    amountFrom,
    amountTo,
    feeUsd,
    rate,
    slippagePct,
    note,
    quoteId,
    exchangeRef,
    completedAt,
  } = route.params;

  const fromUnit = walletMetaMap[fromWallet].unit;
  const toUnit = walletMetaMap[toWallet].unit;

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="close" size={20} />
        </Pressable>
        <Text style={styles.title}>Exchange completed</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#10392D', '#195A43', '#257356']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.successIconWrap}>
          <Ionicons color="#EED8A7" name="checkmark" size={18} />
        </View>
        <Text style={styles.heroTitle}>Conversion successful</Text>
        <Text style={styles.heroSubtitle}>
          Funds were exchanged and credited to your destination wallet.
        </Text>
      </LinearGradient>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Pair</Text>
          <Text style={styles.val}>{fromUnit}/{toUnit}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Quote ID</Text>
          <Text style={styles.val}>{quoteId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Exchange ref</Text>
          <Text style={styles.val}>{exchangeRef}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Completed at</Text>
          <Text style={styles.val}>{completedAt}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Rate</Text>
          <Text style={styles.val}>
            1 {fromUnit} = {formatNumber(rate, walletMetaMap[toWallet].decimals)} {toUnit}
          </Text>
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
          <Text style={styles.key}>You sent</Text>
          <Text style={styles.val}>{formatWalletAmount(fromWallet, amountFrom)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Route fee</Text>
          <Text style={styles.val}>{formatUsd(feeUsd)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>You received</Text>
          <Text style={styles.totalVal}>{formatWalletAmount(toWallet, amountTo)}</Text>
        </View>
      </GlassCard>

      <AppButton title="Go to home" onPress={() => navigation.navigate('MainTabs')} />
      <AppButton
        title="View activity"
        variant="ghost"
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate('Activity')}
      />
      <AppButton
        title="Exchange again"
        variant="ghost"
        style={styles.secondaryBtn}
        onPress={() => navigation.replace('Exchange')}
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
  heroCard: {
    alignItems: 'center',
    borderColor: '#2E7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  successIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 47, 36, 0.44)',
    borderColor: 'rgba(238, 216, 167, 0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  summaryCard: {
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
    fontSize: 13,
    maxWidth: '58%',
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
    fontSize: 22,
  },
  secondaryBtn: {
    marginTop: spacing.md,
  },
});
