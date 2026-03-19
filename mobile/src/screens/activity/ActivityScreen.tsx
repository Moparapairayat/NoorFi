import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { TransactionRow } from '../../components/TransactionRow';
import { WalletSelector } from '../../components/WalletSelector';
import { useWallet } from '../../context/WalletContext';
import { TransactionItem } from '../../data/mocks';
import { ApiError, getTransactions, TransactionRecord } from '../../services/api';
import { colors, radius, spacing, typography, pressStyles } from '../../theme';

type ActivityFilter = 'all' | 'card' | 'transfer' | 'topup' | 'sadaqah';

const filterList: { id: ActivityFilter; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'All' },
  { id: 'card', label: 'Card' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'topup', label: 'Top up' },
  { id: 'sadaqah', label: 'Sadaqah', icon: 'heart-outline' },
];

const currencyRate: Record<string, number> = {
  usd: 1,
  usdt: 1,
  sol: 170,
};

function toUsd(currency: string, amount: number): number {
  return amount * (currencyRate[currency.toLowerCase()] ?? 1);
}

function txCategory(type: string): ActivityFilter {
  if (type.startsWith('card')) return 'card';
  if (type === 'send' || type === 'receive') return 'transfer';
  if (type === 'deposit') return 'topup';
  if (type === 'sadaqah' || type === 'charity') return 'sadaqah';
  return 'all';
}

function toTitle(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSubtitle(isoDate: string | null): string {
  if (!isoDate) {
    return 'Recently';
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mapTxToRowItem(item: TransactionRecord): TransactionItem {
  const usdAmount = toUsd(item.currency, item.amount);
  const signed = item.direction === 'credit' ? usdAmount : -usdAmount;
  const amountLabel = `${signed >= 0 ? '+' : '-'}$${Math.abs(signed).toFixed(2)}`;

  return {
    id: String(item.id),
    title: item.description?.trim() || toTitle(item.type),
    subtitle: formatSubtitle(item.occurred_at ?? item.created_at),
    amount: amountLabel,
    type: item.direction === 'credit' ? 'credit' : 'debit',
  };
}

function isSameDay(date: Date, now: Date): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function ActivityScreen() {
  const { formatFromUsd } = useWallet();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasFocusedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadActivity = useCallback(async (forceRefresh: boolean, withLoader: boolean) => {
    const requestId = ++requestIdRef.current;
    setErrorMessage(null);

    if (withLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await getTransactions({ perPage: 50, forceRefresh });
      if (requestId !== requestIdRef.current) {
        return;
      }
      setTransactions(response.data);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Unable to load activity from backend.'
      );
      setTransactions([]);
    } finally {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (withLoader) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const isInitialFocus = !hasFocusedRef.current;
      hasFocusedRef.current = true;

      void loadActivity(!isInitialFocus, isInitialFocus);

      return undefined;
    }, [loadActivity])
  );

  const filtered = useMemo(() => {
    if (filter === 'all') {
      return transactions;
    }

    return transactions.filter((item) => txCategory(item.type) === filter);
  }, [filter, transactions]);

  const rowItems = useMemo(() => filtered.map(mapTxToRowItem), [filtered]);

  const todayCount = useMemo(() => {
    const now = new Date();
    return transactions.filter((item) => {
      const stamp = item.occurred_at ?? item.created_at;
      if (!stamp) return false;
      const date = new Date(stamp);
      if (Number.isNaN(date.getTime())) return false;
      return isSameDay(date, now);
    }).length;
  }, [transactions]);

  const transferVolumeUsd = useMemo(() => {
    return transactions
      .filter((item) => item.type === 'send' || item.type === 'receive')
      .reduce((sum, item) => sum + toUsd(item.currency, Math.abs(item.amount)), 0);
  }, [transactions]);

  const sadaqahVolumeUsd = useMemo(() => {
    return transactions
      .filter((item) => txCategory(item.type) === 'sadaqah')
      .reduce((sum, item) => sum + toUsd(item.currency, Math.abs(item.amount)), 0);
  }, [transactions]);

  return (
    <Screen scroll>
      <WalletSelector style={styles.walletSelector} />
      <LinearGradient
        colors={['#113A2E', '#1A5B43', '#247254']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroPatternOne} />
        <View style={styles.heroPatternTwo} />
        <Text style={styles.heroOverline}>NoorFi ledger</Text>
        <Text style={styles.title}>Send & Activity</Text>
        <Text style={styles.subtitle}>Every transfer, deposit and exchange in one timeline.</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Today</Text>
            <Text style={styles.heroStatValue}>{todayCount} entries</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Transfers</Text>
            <Text style={styles.heroStatValue}>{formatFromUsd(transferVolumeUsd)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Sadaqah</Text>
            <Text style={styles.heroStatValue}>{formatFromUsd(sadaqahVolumeUsd)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filters}>
        {filterList.map((item) => {
          const active = filter === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              {item.icon ? <Ionicons color={colors.textSecondary} name={item.icon} size={12} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading || refreshing ? (
        <Text style={styles.metaText}>{loading ? 'Syncing activity...' : 'Refreshing activity...'}</Text>
      ) : null}
      {errorMessage ? <Text style={styles.metaError}>{errorMessage}</Text> : null}

      <GlassCard style={styles.listCard}>
        {rowItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons color={colors.textMuted} name="receipt-outline" size={18} />
            <Text style={styles.emptyTitle}>No activity found</Text>
            <Text style={styles.emptyMeta}>Try a different filter or perform a new transaction.</Text>
          </View>
        ) : (
          rowItems.map((item) => <TransactionRow key={item.id} item={item} />)
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  walletSelector: {
    marginTop: spacing.lg,
  },
  heroCard: {
    borderColor: '#2F7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroPatternOne: {
    backgroundColor: 'rgba(237, 220, 182, 0.12)',
    borderRadius: radius.pill,
    height: 130,
    position: 'absolute',
    right: -32,
    top: -36,
    width: 130,
  },
  heroPatternTwo: {
    borderColor: 'rgba(237, 220, 182, 0.22)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 78,
    position: 'absolute',
    right: 14,
    top: 10,
    width: 62,
  },
  heroOverline: {
    color: '#EFDDB8',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4FBF6',
    fontFamily: typography.display,
    fontSize: 34,
    letterSpacing: -0.7,
    marginTop: 1,
  },
  subtitle: {
    color: 'rgba(237, 244, 240, 0.86)',
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  heroStats: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 30, 23, 0.35)',
    borderColor: 'rgba(238, 219, 178, 0.18)',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatLabel: {
    color: 'rgba(219, 232, 225, 0.78)',
    fontFamily: typography.body,
    fontSize: 10,
  },
  heroStatValue: {
    color: '#F7FCF9',
    fontFamily: typography.bodyBold,
    fontSize: 12,
    marginTop: 3,
  },
  heroDivider: {
    backgroundColor: 'rgba(238, 219, 178, 0.22)',
    height: 24,
    width: 1,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipPressed: pressStyles.chip,
  metaText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  metaError: {
    color: colors.warning,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  listCard: {
    borderColor: '#D5E2DA',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  emptyMeta: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
});
