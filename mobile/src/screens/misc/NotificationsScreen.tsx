import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { notifications } from '../../data/mocks';
import { colors, radius, spacing, typography, pressStyles } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>NoorFi notifications</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#113A2E', '#1A5A43', '#247255']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Text style={styles.heroOverline}>Security feed</Text>
        <Text style={styles.heroTitle}>Stay informed</Text>
        <Text style={styles.heroSubtitle}>Get updates on transfers, card events and verification alerts.</Text>
      </LinearGradient>

      <GlassCard style={styles.listCard}>
        {notifications.map((item, index) => (
          <View key={item.id} style={[styles.item, index === notifications.length - 1 && styles.itemLast]}>
            <View style={styles.dot} />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemText}>{item.body}</Text>
            </View>
            <Text style={styles.time}>{item.time}</Text>
          </View>
        ))}
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
    borderColor: '#2F7A5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroShapeOne: {
    backgroundColor: 'rgba(237, 220, 183, 0.16)',
    borderRadius: radius.pill,
    height: 110,
    position: 'absolute',
    right: -24,
    top: -28,
    width: 110,
  },
  heroShapeTwo: {
    borderColor: 'rgba(237, 220, 183, 0.22)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 66,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 52,
  },
  heroOverline: {
    color: '#ECDCB9',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 23,
    marginTop: 3,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 239, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    maxWidth: '84%',
  },
  listCard: {
    borderColor: '#D5E2DA',
  },
  item: {
    alignItems: 'flex-start',
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  itemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    marginRight: spacing.md,
    marginTop: 8,
    width: 8,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  itemText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginLeft: spacing.sm,
  },
});
