import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  withPadding?: boolean;
};

export function Screen({
  children,
  scroll = false,
  contentStyle,
  withPadding = true,
}: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        withPadding && styles.padded,
        contentStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, withPadding && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[colors.background, colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.layer}>{body}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  layer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 128,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
  glowTop: {
    position: 'absolute',
    top: -90,
    right: -30,
    width: 210,
    height: 210,
    borderRadius: 220,
    backgroundColor: 'rgba(26, 107, 78, 0.12)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 120,
    left: -65,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(196, 154, 74, 0.1)',
  },
});
