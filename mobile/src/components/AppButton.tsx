import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, shadows, spacing, typography, pressStyles } from '../theme';

type AppButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  leftIcon,
}: AppButtonProps) {
  return (
    <Pressable
      android_ripple={
        Platform.OS === 'android'
          ? { color: 'rgba(21, 84, 61, 0.14)', borderless: false }
          : undefined
      }
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.ghost,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={
          variant === 'primary'
            ? [colors.buttonTop, colors.buttonBottom]
            : [colors.buttonGhostTop, colors.buttonGhostBottom]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFill}
      />
      {variant === 'primary' ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.primarySheen}
        />
      ) : null}
      <View style={styles.content}>
        {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
        <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.ghostLabel]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gradientFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  primarySheen: {
    height: '44%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  primary: {
    borderColor: 'rgba(212, 180, 106, 0.38)',
    ...shadows.heavy,
  },
  ghost: {
    borderColor: colors.buttonBorderStrong,
    shadowColor: '#0F2E22',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  label: {
    fontFamily: typography.bodyBold,
    fontSize: 16,
    letterSpacing: 0.2,
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  primaryLabel: {
    color: '#FAFCF8',
  },
  ghostLabel: {
    color: colors.primaryDark,
  },
  pressed: pressStyles.button,
  disabled: {
    opacity: 0.6,
  },
});
