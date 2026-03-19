import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { useWallet } from '../../context/WalletContext';
import { ApiError, getWallets } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, WalletId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Assets'>;

function formatNativeAmount(value: number, unit: string, decimals: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);

  return `${unit} ${formatted}`;
}

function formatUsd(usdAmount: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(usdAmount);
}

export function AssetsScreen({ navigation }: Props) {
  const { wallets, selectedWallet, setSelectedWallet } = useWallet();
  const [walletUsdBalances, setWalletUsdBalances] = useState<Record<WalletId, number>>({
    usd: 0,
    usdt: 0,
    sol: 0,
  });
  const [walletNativeBalances, setWalletNativeBalances] = useState<Record<WalletId, number>>({
    usd: 0,
    usdt: 0,
    sol: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      setLoadingData(true);

      try {
        const response = await getWallets();
        const nextUsd: Record<WalletId, number> = { usd: 0, usdt: 0, sol: 0 };
        const nextNative: Record<WalletId, number> = { usd: 0, usdt: 0, sol: 0 };

        for (const wallet of response.wallets) {
          const key = wallet.currency.toLowerCase() as WalletId;
          if (key === 'usd' || key === 'usdt' || key === 'sol') {
            nextUsd[key] = wallet.usd_value;
            nextNative[key] = wallet.balance;
          }
        }

        setWalletUsdBalances(nextUsd);
        setWalletNativeBalances(nextNative);
      } catch (error) {
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Unable to load wallet balances from backend.'
        );
      } finally {
        setLoadingData(false);
      }
    };

    void load();
  }, []);

  const totalUsd = useMemo(
    () => wallets.reduce((sum, wallet) => sum + walletUsdBalances[wallet.id], 0),
    [wallets]
  );
  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWallet) ?? wallets[0],
    [wallets, selectedWallet]
  );
  const fiatUsd = walletUsdBalances.usd;
  const cryptoUsd = walletUsdBalances.usdt + walletUsdBalances.sol;
  const walletDistribution = useMemo(
    () =>
      wallets.map((wallet) => {
        const usd = walletUsdBalances[wallet.id];
        const share = totalUsd > 0 ? (usd / totalUsd) * 100 : 0;
        return {
          id: wallet.id,
          label: wallet.shortLabel,
          usd,
          share,
        };
      }),
    [wallets, totalUsd]
  );
  const segmentColorByWallet: Record<WalletId, string> = {
    usd: '#1F7A58',
    usdt: '#B2842E',
    sol: '#3D5CB9',
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
        <Text style={styles.title}>All assets</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#10392D', '#195A43', '#257356']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Text style={styles.heroOverline}>Multi currency</Text>
        <Text style={styles.heroTitle}>Wallet portfolio</Text>
        <Text style={styles.heroSubtitle}>Track all wallet balances in one place.</Text>
        <Text style={styles.heroAmount}>USD {formatUsd(totalUsd)}</Text>
        {loadingData ? <Text style={styles.heroHint}>Syncing balances...</Text> : null}
        {loadError ? <Text style={styles.heroHintError}>{loadError}</Text> : null}

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaChip}>
            <Text style={styles.heroMetaLabel}>Wallets</Text>
            <Text style={styles.heroMetaValue}>{wallets.length}</Text>
          </View>
          <View style={styles.heroMetaChip}>
            <Text style={styles.heroMetaLabel}>Active</Text>
            <Text style={styles.heroMetaValue}>{activeWallet.shortLabel}</Text>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <Pressable
            onPress={() => navigation.navigate('TopUp')}
            style={({ pressed }) => [styles.heroActionBtn, pressed && styles.heroActionBtnPressed]}
          >
            <Ionicons color="#EEDDB8" name="add-outline" size={14} />
            <Text style={styles.heroActionText}>Deposit</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Activity')}
            style={({ pressed }) => [styles.heroActionBtn, pressed && styles.heroActionBtnPressed]}
          >
            <Ionicons color="#EEDDB8" name="time-outline" size={14} />
            <Text style={styles.heroActionText}>History</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <GlassCard style={styles.mixCard}>
        <View style={styles.mixHead}>
          <Text style={styles.sectionTitle}>Asset allocation</Text>
          <Text style={styles.mixHeadMeta}>USD base</Text>
        </View>
        <View style={styles.mixTrack}>
          {walletDistribution.map((item) => (
            <View
              key={item.id}
              style={[
                styles.mixSegment,
                { backgroundColor: segmentColorByWallet[item.id], width: `${Math.max(item.share, 6)}%` },
              ]}
            />
          ))}
        </View>
        <View style={styles.mixLegendRow}>
          {walletDistribution.map((item) => (
            <View key={item.id} style={styles.mixLegendItem}>
              <View style={[styles.mixLegendDot, { backgroundColor: segmentColorByWallet[item.id] }]} />
              <Text style={styles.mixLegendText}>
                {item.label} {item.share.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.mixFootRow}>
          <Text style={styles.mixFootText}>Fiat: USD {formatUsd(fiatUsd)}</Text>
          <Text style={styles.mixFootText}>Crypto: USD {formatUsd(cryptoUsd)}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.walletHead}>
          <Text style={styles.sectionTitle}>Currency wallets</Text>
          <Text style={styles.walletHeadMeta}>Tap to set active</Text>
        </View>

        {wallets.map((wallet, index) => {
          const isActive = selectedWallet === wallet.id;
          const walletUsd = walletUsdBalances[wallet.id];
          const share = totalUsd > 0 ? (walletUsd / totalUsd) * 100 : 0;

          return (
            <Pressable
              key={wallet.id}
              onPress={() => setSelectedWallet(wallet.id)}
              style={({ pressed }) => [
                styles.walletRow,
                isActive && styles.walletRowActive,
                index === wallets.length - 1 && styles.walletRowLast,
                pressed && styles.walletRowPressed,
              ]}
            >
              <View style={[styles.walletIconWrap, isActive && styles.walletIconWrapActive]}>
                <Text style={[styles.walletIconText, isActive && styles.walletIconTextActive]}>
                  {wallet.shortLabel}
                </Text>
              </View>

              <View style={styles.walletMeta}>
                <Text style={styles.walletName}>{wallet.fullLabel}</Text>
                <Text style={styles.walletUsd}>USD {formatUsd(walletUsd)}</Text>
              </View>

              <View style={styles.walletRight}>
                <Text style={styles.walletNative}>
                  {formatNativeAmount(walletNativeBalances[wallet.id], wallet.unit, wallet.decimals)}
                </Text>
                <Text style={styles.walletShare}>{share.toFixed(1)}% of portfolio</Text>
                {isActive ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.complianceCard}>
        <Ionicons color={colors.primaryDark} name="shield-checkmark-outline" size={15} />
        <Text style={styles.complianceText}>
          Shariah-first multi wallet view. No interest balances, only tracked asset value.
        </Text>
      </GlassCard>
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
    fontSize: 22,
    marginTop: 3,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  heroAmount: {
    color: '#F8FCFA',
    fontFamily: typography.display,
    fontSize: 30,
    letterSpacing: -0.4,
    marginTop: spacing.md,
  },
  heroHint: {
    color: 'rgba(228, 238, 232, 0.78)',
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  heroHintError: {
    color: '#F2D28B',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroMetaChip: {
    backgroundColor: 'rgba(10, 32, 24, 0.42)',
    borderColor: 'rgba(234, 214, 173, 0.26)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  heroMetaLabel: {
    color: '#D8E8E0',
    fontFamily: typography.body,
    fontSize: 10,
  },
  heroMetaValue: {
    color: '#F2E3BF',
    fontFamily: typography.bodyBold,
    fontSize: 10,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroActionBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 32, 24, 0.42)',
    borderColor: 'rgba(234, 214, 173, 0.26)',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 32,
  },
  heroActionBtnPressed: pressStyles.micro,
  heroActionText: {
    color: '#EEDDB8',
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  mixCard: {
    marginBottom: spacing.lg,
  },
  mixHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mixHeadMeta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  mixTrack: {
    backgroundColor: '#E6ECE8',
    borderRadius: radius.pill,
    flexDirection: 'row',
    height: 10,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  mixSegment: {
    height: 10,
  },
  mixLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mixLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  mixLegendDot: {
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  mixLegendText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  mixFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  mixFootText: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 11,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  walletHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletHeadMeta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  walletRow: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  walletRowLast: {
    marginBottom: 0,
  },
  walletRowActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  walletRowPressed: pressStyles.row,
  walletIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EFF5F1',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 36,
  },
  walletIconWrapActive: {
    backgroundColor: '#DFF0E6',
  },
  walletIconText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  walletIconTextActive: {
    color: colors.primaryDark,
  },
  walletMeta: {
    flex: 1,
  },
  walletName: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  walletUsd: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  walletRight: {
    alignItems: 'flex-end',
  },
  walletNative: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  walletShare: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 10,
    marginTop: 1,
  },
  activePill: {
    backgroundColor: '#E2F3EA',
    borderColor: '#BCDCCB',
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4,
    minHeight: 20,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  activePillText: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
    fontSize: 10,
  },
  complianceCard: {
    alignItems: 'flex-start',
    backgroundColor: '#EDF7F2',
    borderColor: '#D2E8DC',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  complianceText: {
    color: '#385347',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
});
