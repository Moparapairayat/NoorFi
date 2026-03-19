import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { useWallet } from '../../context/WalletContext';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WithdrawMethodId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'WithdrawReview'>;

const methodLabelMap: Record<WithdrawMethodId, string> = {
  heleket: 'Instant Payout',
  crypto_wallet: 'Crypto Wallet',
};

export function WithdrawReviewScreen({ navigation, route }: Props) {
  const { formatFromUsd } = useWallet();
  const {
    amount,
    feeUsd,
    method,
    network,
    etaLabel,
    note,
    walletId,
    destinationLabel,
    destinationValue,
    recipientName,
  } = route.params;

  const recipientGets = method === 'heleket' ? amount : Math.max(amount - feeUsd, 0);
  const totalDebit = amount + feeUsd;
  const onContinue = () =>
    navigation.navigate('WithdrawSecurity', {
      walletId,
      method,
      destinationLabel,
      destinationValue,
      network,
      recipientName,
      amount,
      note,
      feeUsd,
      etaLabel,
    });

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Review withdrawal</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#10392D', '#185841', '#247154']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>Step 2 of 4</Text>
        </View>
        <Text style={styles.heroTitle}>Confirm payout details</Text>
        <Text style={styles.heroSubtitle}>
          Verify recipient destination and amount before secure PIN authorization.
        </Text>
        <Text style={styles.heroAmount}>{formatFromUsd(recipientGets)}</Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaChip}>
            <Ionicons color="#EAD5A8" name="wallet-outline" size={12} />
            <Text style={styles.heroMetaText}>{walletId.toUpperCase()} Wallet</Text>
          </View>
          <View style={styles.heroMetaChip}>
            <Ionicons color="#EAD5A8" name="paper-plane-outline" size={12} />
            <Text style={styles.heroMetaText}>{methodLabelMap[method]}</Text>
          </View>
        </View>
      </LinearGradient>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Payout details</Text>
        <View style={styles.row}>
          <Text style={styles.key}>From wallet</Text>
          <Text style={styles.val}>{walletId.toUpperCase()} Wallet</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Payout method</Text>
          <Text style={styles.val}>{methodLabelMap[method]}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Recipient name</Text>
          <Text style={styles.val}>{recipientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>{destinationLabel}</Text>
          <Text style={styles.val}>{destinationValue}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Network</Text>
          <Text style={styles.val}>{network}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Expected ETA</Text>
          <Text style={styles.val}>{etaLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Reference ID</Text>
          <Text style={styles.val}>Generated after PIN authorization</Text>
        </View>
        {note?.length ? (
          <View style={styles.noteBox}>
            <View style={styles.noteHead}>
              <Ionicons color="#7A6531" name="document-text-outline" size={13} />
              <Text style={styles.noteLabel}>Reference note</Text>
            </View>
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Amount breakdown</Text>
        <View style={styles.row}>
          <Text style={styles.key}>Wallet debit</Text>
          <Text style={styles.val}>{formatFromUsd(totalDebit)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Fee</Text>
          <Text style={styles.val}>{formatFromUsd(feeUsd)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Recipient receives</Text>
          <Text style={styles.totalVal}>{formatFromUsd(recipientGets)}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.securityCard}>
        <Ionicons color="#A47724" name="shield-checkmark-outline" size={15} />
        <Text style={styles.securityText}>
          PIN authorization is required to submit this withdrawal. Destination cannot be changed after submission.
        </Text>
      </GlassCard>

      <AppButton title="Continue to PIN" onPress={onContinue} />
      <AppButton
        title="Edit details"
        variant="ghost"
        style={styles.secondaryBtn}
        onPress={() => navigation.goBack()}
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
    borderColor: '#2E7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroShapeOne: {
    backgroundColor: 'rgba(233, 213, 165, 0.18)',
    borderRadius: radius.pill,
    height: 120,
    position: 'absolute',
    right: -30,
    top: -28,
    width: 120,
  },
  heroShapeTwo: {
    borderColor: 'rgba(233, 213, 165, 0.24)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 78,
    position: 'absolute',
    right: 12,
    top: 10,
    width: 58,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10, 40, 30, 0.35)',
    borderColor: 'rgba(234, 213, 166, 0.36)',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: spacing.md,
  },
  stepPillText: {
    color: '#EBD8AC',
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: spacing.md,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.82)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  heroAmount: {
    color: '#F7FCFA',
    fontFamily: typography.display,
    fontSize: 34,
    letterSpacing: -0.5,
    marginTop: spacing.md,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroMetaChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 30, 23, 0.44)',
    borderColor: 'rgba(233, 213, 165, 0.3)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  heroMetaText: {
    color: '#F1E5C6',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  block: {
    marginBottom: spacing.xl,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    marginBottom: spacing.md,
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
    maxWidth: '58%',
    textAlign: 'right',
  },
  noteBox: {
    backgroundColor: '#FBF6EA',
    borderColor: '#E8D8B2',
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noteHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  noteLabel: {
    color: '#6B5426',
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  noteText: {
    color: '#5F6F66',
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
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
  securityCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E8',
    borderColor: '#F0D9AD',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  securityText: {
    color: '#7A6437',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  secondaryBtn: {
    marginTop: spacing.md,
  },
});
