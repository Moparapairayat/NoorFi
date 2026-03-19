import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { WalletSelector } from '../../components/WalletSelector';
import { useWallet } from '../../context/WalletContext';
import { colors, radius, spacing, typography, pressStyles } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sadaqah'>;

type CauseId = 'food' | 'education' | 'medical' | 'masjid';

type CauseOption = {
  id: CauseId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  note: string;
};

const causeOptions: CauseOption[] = [
  { id: 'food', label: 'Food support', icon: 'restaurant-outline', note: 'Feed needy families' },
  { id: 'education', label: 'Education', icon: 'school-outline', note: 'Support student fund' },
  { id: 'medical', label: 'Medical aid', icon: 'medkit-outline', note: 'Emergency treatment support' },
  { id: 'masjid', label: 'Masjid fund', icon: 'business-outline', note: 'Mosque development program' },
];

const quickAmounts = [5, 10, 20, 50];

export function SadaqahScreen({ navigation, route }: Props) {
  const { formatFromUsd } = useWallet();
  const [selectedCause, setSelectedCause] = useState<CauseId>('food');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(route.params?.presetAmount ?? 10);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const donationAmount = useMemo(() => {
    const parsedCustom = Number(customAmount);

    if (!Number.isNaN(parsedCustom) && parsedCustom > 0) {
      return parsedCustom;
    }

    return selectedAmount ?? 0;
  }, [customAmount, selectedAmount]);

  const serviceFee = 0;
  const totalDebit = donationAmount + serviceFee;
  const selectedCauseMeta = causeOptions.find((item) => item.id === selectedCause);
  const canDonate = donationAmount > 0;

  const onDonate = () => {
    if (!canDonate) {
      return;
    }

    setSubmitted(true);
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
        <Text style={styles.title}>Sadaqah</Text>
        <View style={styles.iconPlaceholder} />
      </View>
      <WalletSelector style={styles.walletSelector} />

      <GlassCard style={styles.headCard}>
        <View style={styles.headBadge}>
          <Ionicons color="#1A6B4E" name="heart-outline" size={14} />
          <Text style={styles.headBadgeText}>Quick giving</Text>
        </View>
        <Text style={styles.headTitle}>Give in seconds</Text>
        <Text style={styles.headDesc}>Choose a cause and send sadaqah instantly from wallet balance.</Text>
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.sectionTitle}>Choose cause</Text>
        {causeOptions.map((cause) => {
          const selected = selectedCause === cause.id;

          return (
            <Pressable
              key={cause.id}
              onPress={() => setSelectedCause(cause.id)}
              style={({ pressed }) => [
                styles.causeRow,
                selected && styles.causeRowSelected,
                pressed && styles.causeRowPressed,
              ]}
            >
              <View style={[styles.causeIconWrap, selected && styles.causeIconWrapSelected]}>
                <Ionicons
                  color={selected ? '#1A6B4E' : colors.textSecondary}
                  name={cause.icon}
                  size={16}
                />
              </View>
              <View style={styles.causeMeta}>
                <Text style={styles.causeLabel}>{cause.label}</Text>
                <Text style={styles.causeNote}>{cause.note}</Text>
              </View>
              <Ionicons
                color={selected ? '#1A6B4E' : colors.textMuted}
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
              />
            </Pressable>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.sectionTitle}>Select amount</Text>
        <View style={styles.amountRow}>
          {quickAmounts.map((amount) => {
            const selected = selectedAmount === amount && customAmount.trim().length === 0;

            return (
              <Pressable
                key={amount}
                onPress={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                }}
                style={({ pressed }) => [
                  styles.amountChip,
                  selected && styles.amountChipSelected,
                  pressed && styles.amountChipPressed,
                ]}
              >
                <Text style={[styles.amountChipText, selected && styles.amountChipTextSelected]}>
                  {formatFromUsd(amount)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AppInput
          keyboardType="decimal-pad"
          label="Custom amount"
          onChangeText={setCustomAmount}
          placeholder="Enter custom amount"
          value={customAmount}
          wrapperStyle={styles.customInput}
        />

        <AppInput
          label="Note (optional)"
          onChangeText={setNote}
          placeholder="For example: Friday sadaqah"
          value={note}
          wrapperStyle={styles.customInput}
        />
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.key}>Cause</Text>
          <Text style={styles.val}>{selectedCauseMeta?.label ?? 'Food support'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.key}>Donation amount</Text>
          <Text style={styles.val}>{formatFromUsd(donationAmount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.key}>Service fee</Text>
          <Text style={styles.val}>{formatFromUsd(serviceFee)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryLastRow}>
          <Text style={styles.totalKey}>Total debit</Text>
          <Text style={styles.totalVal}>{formatFromUsd(totalDebit)}</Text>
        </View>
      </GlassCard>

      {submitted ? (
        <GlassCard style={styles.successCard}>
          <Ionicons color={colors.success} name="checkmark-circle" size={16} />
          <Text style={styles.successText}>Sadaqah sent successfully. May Allah accept it.</Text>
        </GlassCard>
      ) : null}

      <AppButton
        title={submitted ? 'Donate again' : `Donate ${formatFromUsd(totalDebit)}`}
        style={!canDonate ? styles.disabledBtn : undefined}
        onPress={onDonate}
      />

      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
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
  headCard: {
    backgroundColor: '#EEF7F2',
    borderColor: '#D3E9DD',
    marginBottom: spacing.lg,
  },
  headBadge: {
    alignItems: 'center',
    backgroundColor: '#E1F1E8',
    borderColor: '#BFDCCB',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 26,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  headBadgeText: {
    color: '#1A6B4E',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  headTitle: {
    color: '#153A2C',
    fontFamily: typography.heading,
    fontSize: 20,
    marginTop: spacing.md,
  },
  headDesc: {
    color: '#456457',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  block: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  causeRow: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  causeRowSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  causeRowPressed: pressStyles.row,
  causeIconWrap: {
    alignItems: 'center',
    backgroundColor: '#F3F6F9',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  causeIconWrapSelected: {
    backgroundColor: '#E2F3EA',
  },
  causeMeta: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  causeLabel: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  causeNote: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amountChip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 86,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  amountChipSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  amountChipPressed: pressStyles.chip,
  amountChipText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  amountChipTextSelected: {
    color: '#1A6B4E',
    fontFamily: typography.bodyBold,
  },
  customInput: {
    marginTop: spacing.md,
  },
  summaryCard: {
    borderColor: '#D7E8DF',
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryDivider: {
    backgroundColor: '#E8EFEC',
    height: 1,
    marginBottom: spacing.md,
  },
  summaryLastRow: {
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
  totalKey: {
    color: '#174D39',
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  totalVal: {
    color: '#1A6B4E',
    fontFamily: typography.display,
    fontSize: 22,
    letterSpacing: -0.2,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: '#EAF9F1',
    borderColor: '#C7EAD7',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  successText: {
    color: '#1A6B4E',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  footerSpace: {
    height: spacing.xl,
  },
});
