import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../../components/AppButton';
import { CardPreview } from '../../../components/CardPreview';
import { GlassCard } from '../../../components/GlassCard';
import { Screen } from '../../../components/Screen';
import { ApiError, applyVirtualCard, resolveWalletIdByCurrency } from '../../../services/api';
import { colors, radius, spacing, typography, pressStyles } from '../../../theme';
import { RootStackParamList } from '../../../types/navigation';
import { ApplyFlowHeader } from './components/ApplyFlowHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'VirtualCardApplyReview'>;

export function VirtualCardApplyReviewScreen({ navigation, route }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const issueFee = route.params.issueFee;
  const prefundAmount = route.params.prefundAmount;
  const fundingSourceLabelMap = {
    usd_wallet: 'USD Wallet',
  } as const;
  const fundingSourceLabel = fundingSourceLabelMap[route.params.fundingSource];
  const isPhysicalCard = route.params.cardType === 'physical';
  const totalDebit = issueFee + prefundAmount;

  const controls = useMemo(
    () => [
      {
        id: 'online',
        label: 'Online payments',
        enabled: route.params.allowOnline,
      },
      {
        id: 'international',
        label: 'International use',
        enabled: route.params.allowInternational,
      },
      {
        id: 'atm',
        label: 'ATM withdrawals (locked for virtual)',
        enabled: false,
      },
      {
        id: 'reveal',
        label: 'Card details reveal via PIN',
        enabled: true,
      },
    ],
    [route.params.allowInternational, route.params.allowOnline]
  );

  const onSubmit = async () => {
    if (!accepted || loading) {
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const fundingWalletId = await resolveWalletIdByCurrency('usd');
      const response = await applyVirtualCard({
        card_type: 'virtual',
        card_name: route.params.cardName,
        holder_name: route.params.holderName,
        theme: route.params.theme,
        funding_wallet_id: fundingWalletId,
        issue_fee: issueFee,
        prefund_amount: prefundAmount,
      });

      navigation.replace('VirtualCardApplySuccess', {
        cardId: String(response.card.id),
        cardName: response.card.template_name,
        holderName: response.card.holder_name,
        theme: route.params.theme,
        chipStyle: route.params.chipStyle,
        last4: response.card.last4 ?? '----',
      });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to issue card.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <ApplyFlowHeader
        onBack={() => navigation.goBack()}
        step={3}
        subtitle="Review profile, controls and fee deduction"
        title="Review application"
        totalSteps={4}
      />

      <CardPreview
        chipStyle={route.params.chipStyle}
        holderName={route.params.holderName}
        orientation="landscape"
        showChip={isPhysicalCard}
        style={styles.cardPreview}
        theme={route.params.theme}
      />

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Application summary</Text>
        <View style={styles.line}>
          <Text style={styles.key}>Card name</Text>
          <Text style={styles.val}>{route.params.cardName}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.key}>Funding source</Text>
          <Text style={styles.val}>{fundingSourceLabel}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.key}>Daily limit</Text>
          <Text style={styles.val}>${route.params.dailyLimit}</Text>
        </View>
        <View style={styles.lineLast}>
          <Text style={styles.key}>Monthly limit</Text>
          <Text style={styles.val}>${route.params.monthlyLimit}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Controls</Text>
        <View style={styles.controlWrap}>
          {controls.map((control) => (
            <View key={control.id} style={[styles.controlChip, control.enabled && styles.controlChipEnabled]}>
              <Ionicons
                color={control.enabled ? colors.success : colors.textMuted}
                name={control.enabled ? 'checkmark-circle' : 'close-circle-outline'}
                size={14}
              />
              <Text style={[styles.controlText, control.enabled && styles.controlTextEnabled]}>
                {control.label}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.providerCard}>
        <Text style={styles.providerTitle}>After issue (Strowallet)</Text>
        <Text style={styles.providerText}>Freeze or unfreeze card, upgrade limits, and view provider transactions.</Text>
      </GlassCard>

      <GlassCard style={styles.feeCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Issue fee</Text>
          <Text style={styles.feeValue}>${issueFee.toFixed(2)}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Initial prefund</Text>
          <Text style={styles.feeValue}>${prefundAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.feeDivider} />
        <View style={styles.feeRowLast}>
          <Text style={styles.totalLabel}>Total deduction now</Text>
          <Text style={styles.totalValue}>${totalDebit.toFixed(2)}</Text>
        </View>
      </GlassCard>

      <Pressable
        onPress={() => setAccepted((prev) => !prev)}
        style={({ pressed }) => [
          styles.termsRow,
          accepted && styles.termsRowActive,
          pressed && styles.termsRowPressed,
        ]}
      >
        <Ionicons
          color={accepted ? colors.primary : colors.textMuted}
          name={accepted ? 'checkbox' : 'square-outline'}
          size={18}
        />
        <View style={styles.termsMeta}>
          <Text style={styles.termsText}>I agree to card issuance terms and fee deduction.</Text>
          <Text style={styles.termsSub}>The fee will be deducted instantly from {fundingSourceLabel}.</Text>
        </View>
      </Pressable>

      <AppButton
        title={loading ? 'Issuing card...' : `Pay $${totalDebit.toFixed(2)} and issue card`}
        style={!accepted || loading ? styles.disabledCta : undefined}
        onPress={onSubmit}
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardPreview: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
    maxWidth: 350,
    width: '95%',
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
  line: {
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  lineLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  key: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 13,
  },
  val: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  controlWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  controlChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: spacing.md,
  },
  controlChipEnabled: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  controlText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  controlTextEnabled: {
    color: colors.success,
  },
  providerCard: {
    backgroundColor: '#F5FAF7',
    borderColor: '#CFE5D7',
    marginBottom: spacing.lg,
  },
  providerTitle: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginBottom: 4,
  },
  providerText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
  },
  feeCard: {
    borderColor: '#CFE3D6',
    marginBottom: spacing.lg,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  feeRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeLabel: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 13,
  },
  feeValue: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  feeDivider: {
    backgroundColor: '#DDEBE3',
    height: 1,
    marginVertical: spacing.md,
  },
  totalLabel: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  totalValue: {
    color: colors.primary,
    fontFamily: typography.display,
    fontSize: 22,
    letterSpacing: -0.2,
  },
  termsRow: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  termsRowActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  termsRowPressed: pressStyles.row,
  termsMeta: {
    flex: 1,
  },
  termsText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  termsSub: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 2,
  },
  disabledCta: {
    opacity: 0.5,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  footerSpace: {
    height: spacing.xl,
  },
});
