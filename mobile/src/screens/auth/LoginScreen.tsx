import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, getMe, loginWithPassword, setAccessToken, warmupSessionData } from '../../services/api';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  getBiometricDisplayName,
  getPersistedSessionToken,
  isBiometricLoginAvailable,
  persistSessionToken,
} from '../../services/security/biometric';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { useAuthEntrance, useAuthLayout } from './useAuthUi';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isCompact, isVeryCompact } = useAuthLayout();
  const { heroStyle, contentStyle, footerStyle } = useAuthEntrance();

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedPassword = useMemo(() => password.trim(), [password]);
  const emailError =
    emailTouched && normalizedEmail.length > 0 && !isValidEmail(normalizedEmail)
      ? 'Enter a valid email address.'
      : null;
  const passwordError =
    passwordTouched && normalizedPassword.length > 0 && normalizedPassword.length < 8
      ? 'Password must be at least 8 characters.'
      : null;
  const canContinue =
    isValidEmail(normalizedEmail) &&
    normalizedPassword.length >= 8 &&
    !loading &&
    !biometricLoading;

  useEffect(() => {
    let mounted = true;

    const loadBiometricState = async () => {
      try {
        const [status, capability] = await Promise.all([
          isBiometricLoginAvailable(),
          getBiometricCapability(),
        ]);
        if (!mounted) {
          return;
        }
        setBiometricSupported(capability.available);
        setBiometricAvailable(status.available);
        setBiometricLabel(getBiometricDisplayName(capability.type));
      } catch {
        if (!mounted) {
          return;
        }
        setBiometricSupported(false);
        setBiometricAvailable(false);
      }
    };

    void loadBiometricState();

    return () => {
      mounted = false;
    };
  }, []);

  const onContinue = async () => {
    if (!canContinue) {
      setEmailTouched(true);
      setPasswordTouched(true);
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await loginWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      void warmupSessionData();

      if (!response.requires_pin_setup) {
        navigation.replace('MainTabs');
        return;
      }

      navigation.navigate('SetPin', {
        flow: 'login',
        email: normalizedEmail,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
          ? error.message
          : 'Unable to login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const biometricIconName =
    biometricLabel === 'Face ID'
      ? 'scan-outline'
      : biometricLabel === 'Fingerprint'
      ? 'finger-print-outline'
      : biometricLabel === 'Iris'
      ? 'eye-outline'
      : 'shield-checkmark-outline';

  const onBiometricUnlock = async () => {
    if (biometricLoading) {
      return;
    }

    if (!biometricAvailable) {
      setErrorMessage(
        'Biometric login is not ready yet. First login with email, then enable it from Security & PIN.'
      );
      return;
    }

    setErrorMessage(null);
    setBiometricLoading(true);

    try {
      const unlocked = await authenticateWithBiometrics(`Unlock NoorFi with ${biometricLabel}`);
      if (!unlocked) {
        return;
      }

      const storedToken = await getPersistedSessionToken();
      if (!storedToken) {
        setBiometricAvailable(false);
        setErrorMessage('No saved session found. Continue with email sign in.');
        return;
      }

      setAccessToken(storedToken);

      try {
        await getMe();
      } catch {
        await persistSessionToken(null);
        setAccessToken(null);
        setBiometricAvailable(false);
        setErrorMessage('Previous session expired. Please sign in with email.');
        return;
      }

      void warmupSessionData();
      navigation.replace('MainTabs');
    } catch {
      setErrorMessage('Biometric verification failed. Please try again.');
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <Screen withPadding>
      <View style={[styles.container, isCompact && styles.containerCompact]}>
        <View>
          <Animated.View style={heroStyle}>
            <LinearGradient
              colors={['#10392D', '#195B43', '#257357']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[styles.heroCard, isCompact && styles.heroCardCompact]}
            >
              <View style={styles.heroShapeOne} />
              <View style={styles.heroShapeTwo} />
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>Secure sign in</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={contentStyle}>
            <Text
              style={[
                styles.title,
                isCompact && styles.titleCompact,
                isVeryCompact && styles.titleVeryCompact,
              ]}
            >
              Welcome back
            </Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>
              Continue to your NoorFi wallet.
            </Text>

            <GlassCard style={[styles.formCard, isCompact && styles.formCardCompact]}>
              <View style={[styles.flowPillRow, isCompact && styles.flowPillRowCompact]}>
                <View style={[styles.flowPill, styles.flowPillActive]}>
                  <Ionicons color="#F7FCF8" name="mail-outline" size={13} />
                  <Text style={[styles.flowPillText, styles.flowPillTextActive]}>Email Login</Text>
                </View>
                <View style={styles.flowPill}>
                  <Ionicons color={colors.textSecondary} name="lock-closed-outline" size={13} />
                  <Text style={styles.flowPillText}>PIN Secured</Text>
                </View>
              </View>
              <AppInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label="Email Address"
                leftAdornment={<Ionicons color={colors.textMuted} name="mail-outline" size={17} />}
                onBlur={() => setEmailTouched(true)}
                onChangeText={setEmail}
                placeholder="name@example.com"
                required
                value={email}
                errorText={emailError}
              />
              <AppInput
                autoCapitalize="none"
                autoComplete="password"
                label="Password"
                leftAdornment={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={17} />}
                onBlur={() => setPasswordTouched(true)}
                onChangeText={setPassword}
                placeholder="Enter your password"
                required
                rightAdornment={
                  <Ionicons
                    color={colors.textMuted}
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                  />
                }
                onRightAdornmentPress={() => setShowPassword((value) => !value)}
                secureTextEntry={!showPassword}
                value={password}
                wrapperStyle={styles.fieldGap}
                errorText={passwordError}
              />
              {biometricSupported ? (
                <Pressable
                  onPress={onBiometricUnlock}
                  style={({ pressed }) => [styles.biometricCard, pressed && styles.biometricCardPressed]}
                >
                  <LinearGradient
                    colors={
                      biometricAvailable
                        ? ['#E8F6EF', '#D9EFE3']
                        : ['#F4F6F5', '#E8ECEA']
                    }
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={styles.biometricGradient}
                  >
                    <View style={styles.biometricLeft}>
                      <View
                        style={[
                          styles.biometricPrimaryIconWrap,
                          biometricAvailable
                            ? styles.biometricPrimaryIconWrapActive
                            : styles.biometricPrimaryIconWrapIdle,
                        ]}
                      >
                        <Ionicons color={colors.primaryDark} name={biometricIconName as never} size={16} />
                      </View>
                      <View style={styles.biometricTextBlock}>
                        <Text style={styles.biometricTitle}>
                          {biometricAvailable ? `${biometricLabel} ready` : `Enable ${biometricLabel}`}
                        </Text>
                        <Text style={styles.biometricSubtitle}>
                          {biometricAvailable
                            ? 'Tap for instant secure unlock'
                            : 'First sign in once, then enable from Security & PIN'}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.biometricArrowWrap,
                        biometricAvailable ? styles.biometricArrowWrapActive : styles.biometricArrowWrapIdle,
                      ]}
                    >
                      <Ionicons
                        color={biometricAvailable ? '#F4FFF8' : colors.textSecondary}
                        name="arrow-forward"
                        size={14}
                      />
                    </View>
                  </LinearGradient>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => navigation.navigate('ForgotPassword')}
                style={({ pressed }) => [styles.inlineLinkWrap, pressed && styles.linkPressed]}
              >
                <Text style={styles.inlineLink}>Forgot Password?</Text>
              </Pressable>
            </GlassCard>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, isCompact && styles.footerCompact, footerStyle]}>
          <AppButton
            disabled={!canContinue}
            onPress={onContinue}
            title={loading ? 'Signing in...' : 'Sign in'}
          />
          <AppButton title="Create account" variant="ghost" onPress={() => navigation.navigate('Register')} />
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Text style={[styles.terms, isCompact && styles.termsCompact]}>
            By continuing, you agree to NoorFi terms and privacy policy.
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  containerCompact: {
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  heroCard: {
    borderColor: '#2E7B5E',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  heroCardCompact: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroShapeOne: {
    backgroundColor: 'rgba(236, 219, 180, 0.16)',
    borderRadius: 999,
    height: 72,
    position: 'absolute',
    right: -20,
    top: -22,
    width: 72,
  },
  heroShapeTwo: {
    borderColor: 'rgba(236, 219, 180, 0.23)',
    borderRadius: 999,
    borderWidth: 2,
    height: 42,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 34,
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 20,
  },
  heroTitleCompact: {
    fontSize: 18,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.display,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  titleCompact: {
    fontSize: 27,
  },
  titleVeryCompact: {
    fontSize: 24,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  subtitleCompact: {
    marginTop: spacing.xs,
  },
  formCard: {
    marginTop: spacing.xxl,
  },
  formCardCompact: {
    marginTop: spacing.lg,
  },
  flowPillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  flowPillRowCompact: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  flowPill: {
    alignItems: 'center',
    backgroundColor: '#EEF4F0',
    borderColor: '#DCE9E1',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  flowPillActive: {
    backgroundColor: '#1B684C',
    borderColor: '#1A664B',
  },
  flowPillText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  flowPillTextActive: {
    color: '#F7FCF8',
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  inlineLinkWrap: {
    alignSelf: 'flex-end',
    borderRadius: radius.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  biometricCard: {
    borderColor: '#CFE3D6',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  biometricCardPressed: pressStyles.card,
  biometricGradient: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  biometricLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
  },
  biometricPrimaryIconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  biometricPrimaryIconWrapActive: {
    backgroundColor: '#C6E6D5',
  },
  biometricPrimaryIconWrapIdle: {
    backgroundColor: '#DFE7E3',
  },
  biometricTextBlock: {
    flex: 1,
  },
  biometricTitle: {
    color: colors.primaryDark,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  biometricSubtitle: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1,
  },
  biometricArrowWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 26,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 26,
  },
  biometricArrowWrapActive: {
    backgroundColor: '#1A6B4E',
  },
  biometricArrowWrapIdle: {
    backgroundColor: '#DCE3DF',
  },
  inlineLink: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  linkPressed: pressStyles.text,
  footer: {
    gap: spacing.md,
  },
  footerCompact: {
    gap: spacing.sm,
  },
  terms: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
  },
});

