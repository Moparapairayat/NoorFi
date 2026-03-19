import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../../components/AppButton';
import { CardPreview } from '../../../components/CardPreview';
import { GlassCard } from '../../../components/GlassCard';
import { Screen } from '../../../components/Screen';
import { WalletSelector } from '../../../components/WalletSelector';
import { ApiError, getWallets } from '../../../services/api';
import { colors, radius, spacing, typography, pressStyles } from '../../../theme';
import { RootStackParamList } from '../../../types/navigation';
import { ApplyFlowHeader } from './components/ApplyFlowHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'VirtualCardApplySetup'>;

type FundingOption = {
  id: 'usd_wallet';
  label: string;
  subtitle: string;
  eta: string;
  feeLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export function VirtualCardApplySetupScreen({ navigation, route }: Props) {
  const { cardName, holderName, theme, chipStyle, cardType } = route.params;
  const [fundingSource, setFundingSource] = useState<'usd_wallet'>('usd_wallet');
  const [usdSubtitle, setUsdSubtitle] = useState('Available balance: loading...');
  const [walletError, setWalletError] = useState<string | null>(null);

  const issueFee = 10;
  const prefundAmount = 5;
  const totalDebit = issueFee + prefundAmount;
  const isPhysicalCard = cardType === 'physical';
  const fundingOptions: FundingOption[] = [
    {
      id: 'usd_wallet',
      label: 'USD Wallet',
      subtitle: usdSubtitle,
      eta: 'Settlement: instant',
      feeLabel: 'FX fee: 0%',
      icon: 'wallet-outline',
    },
  ];
  const selectedFunding = fundingOptions.find((option) => option.id === fundingSource);

  useEffect(() => {
    let mounted = true;

    const loadWallet = async () => {
      try {
        const response = await getWallets();
        const usdWallet = response.wallets.find((wallet) => wallet.currency.toLowerCase() === 'usd');
        if (!mounted) {
          return;
        }
        if (usdWallet) {
          setUsdSubtitle(`Available balance: $${usdWallet.balance.toFixed(2)}`);
        } else {
          setUsdSubtitle('USD wallet not found');
        }
      } catch (error) {
        if (!mounted) {
          return;
        }
        setWalletError(error instanceof ApiError ? error.message : 'Unable to load wallet balance.');
        setUsdSubtitle('Unable to load balance');
      }
    };

    void loadWallet();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen scroll>
      <ApplyFlowHeader
        onBack={() => navigation.goBack()}
        step={1}
        subtitle="Choose wallet and confirm NoorFi card profile"
        title="Apply virtual card"
        totalSteps={4}
      />
      <WalletSelector style={styles.walletSelector} />

      <CardPreview
        chipStyle={chipStyle}
        holderName={holderName}
        orientation="landscape"
        showChip={isPhysicalCard}
        style={styles.cardPreview}
        theme={theme}
      />

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons color={colors.success} name="flash-outline" size={14} />
          <Text style={styles.badgeText}>Instant issue</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons color={colors.primary} name="pricetag-outline" size={14} />
          <Text style={styles.badgeText}>Total debit ${totalDebit.toFixed(2)}</Text>
        </View>
      </View>

      <GlassCard style={styles.block}>
        <Text style={styles.blockTitle}>Application profile</Text>
        <View style={styles.line}>
          <Text style={styles.key}>Card type</Text>
          <Text style={styles.val}>{cardType === 'virtual' ? 'Virtual' : 'Physical'}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.key}>Card name</Text>
          <Text style={styles.val}>{cardName}</Text>
        </View>
        <View style={styles.lineLast}>
          <Text style={styles.key}>Cardholder</Text>
          <Text style={styles.val}>{holderName.toUpperCase()}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.block}>
        <View style={styles.blockTitleRow}>
          <Text style={styles.blockTitle}>Funding source</Text>
          <View style={styles.blockHintWrap}>
            <Text style={styles.blockHint}>Required</Text>
          </View>
        </View>

        {fundingOptions.map((option) => {
          const selected = fundingSource === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => setFundingSource(option.id)}
              style={({ pressed }) => [
                styles.optionRow,
                selected && styles.optionRowSelected,
                pressed && styles.optionRowPressed,
              ]}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.optionIconWrap, selected && styles.optionIconWrapSelected]}>
                  <Ionicons
                    color={selected ? colors.primary : colors.textSecondary}
                    name={option.icon}
                    size={16}
                  />
                </View>

                <View style={styles.optionMeta}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionSub}>{option.subtitle}</Text>
                  <Text style={styles.optionMetaLine}>
                    {option.eta} | {option.feeLabel}
                  </Text>
                </View>
              </View>

              <Ionicons
                color={selected ? colors.primary : colors.textMuted}
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
              />
            </Pressable>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Ionicons color={colors.primary} name="information-circle-outline" size={16} />
        <Text style={styles.infoText}>
          {selectedFunding?.label ?? 'Wallet'} will be used for issuing fee and initial card funding.
        </Text>
      </GlassCard>

      {walletError ? <Text style={styles.errorText}>{walletError}</Text> : null}

      <AppButton
        title="Continue to security"
        onPress={() =>
          navigation.navigate('VirtualCardApplySecurity', {
            cardType,
            cardName,
            holderName,
            theme,
            chipStyle,
            fundingSource,
            issueFee,
            prefundAmount,
          })
        }
      />

      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  walletSelector: {
    marginBottom: spacing.md,
  },
  cardPreview: {
    alignSelf: 'center',
    maxWidth: 360,
    width: '95%',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#F2F7F3',
    borderColor: '#D6E1DB',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.md,
  },
  badgeText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  block: {
    marginBottom: spacing.lg,
  },
  blockTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
  },
  blockHintWrap: {
    backgroundColor: '#EAF6F0',
    borderColor: '#C7E1D1',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  blockHint: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
    fontSize: 11,
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
  optionRow: {
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
  optionRowSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  optionRowPressed: pressStyles.row,
  optionLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingRight: spacing.sm,
  },
  optionIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EDF4F0',
    borderColor: '#D8E2DC',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  optionIconWrapSelected: {
    backgroundColor: '#E5F3EB',
    borderColor: '#C7E1D1',
  },
  optionMeta: {
    flex: 1,
  },
  optionLabel: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  optionSub: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  optionMetaLine: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    marginTop: 2,
  },
  infoCard: {
    alignItems: 'center',
    backgroundColor: '#F5FAF7',
    borderColor: '#CFE5D7',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoText: {
    color: colors.primaryDark,
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footerSpace: {
    height: spacing.xl,
  },
});
