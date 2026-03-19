import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, requestOtp, verifyOtp, warmupSessionData } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { useAuthEntrance, useAuthLayout } from './useAuthUi';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;

function formatTimer(seconds: number): string {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  return `${mins}:${sec}`;
}

function maskEmail(value: string): string {
  const email = value.trim();
  const [name, domain] = email.split('@');
  if (!name || !domain) {
    return email;
  }

  if (name.length <= 2) {
    return `${name[0] ?? '*'}*@${domain}`;
  }

  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 6))}${name[name.length - 1]}@${domain}`;
}

export function OtpScreen({ navigation, route }: Props) {
  const { flow, fullName, email, phoneNumber, password, passwordConfirmation } = route.params;
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const autoSubmittedCodeRef = useRef<string | null>(null);
  const { isCompact } = useAuthLayout();
  const { heroStyle, contentStyle, footerStyle } = useAuthEntrance(40);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 220);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendIn((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendIn]);

  const flowMeta = useMemo(() => {
    if (flow === 'signup') {
      return {
        overline: 'Step 2 of 3',
        title: 'Verify your email',
        subtitle: `We sent a 6 digit code to ${maskEmail(email)} for ${fullName ?? 'your NoorFi account'}.`,
        chips: ['Profile', 'Verify', 'Set PIN'],
        activeChip: 1,
      };
    }

    if (flow === 'recovery') {
      return {
        overline: 'Step 2 of 2',
        title: 'Recovery verification',
        subtitle: `Confirm the secure OTP sent to ${maskEmail(email)} before resetting PIN.`,
        chips: ['Email', 'OTP + New PIN'],
        activeChip: 1,
      };
    }

    return {
      overline: 'Secure sign in',
      title: 'Enter verification code',
      subtitle: `A secure 6 digit OTP was sent to ${maskEmail(email)}.`,
      chips: ['Verify', 'Access'],
      activeChip: 0,
    };
  }, [flow, fullName, email]);

  const canVerify = otp.length === OTP_LENGTH && !loading;

  const onVerify = async () => {
    if (!canVerify) {
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await verifyOtp({
        email,
        flow,
        code: otp,
        full_name: fullName,
        phone_number: flow === 'signup' ? phoneNumber : undefined,
        password: flow === 'signup' ? password : undefined,
        password_confirmation: flow === 'signup' ? passwordConfirmation : undefined,
      });
      void warmupSessionData();

      if (flow === 'login' && !response.requires_pin_setup) {
        navigation.replace('MainTabs');
        return;
      }

      navigation.navigate('SetPin', {
        flow,
        fullName,
        email,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'OTP verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const onChangeOtp = (value: string) => {
    const normalized = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(normalized);
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  useEffect(() => {
    if (otp.length !== OTP_LENGTH) {
      autoSubmittedCodeRef.current = null;
      return;
    }

    if (loading || autoSubmittedCodeRef.current === otp) {
      return;
    }

    autoSubmittedCodeRef.current = otp;
    void onVerify();
  }, [otp, loading]);

  const onResend = async () => {
    if (resendIn > 0 || resending) {
      return;
    }

    setErrorMessage(null);
    setResending(true);

    try {
      await requestOtp({
        email,
        flow,
        phone_number: flow === 'signup' ? phoneNumber : undefined,
      });
      setOtp('');
      setResendIn(RESEND_SECONDS);
      inputRef.current?.focus();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to resend OTP right now.');
    } finally {
      setResending(false);
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
              <Text style={styles.topTitle}>OTP verification</Text>
              <View style={styles.iconPlaceholder} />
            </View>

            <Animated.View style={heroStyle}>
              <LinearGradient
                colors={['#10392D', '#195B43', '#257357']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[styles.heroCard, isCompact && styles.heroCardCompact]}
              >
                <View style={styles.heroIconWrap}>
                  <Ionicons color="#EED8A7" name="keypad-outline" size={18} />
                </View>
                <Text style={styles.heroOverline}>{flowMeta.overline}</Text>
                <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>{flowMeta.title}</Text>
                <Text style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}>{flowMeta.subtitle}</Text>
              </LinearGradient>
            </Animated.View>

            <Animated.View style={contentStyle}>
              <GlassCard style={[styles.progressCard, isCompact && styles.progressCardCompact]}>
                <View style={styles.progressRow}>
                  {flowMeta.chips.map((chip, index) => (
                    <View
                      key={chip}
                      style={[styles.progressPill, index === flowMeta.activeChip && styles.progressPillActive]}
                    >
                      <Text
                        style={[
                          styles.progressPillText,
                          index === flowMeta.activeChip && styles.progressPillTextActive,
                        ]}
                      >
                        {chip}
                      </Text>
                    </View>
                  ))}
                </View>
              </GlassCard>

              <GlassCard style={[styles.pinWrap, isCompact && styles.pinWrapCompact]}>
                <View style={styles.pinInputWrap}>
                  <Pressable
                    onPress={() => inputRef.current?.focus()}
                    style={({ pressed }) => [styles.pinRow, pressed && styles.pinRowPressed]}
                  >
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                      const digit = otp[index];
                      const isActive = index === otp.length && otp.length < OTP_LENGTH;

                      return (
                        <View key={index} style={[styles.pinBox, isActive && styles.pinBoxActive]}>
                          <Text style={styles.pinValue}>{digit ?? ''}</Text>
                        </View>
                      );
                    })}
                  </Pressable>
                  <TextInput
                    autoComplete="sms-otp"
                    autoFocus
                    caretHidden
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    onChangeText={onChangeOtp}
                    ref={inputRef}
                    style={styles.hiddenInput}
                    textContentType="oneTimeCode"
                    value={otp}
                  />
                </View>
                <Text style={styles.infoText}>Code auto-verifies once all 6 digits are entered.</Text>

                <View style={styles.metaRow}>
                  <Pressable
                    onPress={onResend}
                    style={({ pressed }) => [styles.metaBtn, pressed && styles.metaBtnPressed]}
                  >
                    <Text style={[styles.metaBtnText, resendIn > 0 && styles.metaBtnDisabled]}>
                      {resending
                        ? 'Resending...'
                        : resendIn > 0
                        ? `Resend in ${formatTimer(resendIn)}`
                        : 'Resend code'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [styles.metaBtn, pressed && styles.metaBtnPressed]}
                  >
                    <Text style={styles.metaBtnText}>Edit email</Text>
                  </Pressable>
                </View>
              </GlassCard>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </Animated.View>
          </View>

          <Animated.View style={[styles.footer, isCompact && styles.footerCompact, footerStyle]}>
            <AppButton
              disabled={!canVerify}
              onPress={onVerify}
              title={loading ? 'Verifying...' : flow === 'login' ? 'Verify & continue' : 'Verify code'}
            />
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
    alignItems: 'center',
    borderColor: '#2E7B5E',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroCardCompact: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  heroIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(14, 44, 34, 0.45)',
    borderColor: 'rgba(238, 216, 167, 0.4)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 40,
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
    fontSize: 22,
    marginTop: 3,
    textAlign: 'center',
  },
  heroTitleCompact: {
    fontSize: 20,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 239, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: 'center',
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
  pinWrap: {
    marginBottom: spacing.lg,
  },
  pinWrapCompact: {
    marginBottom: spacing.md,
  },
  pinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pinRowPressed: pressStyles.row,
  pinInputWrap: {
    minHeight: 54,
    position: 'relative',
  },
  pinBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
  },
  pinBoxActive: {
    borderColor: colors.primary,
  },
  pinValue: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 22,
  },
  hiddenInput: {
    bottom: 0,
    color: 'transparent',
    left: 0,
    opacity: 0.02,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  infoText: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  metaBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metaBtnPressed: pressStyles.text,
  metaBtnText: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  metaBtnDisabled: {
    color: colors.textMuted,
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
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
