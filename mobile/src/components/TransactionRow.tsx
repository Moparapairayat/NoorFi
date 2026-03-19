import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useWallet } from '../context/WalletContext';
import { TransactionItem } from '../data/mocks';
import { colors, radius, spacing, typography } from '../theme';

type TransactionRowProps = {
  item: TransactionItem;
};

function parseUsdAmount(raw: string): number {
  const normalized = raw.replace(/,/g, '').trim();
  const sign = normalized.startsWith('-') ? -1 : 1;
  const matched = normalized.match(/(\d+(\.\d+)?)/);
  const value = Number(matched?.[1] ?? 0);
  return sign * value;
}

export function TransactionRow({ item }: TransactionRowProps) {
  const { formatFromUsd } = useWallet();
  const isCredit = item.type === 'credit';
  const amountUsd = parseUsdAmount(item.amount);

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, isCredit ? styles.iconWrapCredit : styles.iconWrapDebit]}>
        <Ionicons
          color={isCredit ? colors.success : colors.primary}
          name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
          size={18}
        />
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
      <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]}>
        {formatFromUsd(amountUsd, true)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 42,
  },
  iconWrapCredit: {
    backgroundColor: 'rgba(29, 169, 111, 0.12)',
  },
  iconWrapDebit: {
    backgroundColor: 'rgba(225, 61, 88, 0.11)',
  },
  meta: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontFamily: typography.bodyBold,
    fontSize: 15,
  },
  credit: {
    color: colors.success,
  },
  debit: {
    color: colors.primary,
  },
});
