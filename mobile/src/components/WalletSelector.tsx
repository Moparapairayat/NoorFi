import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useWallet } from '../context/WalletContext';
import { colors, pressStyles, radius, spacing, typography } from '../theme';

type WalletSelectorProps = {
  style?: StyleProp<ViewStyle>;
};

export function WalletSelector({ style }: WalletSelectorProps) {
  const { selectedWallet, setSelectedWallet, wallets } = useWallet();

  return (
    <View style={[styles.wrap, style]}>
      {wallets.map((wallet) => {
        const selected = wallet.id === selectedWallet;

        return (
          <Pressable
            key={wallet.id}
            onPress={() => setSelectedWallet(wallet.id)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{wallet.shortLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.buttonSoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 3,
  },
  chip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorderStrong,
    borderWidth: 1,
  },
  chipPressed: pressStyles.chip,
  chipText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
});

