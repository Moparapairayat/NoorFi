import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, requestPasswordResetOtp, resetPassword } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { useAuthEntrance, useAuthLayout } from './useAuthUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const RESEND_SECONDS = 45;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatTimer(seconds: number): string {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  return `${mins}:${sec}`;
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { isCompact } = useAuthLayout();
  const { heroStyle, contentStyle, footerStyle } = useAuthEntrance(35);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedOtp = useMemo(() => otp.replace(/\D/g, '').slice(0, 6), [otp]);
  const normalizedPassword = useMemo(() => password.trim(), [password]);
  const normalizedPasswordConfirmation = useMemo(
    () => passwordConfirmation.trim(),
    [passwordConfirmation]
  );

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendIn((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendIn]);

  const emailError =
    emailTouched && normalizedEmail.length > 0 && !isValidEmail(normalizedEmail)
      ? 'Enter a valid email address.'
      : null;
  const passwordError =
    normalizedPassword.length > 0 && normalizedPassword.length < 8
      ? 'Password must be at least 8 characters.'
      : null;
  const passwordConfirmError =
    normalizedPasswordConfirmation.length > 0 &&
    normalizedPassword !== normalizedPasswordConfirmation
      ? 'Password confirmation does not match.'
      : null;

  const canSendOtp = isValidEmail(normalizedEmail) && !sendingOtp && !resetting;
  const canReset =
    otpSent &&
    normalizedOtp.length === 6 &&
    normalizedPassword.length >= 8 &&
    normalizedPasswordConfirmation.length >= 8 &&
    normalizedPassword === normalizedPasswordConfirmation &&
    !resetting &&
    !sendingOtp;

  const onSendOtp = async () => {
    if (!canSendOtp) {
      setEmailTouched(true);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setSendingOtp(true);

    try {
      await requestPasswordResetOtp(normalizedEmail);
      setOtpSent(true);
      setResendIn(RESEND_SECONDS);
      setSuccessMessage('OTP sent. Check your email and enter the 6 digit code.');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Unable to send OTP. Please try again.'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const onResend = async () => {
    if (!canSendOtp || resendIn > 0) {
      return;
    }
    await onSendOtp();
  };

  const onResetPassword = async () => {
    if (!canReset) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setResetting(true);

    try {
      await resetPassword({
        email: normalizedEmail,
        code: normalizedOtp,
        password: normalizedPassword,
        password_confirmation: normalizedPasswordConfirmation,
      });
      navigation.replace('Login');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Unable to reset password. Please try again.'
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <Screen scroll>
      <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.topTitle}>Forgot password</Text>
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
            Reset login password
          </Text>
          <Text style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}>
            Verify email with OTP and set a new secure password.
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={contentStyle}>
        <GlassCard style={[styles.formCard, isCompact && styles.formCardCompact]}>
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

          <View style={styles.rowActions}>
            <AppButton
              disabled={!canSendOtp}
              onPress={onSendOtp}
              title={sendingOtp ? 'Sending OTP...' : otpSent ? 'Send again' : 'Send OTP'}
              style={styles.halfButton}
            />
            {otpSent ? (
              <Pressable
                onPress={onResend}
                style={({ pressed }) => [styles.resendWrap, pressed && styles.linkPressed]}
              >
                <Text style={[styles.resendText, resendIn > 0 && styles.resendTextMuted]}>
                  {resendIn > 0 ? `Resend in ${formatTimer(resendIn)}` : 'Resend OTP'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.resendPlaceholder} />
            )}
          </View>

          {otpSent ? (
            <>
              <AppInput
                keyboardType="number-pad"
                label="OTP code"
                leftAdornment={<Ionicons color={colors.textMuted} name="keypad-outline" size={17} />}
                maxLength={6}
                onChangeText={setOtp}
                placeholder="6 digit OTP"
                required
                value={otp}
                wrapperStyle={styles.fieldGap}
              />
              <AppInput
                autoCapitalize="none"
                autoComplete="new-password"
                label="New password"
                leftAdornment={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={17} />}
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
                required
                rightAdornment={
                  <Ionicons
                    color={colors.textMuted}
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                  />
                }
                onRightAdornmentPress={() => setShowPassword((v) => !v)}
                secureTextEntry={!showPassword}
                value={password}
                wrapperStyle={styles.fieldGap}
                errorText={passwordError}
              />
              <AppInput
                autoCapitalize="none"
                autoComplete="new-password"
                label="Confirm new password"
                leftAdornment={<Ionicons color={colors.textMuted} name="checkmark-done-outline" size={17} />}
                onChangeText={setPasswordConfirmation}
                placeholder="Retype password"
                required
                rightAdornment={
                  <Ionicons
                    color={colors.textMuted}
                    name={showPasswordConfirmation ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                  />
                }
                onRightAdornmentPress={() => setShowPasswordConfirmation((v) => !v)}
                secureTextEntry={!showPasswordConfirmation}
                value={passwordConfirmation}
                wrapperStyle={styles.fieldGap}
                errorText={passwordConfirmError}
              />
            </>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        </GlassCard>
      </Animated.View>

      <Animated.View style={[styles.footer, footerStyle]}>
        {otpSent ? (
          <AppButton
            disabled={!canReset}
            onPress={onResetPassword}
            title={resetting ? 'Resetting...' : 'Reset password'}
          />
        ) : null}
      </Animated.View>
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
  topRowCompact: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
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
  formCard: {
    marginBottom: spacing.lg,
  },
  formCardCompact: {
    marginBottom: spacing.md,
  },
  rowActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  halfButton: {
    minHeight: 46,
    width: '48%',
  },
  resendWrap: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resendPlaceholder: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  resendText: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  resendTextMuted: {
    color: colors.textMuted,
  },
  linkPressed: pressStyles.text,
  fieldGap: {
    marginTop: spacing.md,
  },
  footer: {
    marginBottom: spacing.xl,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  successText: {
    color: colors.success,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
