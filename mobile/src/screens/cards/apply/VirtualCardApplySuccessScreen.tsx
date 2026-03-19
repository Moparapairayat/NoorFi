import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../../components/AppButton';
import { CardPreview } from '../../../components/CardPreview';
import { GlassCard } from '../../../components/GlassCard';
import { Screen } from '../../../components/Screen';
import { colors, radius, spacing, typography, pressStyles } from '../../../theme';
import { RootStackParamList } from '../../../types/navigation';
import { ApplyFlowHeader } from './components/ApplyFlowHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'VirtualCardApplySuccess'>;

export function VirtualCardApplySuccessScreen({ navigation, route }: Props) {
  return (
    <Screen scroll>
      <ApplyFlowHeader
        onBack={() => navigation.navigate('MainTabs')}
        step={4}
        subtitle="Your NoorFi virtual card is now active"
        title="Completed"
        totalSteps={4}
      />

      <GlassCard style={styles.heroCard}>
        <View style={styles.successIconWrap}>
          <Ionicons color={colors.success} name="checkmark" size={26} />
        </View>
        <View style={styles.heroMeta}>
          <Text style={styles.title}>Virtual card issued</Text>
          <Text style={styles.subtitle}>Ready for online payments and wallet linking.</Text>
        </View>
      </GlassCard>

      <CardPreview
        chipStyle={route.params.chipStyle}
        holderName={route.params.holderName}
        orientation="landscape"
        showChip={false}
        style={styles.cardPreview}
        theme={route.params.theme}
      />

      <GlassCard style={styles.summary}>
        <View style={styles.line}>
          <Text style={styles.key}>Card name</Text>
          <Text style={styles.val}>{route.params.cardName}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.key}>Card ending</Text>
          <Text style={styles.val}>**** {route.params.last4}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.key}>Network</Text>
          <Text style={styles.val}>MASTERCARD</Text>
        </View>
        <View style={styles.lineLast}>
          <Text style={styles.key}>Status</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.tipCard}>
        <Ionicons color={colors.primary} name="shield-checkmark-outline" size={16} />
        <Text style={styles.tipText}>Card number and CVV stay hidden until you open card details.</Text>
      </GlassCard>

      <View style={styles.actions}>
        <AppButton
          title="View card details"
          onPress={() => navigation.replace('CardDetails', { cardId: route.params.cardId })}
        />
        <Pressable
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
        >
          <Text style={styles.ghostBtnText}>Back to cards</Text>
        </Pressable>
      </View>

      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  successIconWrap: {
    alignItems: 'center',
    backgroundColor: '#E8FAF1',
    borderColor: '#BDE9D1',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  heroMeta: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 20,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
  cardPreview: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
    maxWidth: 350,
    width: '95%',
  },
  summary: {
    marginBottom: spacing.lg,
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
  statusPill: {
    alignItems: 'center',
    backgroundColor: '#EAF9F1',
    borderColor: '#C9ECD8',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 24,
    paddingHorizontal: 8,
  },
  statusDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  statusText: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  tipCard: {
    alignItems: 'center',
    backgroundColor: '#F5FAF7',
    borderColor: '#CFE5D7',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tipText: {
    color: colors.primaryDark,
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    gap: spacing.md,
  },
  ghostBtn: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  ghostBtnPressed: pressStyles.button,
  ghostBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  footerSpace: {
    height: spacing.xl,
  },
});
