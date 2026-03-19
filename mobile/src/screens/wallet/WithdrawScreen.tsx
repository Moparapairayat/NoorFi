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
import { ApiError, getWithdrawalOptions, type FundingMethodOption } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WithdrawMethodId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Withdraw'>;

type WithdrawMethodOption = {
  id: WithdrawMethodId;
  name: string;
  meta: string;
  eta: string;
  icon: keyof typeof Ionicons.glyphMap;
  destinationLabel: string;
  destinationPlaceholder: string;
};

const methodOptions: WithdrawMethodOption[] = [
  {
    id: 'heleket',
    name: 'Instant payout',
    meta: 'Heleket rails with tracked provider status',
    eta: '30-120 sec',
    icon: 'flash-outline',
    destinationLabel: 'Payout address',
    destinationPlaceholder: 'Enter recipient wallet address',
  },
  {
    id: 'crypto_wallet',
    name: 'Manual crypto',
    meta: 'Standard crypto withdrawal flow',
    eta: '2-20 min',
    icon: 'link-outline',
    destinationLabel: 'Wallet address',
    destinationPlaceholder: 'Enter USDT or SOL address',
  },
];

const quickAmounts = [25, 50, 100, 250];

export function WithdrawScreen({ navigation, route }: Props) {
  const { formatFromUsd, selectedWallet } = useWallet();
  const [method, setMethod] = useState<WithdrawMethodId>('heleket');
  const [recipientName, setRecipientName] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  const [network, setNetwork] = useState(selectedWallet === 'sol' ? 'SOL' : 'TRC20');
  const [amountInput, setAmountInput] = useState(
    route.params?.presetAmount ? String(route.params.presetAmount) : ''
  );
  const [note, setNote] = useState('');
  const [serverMethods, setServerMethods] = useState<FundingMethodOption[]>([]);
  const [optionError, setOptionError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedWallet === 'sol') {
      setNetwork('SOL');
      return;
    }

    if (network === 'SOL' || network === 'TRC20') {
      return;
    }

    setNetwork('TRC20');
  }, [network, selectedWallet]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await getWithdrawalOptions();
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
          error instanceof ApiError ? error.message : 'Live payout limits unavailable now.'
        );
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const selectedMethod = useMemo(
    () => methodOptions.find((option) => option.id === method) ?? methodOptions[0],
    [method]
  );
  const selectedCurrency = selectedWallet.toUpperCase();
  const selectedMethodServer = useMemo(
    () => serverMethods.find((item) => item.key === method),
    [method, serverMethods]
  );
  const availableNetworks = useMemo(() => {
    const fromProvider = selectedMethodServer?.networks?.[selectedCurrency] ?? [];
    if (fromProvider.length > 0) {
      return fromProvider;
    }

    return selectedWallet === 'sol' ? ['SOL'] : ['TRC20', 'SOL'];
  }, [selectedCurrency, selectedMethodServer, selectedWallet]);

  const methodSupported = useMemo(() => {
    if (!selectedMethodServer) {
      return true;
    }

    return selectedMethodServer.supported_currencies.includes(selectedCurrency);
  }, [selectedCurrency, selectedMethodServer]);

  useEffect(() => {
    if (methodSupported) {
      return;
    }

    const fallback = (serverMethods.find((item) => item.supported_currencies.includes(selectedCurrency))
      ?.key ?? 'crypto_wallet') as WithdrawMethodId;
    setMethod(fallback);
  }, [methodSupported, selectedCurrency, serverMethods]);

  useEffect(() => {
    if (!availableNetworks.length) {
      return;
    }

    if (!availableNetworks.includes(network)) {
      setNetwork(availableNetworks[0]);
    }
  }, [availableNetworks, network]);

  const amount = useMemo(() => {
    const parsed = Number(amountInput);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [amountInput]);

  const liveLimit = selectedMethodServer?.limits?.[selectedCurrency];
  const minAmount = liveLimit?.min_amount ?? 10;
  const maxAmount = liveLimit?.max_amount ?? 10_000_000;

  const feeUsd = useMemo(
    () => {
      if (method === 'heleket' && liveLimit) {
        const dynamicFee = amount * (liveLimit.fee_percent / 100) + liveLimit.fee_amount;
        return Number(dynamicFee.toFixed(8));
      }

      return selectedWallet === 'sol' ? 0.62 : 0.5;
    },
    [amount, liveLimit, method, selectedWallet]
  );

  const recipientGets = method === 'heleket' ? amount : Math.max(amount - feeUsd, 0);
  const destinationMinLength = 12;
  const canContinue =
    amount >= minAmount &&
    amount <= maxAmount &&
    methodSupported &&
    recipientName.trim().length >= 2 &&
    destinationValue.trim().length >= destinationMinLength;

  const onContinue = () => {
    if (!canContinue) {
      return;
    }

    navigation.navigate('WithdrawReview', {
      walletId: selectedWallet,
      method,
      destinationLabel: selectedMethod.destinationLabel,
      destinationValue: destinationValue.trim(),
      network,
      recipientName: recipientName.trim(),
      amount,
      note: note.trim(),
      feeUsd,
      etaLabel: selectedMethod.eta,
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
        <Text style={styles.title}>Withdraw funds</Text>
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
        <Text style={styles.heroOverline}>Withdraw workflow</Text>
        <Text style={styles.heroTitle}>Step 1 of 4</Text>
        <Text style={styles.heroSubtitle}>
          Select payout method, destination and amount to continue.
        </Text>
      </LinearGradient>

      <GlassCard>
        <Text style={styles.sectionTitle}>Payout method</Text>
        {methodOptions.map((option) => {
          const selected = option.id === method;

          return (
            <Pressable
              key={option.id}
              onPress={() => setMethod(option.id)}
              style={({ pressed }) => [
                styles.methodItem,
                selected && styles.methodItemActive,
                pressed && styles.methodItemPressed,
              ]}
            >
              <View style={styles.methodLeft}>
                <View style={[styles.methodIconWrap, selected && styles.methodIconWrapActive]}>
                  <Ionicons
                    color={selected ? colors.primary : colors.textSecondary}
                    name={option.icon}
                    size={16}
                  />
                </View>
                <View>
                  <Text style={styles.methodName}>{option.name}</Text>
                  <Text style={styles.methodMeta}>{option.meta}</Text>
                </View>
              </View>
              <View style={styles.methodRight}>
                <Text style={styles.methodEta}>{option.eta}</Text>
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

      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Withdrawal details</Text>

        <AppInput
          label="Recipient name"
          onChangeText={setRecipientName}
          placeholder="Account holder full name"
          value={recipientName}
        />

        <AppInput
          autoCapitalize="none"
          label={selectedMethod.destinationLabel}
          onChangeText={setDestinationValue}
          placeholder={selectedMethod.destinationPlaceholder}
          value={destinationValue}
          wrapperStyle={styles.fieldGap}
        />

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
                <Text style={[styles.quickAmountText, selected && styles.quickAmountTextSelected]}>
                  {formatFromUsd(quickAmount)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.networkRow}>
          {availableNetworks.map((networkOption) => {
            const selected = networkOption === network;
            return (
              <Pressable
                key={networkOption}
                onPress={() => setNetwork(networkOption)}
                style={({ pressed }) => [
                  styles.networkChip,
                  selected && styles.networkChipActive,
                  pressed && styles.networkChipPressed,
                ]}
              >
                <Text style={[styles.networkChipText, selected && styles.networkChipTextActive]}>
                  {networkOption}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AppInput
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmountInput}
          placeholder={`Minimum ${formatFromUsd(minAmount)}`}
          value={amountInput}
          wrapperStyle={styles.fieldGap}
        />

        <AppInput
          label="Reference (optional)"
          onChangeText={setNote}
          placeholder="Example: Monthly cashout"
          value={note}
          wrapperStyle={styles.fieldGap}
        />
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
          {availableNetworks.length ? (
            <Text style={styles.liveInfoText}>Networks: {availableNetworks.join(', ')}</Text>
          ) : null}
        </GlassCard>
      ) : null}

      <GlassCard style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Wallet debit</Text>
          <Text style={styles.val}>{formatFromUsd(amount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Processing fee</Text>
          <Text style={styles.val}>{formatFromUsd(feeUsd)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Recipient receives</Text>
          <Text style={styles.val}>{formatFromUsd(recipientGets)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Expected ETA</Text>
          <Text style={styles.totalVal}>{selectedMethod.eta}</Text>
        </View>
      </GlassCard>

      {!canContinue ? (
        <Text style={styles.validationText}>
          Fill recipient and destination, then use an amount between {formatFromUsd(minAmount)} and{' '}
          {formatFromUsd(maxAmount)}.
        </Text>
      ) : null}
      {optionError ? <Text style={styles.optionErrorText}>{optionError}</Text> : null}

      <View style={styles.buttonWrap}>
        <AppButton
          title="Continue to review"
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
    maxWidth: '84%',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  methodItem: {
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
  methodItemActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  methodItemPressed: pressStyles.row,
  methodLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  methodIconWrap: {
    alignItems: 'center',
    backgroundColor: '#F2F5F8',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  methodIconWrapActive: {
    backgroundColor: '#E3F3EA',
  },
  methodName: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  methodMeta: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  methodRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  networkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  networkChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
    minWidth: 84,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  networkChipActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  networkChipPressed: pressStyles.chip,
  networkChipText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  networkChipTextActive: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
  },
  methodEta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    marginBottom: 2,
  },
  formCard: {
    marginTop: spacing.lg,
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
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickAmountChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 86,
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
  },
  totalKey: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  totalVal: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
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
  buttonWrap: {
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
