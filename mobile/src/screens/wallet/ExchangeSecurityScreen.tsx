import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, createExchange, resolveWalletIdByCurrency } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WalletId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ExchangeSecurity'>;

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

export function ExchangeSecurityScreen({ navigation, route }: Props) {
  const { fromWallet, toWallet, amountFrom, amountTo, feeUsd, quoteId, note } = route.params;
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSubmit = pin.trim().length >= 4 && !loading;

  const completedAt = useMemo(() => new Date().toISOString(), []);

  const onSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const fromWalletId = await resolveWalletIdByCurrency(fromWallet);
      const response = await createExchange({
        from_wallet_id: fromWalletId,
        to_currency: toWallet,
        amount_from: amountFrom,
        quote_id: quoteId,
        note: note?.trim() || undefined,
        pin: pin.trim(),
      });

      const doneAt = response.exchange.completed_at ?? completedAt;
      const formattedDoneAt = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(doneAt));

      navigation.navigate('ExchangeSuccess', {
        ...route.params,
        exchangeRef: response.exchange.reference,
        completedAt: formattedDoneAt,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Exchange failed. Please try again.'
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
        <Text style={styles.title}>Exchange authorization</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#10392D', '#195A43', '#257356']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.lockWrap}>
          <Ionicons color="#EED8A7" name="shield-checkmark-outline" size={18} />
        </View>
        <Text style={styles.heroOverline}>Step 3 of 4</Text>
        <Text style={styles.heroTitle}>Authorize with PIN</Text>
        <Text style={styles.heroSubtitle}>
          Confirm this exchange request using your secure 4 digit PIN.
        </Text>
      </LinearGradient>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Quote ID</Text>
          <Text style={styles.val}>{quoteId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Exchange ref</Text>
          <Text style={styles.val}>Generated after submit</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>You send</Text>
          <Text style={styles.val}>{formatWalletAmount(fromWallet, amountFrom)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Route fee</Text>
          <Text style={styles.val}>{formatUsd(feeUsd)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>You receive</Text>
          <Text style={styles.totalVal}>{formatWalletAmount(toWallet, amountTo)}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Security PIN</Text>
        <AppInput
          keyboardType="number-pad"
          label="Enter 4 digit PIN"
          maxLength={4}
          onChangeText={setPin}
          placeholder="••••"
          secureTextEntry
          value={pin}
        />
        <Pressable
          onPress={() => navigation.navigate('ForgotPin')}
          style={({ pressed }) => [styles.inlineLinkWrap, pressed && styles.inlineLinkPressed]}
        >
          <Text style={styles.inlineLink}>Forgot PIN?</Text>
        </Pressable>

        <View style={styles.noticeRow}>
          <Ionicons color="#8A6B30" name="information-circle-outline" size={14} />
          <Text style={styles.noticeText}>
            Once confirmed, rate and settlement are locked for this quote.
          </Text>
        </View>
      </GlassCard>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.buttonWrap}>
        <AppButton
          title={loading ? 'Submitting...' : 'Confirm exchange'}
          onPress={onSubmit}
          style={!canSubmit ? styles.buttonDisabled : undefined}
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
  heroCard: {
    alignItems: 'center',
    borderColor: '#2E7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  lockWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 47, 36, 0.44)',
    borderColor: 'rgba(238, 216, 167, 0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroOverline: {
    color: '#EED8A7',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: 2,
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
    marginBottom: spacing.lg,
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
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  inlineLinkWrap: {
    alignSelf: 'flex-end',
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inlineLinkPressed: pressStyles.text,
  inlineLink: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  noticeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
  },
  noticeText: {
    color: '#7A6437',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  buttonWrap: {
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
