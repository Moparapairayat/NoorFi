import React, { useMemo, useState } from 'react';
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
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

const quickAmounts = [25, 50, 100, 250];

const quickRecipients = [
  { name: 'Samiul', destination: 'samiul@noorfi.com' },
  { name: 'Amina', destination: 'amina@noorfi.com' },
  { name: 'Fatima', destination: 'fatima@noorfi.com' },
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function TransferScreen({ navigation, route }: Props) {
  const { formatFromUsd, selectedWallet } = useWallet();
  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState(
    route.params?.presetAmount ? String(route.params.presetAmount) : ''
  );
  const [note, setNote] = useState('');

  const amount = useMemo(() => {
    const parsed = Number(amountInput);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [amountInput]);

  const selectedMethod = {
    eta: 'Instant',
    placeholder: 'recipient@noorfi.com',
    recipientLabel: 'Recipient email',
  };

  const feeUsd = useMemo(() => {
    return selectedWallet === 'sol' ? 0.08 : 0.15;
  }, [selectedWallet]);

  const trimmedRecipient = recipientInput.trim();
  const canContinue = amount > 0 && isValidEmail(trimmedRecipient);
  const totalDebit = amount + feeUsd;

  const onContinue = () => {
    if (!canContinue) {
      return;
    }

    navigation.navigate('TransferReview', {
      walletId: selectedWallet,
      method: 'noorfi_user',
      recipientLabel: selectedMethod.recipientLabel,
      destination: trimmedRecipient,
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
        <Text style={styles.title}>Send money</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <WalletSelector style={styles.walletSelector} />

      <LinearGradient
        colors={['#103A2D', '#1B5C44', '#267257']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Text style={styles.heroOverline}>Send workflow</Text>
        <Text style={styles.heroTitle}>Step 1 of 3</Text>
        <Text style={styles.heroSubtitle}>
          Set recipient and amount, then continue to secure review.
        </Text>
      </LinearGradient>

      <GlassCard style={styles.recipientCard}>
        <Text style={styles.sectionTitle}>Recent recipients</Text>
        <View style={styles.recipientRow}>
          {quickRecipients.map((recipient) => {
            const selected = recipientInput.trim() === recipient.destination;
            return (
              <Pressable
                key={recipient.destination}
                onPress={() => setRecipientInput(recipient.destination)}
                style={({ pressed }) => [
                  styles.recipientChip,
                  selected && styles.recipientChipActive,
                  pressed && styles.recipientChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.recipientChipName,
                    selected && styles.recipientChipNameActive,
                  ]}
                >
                  {recipient.name}
                </Text>
                <Text style={styles.recipientChipMeta}>{recipient.destination}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Transfer details</Text>

        <AppInput
          autoCapitalize="none"
          label={selectedMethod.recipientLabel}
          onChangeText={setRecipientInput}
          placeholder={selectedMethod.placeholder}
          value={recipientInput}
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

        <AppInput
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmountInput}
          placeholder="Enter amount"
          value={amountInput}
          wrapperStyle={styles.fieldGap}
        />

        <AppInput
          label="Reference (optional)"
          onChangeText={setNote}
          placeholder="Example: Family support"
          value={note}
          wrapperStyle={styles.fieldGap}
        />
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Recipient gets</Text>
          <Text style={styles.val}>{formatFromUsd(amount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Transfer fee</Text>
          <Text style={styles.val}>{formatFromUsd(feeUsd)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>ETA</Text>
          <Text style={styles.val}>{selectedMethod.eta}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Total debit</Text>
          <Text style={styles.totalVal}>{formatFromUsd(totalDebit)}</Text>
        </View>
      </GlassCard>

      {!canContinue ? (
        <Text style={styles.validationText}>
          Enter valid recipient email and amount to continue.
        </Text>
      ) : null}

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
    borderColor: '#2E7C5F',
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
    color: 'rgba(233, 243, 239, 0.84)',
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
  recipientCard: {
    marginTop: 0,
  },
  recipientRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recipientChip: {
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  recipientChipActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  recipientChipPressed: pressStyles.chip,
  recipientChipName: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  recipientChipNameActive: {
    color: colors.primary,
  },
  recipientChipMeta: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 10,
    marginTop: 2,
  },
  formCard: {
    marginTop: spacing.lg,
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
    maxWidth: '55%',
    textAlign: 'right',
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
  validationText: {
    color: '#8A6A2D',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
