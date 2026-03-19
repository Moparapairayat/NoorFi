import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography, pressStyles } from '../theme';

type QuickActionProps = {
  label: string;
  icon: string;
  onPress?: () => void;
};

export function QuickAction({ label, icon, onPress }: QuickActionProps) {
  return (
    <Pressable
      android_ripple={
        Platform.OS === 'android'
          ? { color: 'rgba(20, 84, 61, 0.12)', borderless: false }
          : undefined
      }
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <Ionicons name={icon as never} size={20} color={colors.primaryDark} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minWidth: '22%',
    paddingVertical: spacing.lg,
    shadowColor: '#0F2E22',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pressed: pressStyles.button,
  label: {
    color: colors.primaryDark,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
});
