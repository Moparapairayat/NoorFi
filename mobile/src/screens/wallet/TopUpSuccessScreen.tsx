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
import { RootStackParamList, TopUpMethodId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TopUpSuccess'>;

const methodLabelMap: Record<TopUpMethodId, string> = {
  binance_pay: 'Binance Pay',
  crypto_wallet: 'Crypto Wallet',
  heleket: 'Heleket',
};

export function TopUpSuccessScreen({ navigation, route }: Props) {
  const { formatFromUsd } = useWallet();
  const { amount, feeUsd, method, walletId, referenceId } = route.params;

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="close" size={20} />
        </Pressable>
        <Text style={styles.title}>Deposit submitted</Text>
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
        <Text style={styles.heroTitle}>Deposit request received</Text>
        <Text style={styles.heroSubtitle}>
          Your payment is being verified and will be credited once settlement completes.
        </Text>
      </LinearGradient>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.key}>Wallet</Text>
          <Text style={styles.val}>{walletId.toUpperCase()} Wallet</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Method</Text>
          <Text style={styles.val}>{methodLabelMap[method]}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Reference ID</Text>
          <Text style={styles.val}>{referenceId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Deposit amount</Text>
          <Text style={styles.val}>{formatFromUsd(amount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Fee</Text>
          <Text style={styles.val}>{formatFromUsd(feeUsd)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Total debit</Text>
          <Text style={styles.totalVal}>{formatFromUsd(amount + feeUsd)}</Text>
        </View>
      </GlassCard>

      <AppButton title="Go to home" onPress={() => navigation.navigate('MainTabs')} />
      <AppButton
        title="View activity"
        variant="ghost"
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate('Activity')}
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
    fontSize: 14,
    maxWidth: '60%',
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
  },
  secondaryBtn: {
    marginTop: spacing.md,
  },
});
