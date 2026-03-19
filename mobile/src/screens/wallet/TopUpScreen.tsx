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
import { ApiError, getDepositOptions, type FundingMethodOption } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, TopUpMethodId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TopUp'>;

type MethodOption = {
  id: TopUpMethodId;
  name: string;
  meta: string;
  eta: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const methodOptions: MethodOption[] = [
  {
    id: 'binance_pay',
    name: 'Binance Pay',
    meta: 'Pay from Binance account or QR',
    eta: 'Under 1 min',
    icon: 'wallet-outline',
  },
  {
    id: 'crypto_wallet',
    name: 'Crypto Wallet',
    meta: 'USDT, SOL network funding',
    eta: '3-20 confirmations',
    icon: 'logo-bitcoin',
  },
  {
    id: 'heleket',
    name: 'Heleket',
    meta: 'Hosted checkout invoice',
    eta: 'Near instant',
    icon: 'globe-outline',
  },
];

const quickAmounts = [20, 50, 100, 250];

export function TopUpScreen({ navigation, route }: Props) {
  const { formatFromUsd, selectedWallet } = useWallet();
  const [method, setMethod] = useState<TopUpMethodId>('binance_pay');
  const [amountInput, setAmountInput] = useState(
    route.params?.presetAmount ? String(route.params.presetAmount) : ''
  );
  const [note, setNote] = useState('');
  const [serverMethods, setServerMethods] = useState<FundingMethodOption[]>([]);
  const [optionError, setOptionError] = useState<string | null>(null);

  const amount = useMemo(() => {
    const parsed = Number(amountInput);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [amountInput]);

  const selectedMethodMeta = methodOptions.find((item) => item.id === method) ?? methodOptions[0];
  const selectedCurrency = selectedWallet.toUpperCase();
  const selectedMethodServer = useMemo(
    () => serverMethods.find((item) => item.key === method),
    [method, serverMethods]
  );

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await getDepositOptions();
        if (!alive) {
          return;
        }

        setServerMethods(response.methods);
        setOptionError(null);
      } catch (error) {
        if (!alive) {
          return;
        }

        setOptionError(
          error instanceof ApiError ? error.message : 'Live provider limits unavailable now.'
        );
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const methodSupported = useMemo(() => {
    if (!selectedMethodServer) {
      return !(method === 'binance_pay' && selectedWallet === 'sol');
    }

    return selectedMethodServer.supported_currencies.includes(selectedCurrency);
  }, [method, selectedCurrency, selectedMethodServer, selectedWallet]);

  useEffect(() => {
    if (methodSupported) {
      return;
    }

    const fallback = (serverMethods.find((item) => item.supported_currencies.includes(selectedCurrency))
      ?.key ?? 'crypto_wallet') as TopUpMethodId;
    setMethod(fallback);
  }, [methodSupported, selectedCurrency, serverMethods]);

  const liveLimit = selectedMethodServer?.limits?.[selectedCurrency];
  const liveNetworks = selectedMethodServer?.networks?.[selectedCurrency] ?? [];
  const minAmount = liveLimit?.min_amount ?? 1;
  const maxAmount = liveLimit?.max_amount ?? 10_000_000;

  const feeUsd = useMemo(() => {
    if (method === 'heleket' && liveLimit) {
      const dynamicFee = amount * (liveLimit.fee_percent / 100) + liveLimit.fee_amount;
      return Number(dynamicFee.toFixed(8));
    }

    if (method === 'crypto_wallet') {
      return selectedWallet === 'sol' ? 0.2 : 0.45;
    }

    if (method === 'heleket') {
      return 0;
    }

    return 0.3;
  }, [amount, liveLimit, method, selectedWallet]);

  const totalDebit = amount + feeUsd;
  const canContinue = amount >= minAmount && amount <= maxAmount && methodSupported;

  const onContinue = () => {
    if (!canContinue) {
      return;
    }

    navigation.navigate('TopUpReview', {
      walletId: selectedWallet,
      method,
      amount,
      note: note.trim(),
      feeUsd,
      etaLabel: selectedMethodMeta.eta,
    });
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
        <Text style={styles.title}>Top up NoorFi wallet</Text>
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
        <Text style={styles.heroOverline}>Deposit workflow</Text>
        <Text style={styles.heroTitle}>Step 1 of 3</Text>
        <Text style={styles.heroSubtitle}>Select source and enter amount to continue.</Text>
      </LinearGradient>

      <GlassCard>
        <Text style={styles.sectionTitle}>Funding source</Text>
        {methodOptions.map((option) => {
          const selected = method === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => setMethod(option.id)}
              style={({ pressed }) => [
                styles.sourceItem,
                selected && styles.sourceActive,
                pressed && styles.sourceItemPressed,
              ]}
            >
              <View style={styles.sourceLeft}>
                <View style={[styles.sourceIconWrap, selected && styles.sourceIconWrapSelected]}>
                  <Ionicons
                    color={selected ? colors.primary : colors.textSecondary}
                    name={option.icon}
                    size={16}
                  />
                </View>
                <View>
                  <Text style={styles.sourceName}>{option.name}</Text>
                  <Text style={styles.sourceMeta}>{option.meta}</Text>
                </View>
              </View>
              <View style={styles.sourceRight}>
                <Text style={styles.sourceEta}>{option.eta}</Text>
                <Ionicons
                  color={selected ? colors.primary : colors.textMuted}
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                />
              </View>
            </Pressable>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.amountCard}>
        <Text style={styles.sectionTitle}>Deposit amount</Text>

        <View style={styles.quickAmountRow}>
          {quickAmounts.map((quickAmount) => {
            const selected = Number(amountInput) === quickAmount;

            return (
              <Pressable
                key={quickAmount}
                onPress={() => setAmountInput(String(quickAmount))}
                style={({ pressed }) => [
                  styles.quickAmountChip,
                  selected && styles.quickAmountChipSelected,
                  pressed && styles.quickAmountChipPressed,
                ]}
              >
                <Text
                  style={[styles.quickAmountText, selected && styles.quickAmountTextSelected]}
                >
                  {formatFromUsd(quickAmount)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AppInput
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmountInput}
          placeholder={`Min ${formatFromUsd(minAmount)}`}
          value={amountInput}
          wrapperStyle={styles.fieldGap}
        />

        <AppInput
          label="Narration (optional)"
          onChangeText={setNote}
          placeholder="Example: Weekly savings"
          value={note}
          wrapperStyle={styles.fieldGap}
        />
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Method</Text>
          <Text style={styles.val}>{selectedMethodMeta.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Deposit amount</Text>
          <Text style={styles.val}>{formatFromUsd(amount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Funding fee</Text>
          <Text style={styles.val}>{formatFromUsd(feeUsd)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Total debit</Text>
          <Text style={styles.totalVal}>{formatFromUsd(totalDebit)}</Text>
        </View>
      </GlassCard>

      {selectedMethodServer?.provider_source === 'live' && liveLimit ? (
        <GlassCard style={styles.liveInfoCard}>
          <Text style={styles.liveInfoTitle}>Live provider limits</Text>
          <Text style={styles.liveInfoText}>
            Range: {formatFromUsd(minAmount)} - {formatFromUsd(maxAmount)}
          </Text>
          <Text style={styles.liveInfoText}>
            Fee: {liveLimit.fee_percent.toFixed(2)}% + {formatFromUsd(liveLimit.fee_amount)}
          </Text>
          {liveNetworks.length ? (
            <Text style={styles.liveInfoText}>Networks: {liveNetworks.join(', ')}</Text>
          ) : null}
        </GlassCard>
      ) : null}

      <View style={styles.buttonWrap}>
        <AppButton
          title="Continue to review"
          onPress={onContinue}
          style={!canContinue ? styles.buttonDisabled : undefined}
        />
        {!methodSupported ? (
          <Text style={styles.validationText}>
            Selected funding method is unavailable for this wallet currency.
          </Text>
        ) : amount < minAmount || amount > maxAmount ? (
          <Text style={styles.validationText}>
            Amount must be between {formatFromUsd(minAmount)} and {formatFromUsd(maxAmount)}.
          </Text>
        ) : null}
        {optionError ? <Text style={styles.optionErrorText}>{optionError}</Text> : null}
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
    backgroundColor: 'rgba(234, 214, 173, 0.16)',
    borderRadius: radius.pill,
    height: 106,
    position: 'absolute',
    right: -26,
    top: -24,
    width: 106,
  },
  heroShapeTwo: {
    borderColor: 'rgba(234, 214, 173, 0.22)',
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
    maxWidth: '84%',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  sourceItem: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  sourceActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  sourceItemPressed: pressStyles.row,
  sourceLeft: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sourceIconWrap: {
    alignItems: 'center',
    backgroundColor: '#F2F5F8',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  sourceIconWrapSelected: {
    backgroundColor: '#E3F3EA',
  },
  sourceName: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  sourceMeta: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  sourceRight: {
    alignItems: 'flex-end',
  },
  sourceEta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    marginBottom: 2,
  },
  amountCard: {
    marginTop: spacing.lg,
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
    minWidth: 90,
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
  summaryCard: {
    marginTop: spacing.xl,
  },
  liveInfoCard: {
    backgroundColor: '#F4FBF7',
    borderColor: '#D4E9DD',
    marginTop: spacing.md,
  },
  liveInfoTitle: {
    color: '#1A6B4E',
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginBottom: 4,
  },
  liveInfoText: {
    color: '#4A665B',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: 2,
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
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
  totalKey: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  totalVal: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 16,
  },
  buttonWrap: {
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  validationText: {
    color: '#8A6A2D',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  optionErrorText: {
    color: '#8A6A2D',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
