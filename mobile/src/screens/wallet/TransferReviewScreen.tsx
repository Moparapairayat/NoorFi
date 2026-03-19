import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { useWallet } from '../../context/WalletContext';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TransferReview'>;

export function TransferReviewScreen({ navigation, route }: Props) {
  const { formatFromUsd } = useWallet();
  const { amount, feeUsd, etaLabel, note, walletId, destination, recipientLabel } = route.params;

  const totalDebit = amount + feeUsd;

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Review transfer</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <GlassCard style={styles.stepCard}>
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>Step 2 of 3</Text>
        </View>
        <Text style={styles.stepTitle}>Confirm transfer details</Text>
        <Text style={styles.stepDesc}>
          Double-check destination, fee and total debit before secure authorization.
        </Text>
      </GlassCard>

      <GlassCard style={styles.block}>
        <View style={styles.row}>
          <Text style={styles.key}>From wallet</Text>
          <Text style={styles.val}>{walletId.toUpperCase()} Wallet</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Transfer type</Text>
          <Text style={styles.val}>NoorFi User</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>{recipientLabel}</Text>
          <Text style={styles.val}>{destination}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Expected arrival</Text>
          <Text style={styles.val}>{etaLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Reference ID</Text>
          <Text style={styles.val}>Generated after PIN authorization</Text>
        </View>
        {note?.length ? (
          <View style={styles.row}>
            <Text style={styles.key}>Reference note</Text>
            <Text style={styles.val}>{note}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.key}>Recipient gets</Text>
          <Text style={styles.val}>{formatFromUsd(amount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Transfer fee</Text>
          <Text style={styles.val}>{formatFromUsd(feeUsd)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Total debit</Text>
          <Text style={styles.totalVal}>{formatFromUsd(totalDebit)}</Text>
        </View>
      </GlassCard>

      <AppButton
        title="Authorize transfer"
        onPress={() =>
          navigation.navigate('TransferSecurity', {
            walletId,
            method: 'noorfi_user',
            recipientLabel,
            destination,
            amount,
            note,
            feeUsd,
            etaLabel,
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
    fontFamily: typography.display,
    fontSize: 24,
    letterSpacing: -0.2,
  },
});
