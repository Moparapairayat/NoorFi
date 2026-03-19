import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { WalletSelector } from '../../components/WalletSelector';
import { useWallet } from '../../context/WalletContext';
import { ApiError, quoteExchange } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WalletId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Exchange'>;

type WalletMeta = {
  unit: 'USD' | 'USDT' | 'SOL';
  title: string;
  decimals: number;
  usdRate: number;
};

const walletMetaMap: Record<WalletId, WalletMeta> = {
  usd: {
    unit: 'USD',
    title: 'USD Wallet',
    decimals: 2,
    usdRate: 1,
  },
  usdt: {
    unit: 'USDT',
    title: 'USDT Wallet',
    decimals: 2,
    usdRate: 1,
  },
  sol: {
    unit: 'SOL',
    title: 'SOL Wallet',
    decimals: 4,
    usdRate: 170,
  },
};

const quickUsdAmounts = [20, 50, 100, 250];

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

export function ExchangeScreen({ navigation, route }: Props) {
  const { selectedWallet, setSelectedWallet, wallets } = useWallet();
  const [toWallet, setToWallet] = useState<WalletId>(selectedWallet === 'usd' ? 'usdt' : 'usd');
  const [amountInput, setAmountInput] = useState(
    route.params?.presetAmount ? String(route.params.presetAmount) : ''
  );
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromWallet = selectedWallet;
  const fromMeta = walletMetaMap[fromWallet];
  const toMeta = walletMetaMap[toWallet];

  useEffect(() => {
    if (toWallet === fromWallet) {
      const fallback = fromWallet === 'usd' ? 'usdt' : 'usd';
      setToWallet(fallback);
    }
  }, [fromWallet, toWallet]);

  const amountFrom = useMemo(() => {
    const parsed = Number(amountInput);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [amountInput]);

  const usdValue = amountFrom * fromMeta.usdRate;
  const feeUsd = useMemo(() => {
    const percentFee = usdValue * 0.0025;
    const pairFloor = fromWallet === 'sol' || toWallet === 'sol' ? 0.42 : 0.2;
    return Math.max(pairFloor, percentFee);
  }, [fromWallet, toWallet, usdValue]);
  const amountTo = Math.max(usdValue - feeUsd, 0) / toMeta.usdRate;
  const rate = fromMeta.usdRate / toMeta.usdRate;
  const slippagePct = 0.5;
  const minUsd = 10;
  const minFrom = minUsd / fromMeta.usdRate;

  const quoteId = useMemo(() => `QX-${Date.now().toString().slice(-8)}`, []);
  const canContinue = amountFrom >= minFrom && fromWallet !== toWallet && !loading;

  const targetWallets = useMemo(
    () => wallets.filter((wallet) => wallet.id !== fromWallet),
    [wallets, fromWallet]
  );

  const quickAmountValues = useMemo(
    () =>
      quickUsdAmounts.map((usdAmount) => {
        const converted = usdAmount / fromMeta.usdRate;
        return Number(converted.toFixed(fromMeta.decimals));
      }),
    [fromMeta]
  );

  const onSwapWallets = () => {
    const currentFrom = fromWallet;
    setSelectedWallet(toWallet);
    setToWallet(currentFrom);
  };

  const onContinue = async () => {
    if (!canContinue) {
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await quoteExchange({
        from_currency: fromWallet,
        to_currency: toWallet,
        amount_from: amountFrom,
      });

      navigation.navigate('ExchangeReview', {
        fromWallet,
        toWallet,
        amountFrom: response.amount_from,
        amountTo: response.amount_to,
        usdValue,
        feeUsd: response.fee,
        rate: response.rate,
        slippagePct,
        note: note.trim(),
        quoteId: response.quote_id,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Unable to fetch exchange quote.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Exchange wallets</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <WalletSelector style={styles.walletSelector} />

      <LinearGradient
        colors={['#10392D', '#195A43', '#257356']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Text style={styles.heroOverline}>Exchange workflow</Text>
        <Text style={styles.heroTitle}>Step 1 of 4</Text>
        <Text style={styles.heroSubtitle}>
          Select output wallet and get a live quote before confirmation.
        </Text>
      </LinearGradient>

      <GlassCard>
        <Text style={styles.sectionTitle}>Convert to</Text>
        <View style={styles.targetRow}>
          {targetWallets.map((wallet) => {
            const selected = wallet.id === toWallet;
            return (
              <Pressable
                key={wallet.id}
                onPress={() => setToWallet(wallet.id)}
                style={({ pressed }) => [
                  styles.targetChip,
                  selected && styles.targetChipSelected,
                  pressed && styles.targetChipPressed,
                ]}
              >
                <Text style={[styles.targetChipText, selected && styles.targetChipTextSelected]}>
                  {wallet.shortLabel}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onSwapWallets}
            style={({ pressed }) => [styles.swapBtn, pressed && styles.swapBtnPressed]}
          >
            <Ionicons color="#1A6B4E" name="swap-vertical" size={14} />
          </Pressable>
        </View>
      </GlassCard>

      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Exchange details</Text>
        <Text style={styles.fromWalletMeta}>From: {fromMeta.title}</Text>

        <View style={styles.quickAmountRow}>
          {quickAmountValues.map((quickAmount, index) => {
            const selected = Number(amountInput) === quickAmount;

            return (
              <Pressable
                key={`${quickAmount}-${index}`}
                onPress={() => setAmountInput(String(quickAmount))}
                style={({ pressed }) => [
                  styles.quickAmountChip,
                  selected && styles.quickAmountChipSelected,
                  pressed && styles.quickAmountChipPressed,
                ]}
              >
                <Text style={[styles.quickAmountText, selected && styles.quickAmountTextSelected]}>
                  {formatWalletAmount(fromWallet, quickAmount)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AppInput
          keyboardType="decimal-pad"
          label={`You send (${fromMeta.unit})`}
          onChangeText={setAmountInput}
          placeholder={`Minimum ${formatWalletAmount(fromWallet, minFrom)}`}
          value={amountInput}
          wrapperStyle={styles.fieldGap}
        />

        <AppInput
          label="Reference (optional)"
          onChangeText={setNote}
          placeholder="Example: Rebalance portfolio"
          value={note}
          wrapperStyle={styles.fieldGap}
        />
      </GlassCard>

      <GlassCard style={styles.quoteCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Quote ID</Text>
          <Text style={styles.val}>{quoteId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Market rate</Text>
          <Text style={styles.val}>1 {fromMeta.unit} = {formatNumber(rate, toMeta.decimals)} {toMeta.unit}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Trade value</Text>
          <Text style={styles.val}>{formatUsd(usdValue)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Network + route fee</Text>
          <Text style={styles.val}>{formatUsd(feeUsd)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Slippage protection</Text>
          <Text style={styles.val}>{slippagePct.toFixed(1)}%</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>You receive</Text>
          <Text style={styles.totalVal}>{formatWalletAmount(toWallet, amountTo)}</Text>
        </View>
      </GlassCard>

      {!canContinue ? (
        <Text style={styles.validationText}>
          Enter valid amount and keep from/to wallet different.
        </Text>
      ) : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.buttonWrap}>
        <AppButton
          title={loading ? 'Getting quote...' : 'Continue to review'}
          onPress={onContinue}
          style={!canContinue ? styles.buttonDisabled : undefined}
        />
      </View>
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
    marginBottom: spacing.md,
  },
  heroCard: {
    borderColor: '#2E7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroShapeOne: {
    backgroundColor: 'rgba(236, 218, 179, 0.16)',
    borderRadius: radius.pill,
    height: 106,
    position: 'absolute',
    right: -26,
    top: -24,
    width: 106,
  },
  heroShapeTwo: {
    borderColor: 'rgba(236, 218, 179, 0.22)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 64,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 50,
  },
  heroOverline: {
    color: '#ECDBB8',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 23,
    marginTop: 3,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    maxWidth: '86%',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  targetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  targetChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  targetChipSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  targetChipPressed: pressStyles.chip,
  targetChipText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  targetChipTextSelected: {
    color: colors.primary,
  },
  swapBtn: {
    alignItems: 'center',
    backgroundColor: '#EAF4EE',
    borderColor: '#CFE2D6',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  swapBtnPressed: pressStyles.icon,
  formCard: {
    marginTop: spacing.lg,
  },
  fromWalletMeta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAmountChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 110,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  quickAmountChipSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  quickAmountChipPressed: pressStyles.chip,
  quickAmountText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  quickAmountTextSelected: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  quoteCard: {
    marginTop: spacing.xl,
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
  validationText: {
    color: '#8A6A2D',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
