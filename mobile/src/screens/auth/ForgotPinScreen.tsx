import React, { useMemo, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, requestOtp } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { useAuthEntrance, useAuthLayout } from './useAuthUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPin'>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function ForgotPinScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isCompact } = useAuthLayout();
  const { heroStyle, contentStyle, footerStyle } = useAuthEntrance(35);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailError =
    emailTouched && normalizedEmail.length > 0 && !isValidEmail(normalizedEmail)
      ? 'Enter a valid email address.'
      : null;
  const canContinue = isValidEmail(normalizedEmail) && !loading;

  const onContinue = async () => {
    if (!canContinue) {
      setEmailTouched(true);
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await requestOtp({
        email: normalizedEmail,
        flow: 'recovery',
      });

      navigation.navigate('Otp', {
        email: normalizedEmail,
        flow: 'recovery',
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Unable to send OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen withPadding>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardLayer}
      >
        <View style={[styles.container, isCompact && styles.containerCompact]}>
          <View>
            <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              >
                <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
              </Pressable>
              <Text style={styles.topTitle}>Recover PIN</Text>
              <View style={styles.iconPlaceholder} />
            </View>

            <Animated.View style={heroStyle}>
              <LinearGradient
                colors={['#10392D', '#195A43', '#257356']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[styles.heroCard, isCompact && styles.heroCardCompact]}
              >
                <Text style={styles.heroOverline}>Account recovery</Text>
                <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                  Reset transaction PIN
                </Text>
                <Text style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}>
                  Step 1 of 2. Confirm your registered email, then verify OTP.
                </Text>
              </LinearGradient>
            </Animated.View>

            <Animated.View style={contentStyle}>
              <GlassCard style={[styles.progressCard, isCompact && styles.progressCardCompact]}>
                <View style={styles.progressRow}>
                  <View style={[styles.progressPill, styles.progressPillActive]}>
                    <Text style={[styles.progressPillText, styles.progressPillTextActive]}>Email</Text>
                  </View>
                  <View style={styles.progressPill}>
                    <Text style={styles.progressPillText}>OTP + New PIN</Text>
                  </View>
                </View>
              </GlassCard>

              <GlassCard style={styles.formCard}>
                <AppInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  label="Registered email"
                  leftAdornment={<Ionicons color={colors.textMuted} name="mail-outline" size={17} />}
                  onBlur={() => setEmailTouched(true)}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  required
                  value={email}
                  errorText={emailError}
                />
              </GlassCard>
            </Animated.View>
          </View>

          <Animated.View style={[styles.footer, isCompact && styles.footerCompact, footerStyle]}>
            <AppButton
              disabled={!canContinue}
              onPress={onContinue}
              title={loading ? 'Sending OTP...' : 'Send verification code'}
            />
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardLayer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xl,
  },
  containerCompact: {
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  topRowCompact: {
    marginBottom: spacing.lg,
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
  topTitle: {
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
    padding: spacing.xl,
  },
  heroCardCompact: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  heroOverline: {
    color: '#EED8A7',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: 4,
  },
  heroTitleCompact: {
    fontSize: 20,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  heroSubtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  progressCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
  },
  progressCardCompact: {
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressPill: {
    alignItems: 'center',
    backgroundColor: '#EEF4F0',
    borderColor: '#DCE9E1',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 7,
  },
  progressPillActive: {
    backgroundColor: '#1B684C',
    borderColor: '#1A664B',
  },
  progressPillText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  progressPillTextActive: {
    color: '#F7FCF8',
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  footer: {
    gap: spacing.md,
  },
  footerCompact: {
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
  },
});
