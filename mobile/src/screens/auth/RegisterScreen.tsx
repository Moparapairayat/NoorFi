import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, requestOtp } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { useAuthEntrance, useAuthLayout } from './useAuthUi';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

type CountryOption = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
};

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼' },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const compact = value.replace(/\s+/g, '').trim();
  return /^\+[1-9][0-9]{7,15}$/.test(compact);
}

function getPasswordStrength(value: string): { label: string; color: string } {
  const v = value.trim();
  if (!v.length) {
    return { label: 'Use at least 8 characters with numbers', color: colors.textMuted };
  }

  let score = 0;
  if (v.length >= 8) score += 1;
  if (/[a-z]/.test(v)) score += 1;
  if (/[A-Z]/.test(v)) score += 1;
  if (/[0-9]/.test(v)) score += 1;
  if (/[^A-Za-z0-9]/.test(v)) score += 1;

  if (score <= 2) {
    return { label: 'Weak password', color: colors.danger };
  }
  if (score <= 4) {
    return { label: 'Good password', color: colors.warning };
  }
  return { label: 'Strong password', color: colors.success };
}

export function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRY_OPTIONS[0]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySelectedManually, setCountrySelectedManually] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isCompact } = useAuthLayout();
  const { heroStyle, contentStyle, footerStyle } = useAuthEntrance(20);
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    phoneNumber: false,
    password: false,
    passwordConfirmation: false,
  });

  const normalizedFullName = useMemo(() => fullName.replace(/\s+/g, ' ').trim(), [fullName]);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedPhoneDigits = useMemo(() => phoneNumber.replace(/\D/g, ''), [phoneNumber]);
  const normalizedNationalNumber = useMemo(
    () => normalizedPhoneDigits.replace(/^0+/, ''),
    [normalizedPhoneDigits]
  );
  const normalizedPhoneNumber = useMemo(
    () => `${selectedCountry.dialCode}${normalizedNationalNumber}`,
    [selectedCountry.dialCode, normalizedNationalNumber]
  );
  const normalizedPassword = useMemo(() => password.trim(), [password]);
  const normalizedPasswordConfirmation = useMemo(
    () => passwordConfirmation.trim(),
    [passwordConfirmation]
  );
  const normalizedCountryQuery = useMemo(() => countryQuery.trim().toLowerCase(), [countryQuery]);
  const filteredCountryOptions = useMemo(() => {
    if (!normalizedCountryQuery) {
      return COUNTRY_OPTIONS;
    }

    return COUNTRY_OPTIONS.filter((country) => {
      return (
        country.name.toLowerCase().includes(normalizedCountryQuery) ||
        country.code.toLowerCase().includes(normalizedCountryQuery) ||
        country.dialCode.includes(normalizedCountryQuery)
      );
    });
  }, [normalizedCountryQuery]);
  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    let isActive = true;

    const autoDetectCountry = async () => {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled || countrySelectedManually) {
          return;
        }

        let permissionStatus = (await Location.getForegroundPermissionsAsync()).status;
        if (permissionStatus !== 'granted') {
          permissionStatus = (await Location.requestForegroundPermissionsAsync()).status;
        }
        if (permissionStatus !== 'granted' || !isActive || countrySelectedManually) {
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!isActive || countrySelectedManually) {
          return;
        }

        const geoResult = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        const detectedCode = geoResult[0]?.isoCountryCode?.toUpperCase();
        if (!detectedCode) {
          return;
        }

        const matchedCountry = COUNTRY_OPTIONS.find((option) => option.code === detectedCode);
        if (matchedCountry && isActive && !countrySelectedManually) {
          setSelectedCountry(matchedCountry);
        }
      } catch {
        // Keep default country when auto-detect is unavailable.
      }
    };

    autoDetectCountry();

    return () => {
      isActive = false;
    };
  }, [countrySelectedManually]);

  const fullNameError =
    touched.fullName && normalizedFullName.length > 0 && normalizedFullName.length < 3
      ? 'Name must be at least 3 characters.'
      : null;
  const emailError =
    touched.email && normalizedEmail.length > 0 && !isValidEmail(normalizedEmail)
      ? 'Enter a valid email address.'
      : null;
  const phoneError =
    touched.phoneNumber && normalizedNationalNumber.length > 0 && !isValidPhone(normalizedPhoneNumber)
      ? 'Enter a valid mobile number with country code.'
      : null;
  const mobileErrorText =
    touched.phoneNumber && normalizedNationalNumber.length === 0
      ? 'Mobile number is required.'
      : phoneError;
  const passwordError =
    touched.password && normalizedPassword.length > 0 && normalizedPassword.length < 8
      ? 'Password must be at least 8 characters.'
      : null;
  const passwordConfirmationError =
    touched.passwordConfirmation &&
    normalizedPasswordConfirmation.length > 0 &&
    normalizedPassword !== normalizedPasswordConfirmation
      ? 'Password confirmation does not match.'
      : null;

  const canContinue =
    normalizedFullName.length >= 3 &&
    isValidEmail(normalizedEmail) &&
    isValidPhone(normalizedPhoneNumber) &&
    normalizedPassword.length >= 8 &&
    normalizedPasswordConfirmation.length >= 8 &&
    normalizedPassword === normalizedPasswordConfirmation &&
    termsAccepted &&
    !loading;

  const onContinue = async () => {
    if (!canContinue) {
      setTouched({
        fullName: true,
        email: true,
        phoneNumber: true,
        password: true,
        passwordConfirmation: true,
      });
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await requestOtp({
        email: normalizedEmail,
        flow: 'signup',
        phone_number: normalizedPhoneNumber,
      });

      navigation.navigate('Otp', {
        email: normalizedEmail,
        flow: 'signup',
        fullName: normalizedFullName,
        phoneNumber: normalizedPhoneNumber,
        password: normalizedPassword,
        passwordConfirmation: normalizedPasswordConfirmation,
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
    <Screen scroll>
      <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.topTitle}>Create account</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <Animated.View style={heroStyle}>
        <LinearGradient
          colors={['#10392D', '#195B43', '#257357']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.heroCard, isCompact && styles.heroCardCompact]}
        >
          <View style={styles.heroShapeOne} />
          <View style={styles.heroShapeTwo} />
          <Text style={styles.heroOverline}>NoorFi Onboarding</Text>
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
            Open your Islamic finance account
          </Text>
          <Text style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}>
            Complete your profile, verify email, then create secure transaction PIN.
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={contentStyle}>
        <GlassCard style={[styles.progressCard, isCompact && styles.progressCardCompact]}>
          <Text style={styles.progressTitle}>Step 1 of 3</Text>
          <View style={styles.progressRow}>
            <View style={[styles.progressPill, styles.progressPillActive]}>
              <Text style={[styles.progressPillText, styles.progressPillTextActive]}>Profile</Text>
            </View>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>Verify</Text>
            </View>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>Set PIN</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={[styles.formCard, isCompact && styles.formCardCompact]}>
          <AppInput
            autoCapitalize="words"
            label="Full Name"
            leftAdornment={<Ionicons color={colors.textMuted} name="person-outline" size={17} />}
            onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
            onChangeText={setFullName}
            placeholder="MOPARA PAIR AYAT"
            required
            value={fullName}
            errorText={fullNameError}
          />
          <AppInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email Address"
            leftAdornment={<Ionicons color={colors.textMuted} name="mail-outline" size={17} />}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            onChangeText={setEmail}
            placeholder="name@example.com"
            required
            value={email}
            wrapperStyle={styles.fieldGap}
            errorText={emailError}
          />
          <View style={styles.fieldGap}>
            <View style={styles.phoneLabelRow}>
              <View style={styles.phoneLabelDot} />
              <Text style={styles.phoneLabel}>Mobile Number</Text>
              <Text style={styles.phoneRequiredMark}>*</Text>
            </View>
            <View
              style={[
                styles.phoneFieldShell,
                phoneFocused && styles.phoneFieldShellFocused,
                mobileErrorText ? styles.phoneFieldShellError : null,
              ]}
            >
              <Pressable
                onPress={() => {
                  setCountryQuery('');
                  setCountryPickerVisible(true);
                }}
                style={({ pressed }) => [
                  styles.phoneCountryButton,
                  pressed && styles.countryCodeButtonPressed,
                ]}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCodeText}>{selectedCountry.dialCode}</Text>
                <Ionicons color={colors.textSecondary} name="chevron-down" size={14} />
              </Pressable>
              <TextInput
                keyboardType="number-pad"
                onBlur={() => {
                  setPhoneFocused(false);
                  setTouched((current) => ({ ...current, phoneNumber: true }));
                }}
                onChangeText={(value) => setPhoneNumber(value.replace(/\D/g, ''))}
                onFocus={() => setPhoneFocused(true)}
                placeholder="1XXXXXXXXX"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                style={styles.phoneFieldInput}
                value={phoneNumber}
              />
            </View>
            {mobileErrorText ? (
              <Text style={styles.phoneFieldError}>{mobileErrorText}</Text>
            ) : (
              <Text style={styles.phoneFieldHint}>{`Saved as ${normalizedPhoneNumber}`}</Text>
            )}
          </View>
          <AppInput
            autoCapitalize="none"
            autoComplete="new-password"
            label="Password"
            leftAdornment={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={17} />}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
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
            onRightAdornmentPress={() => setShowPassword((value) => !value)}
            secureTextEntry={!showPassword}
            value={password}
            wrapperStyle={styles.fieldGap}
            hintText={passwordStrength.label}
            errorText={passwordError}
          />
          <AppInput
            autoCapitalize="none"
            autoComplete="new-password"
            label="Confirm Password"
            leftAdornment={<Ionicons color={colors.textMuted} name="checkmark-done-outline" size={17} />}
            onBlur={() => setTouched((current) => ({ ...current, passwordConfirmation: true }))}
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
            onRightAdornmentPress={() => setShowPasswordConfirmation((value) => !value)}
            secureTextEntry={!showPasswordConfirmation}
            value={passwordConfirmation}
            wrapperStyle={styles.fieldGap}
            errorText={passwordConfirmationError}
          />

          <Pressable
            onPress={() => setTermsAccepted((current) => !current)}
            style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
          >
            <View style={[styles.checkBox, termsAccepted && styles.checkBoxActive]}>
              {termsAccepted ? <Ionicons color="#F8FBF9" name="checkmark" size={13} /> : null}
            </View>
            <Text style={styles.checkLabel}>I accept NoorFi terms, fee policy and privacy notice.</Text>
          </Pressable>
        </GlassCard>
      </Animated.View>

      <Animated.View style={[styles.footer, isCompact && styles.footerCompact, footerStyle]}>
        <AppButton
          disabled={!canContinue}
          onPress={onContinue}
          title={loading ? 'Sending OTP...' : 'Verify email'}
        />
        <AppButton title="Already have account" variant="ghost" onPress={() => navigation.navigate('Login')} />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Animated.View>

      <Modal
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
        transparent
        visible={countryPickerVisible}
      >
        <View style={styles.modalOverlay}>
          <Pressable onPress={() => setCountryPickerVisible(false)} style={styles.modalBackdrop} />
          <View style={styles.countrySheet}>
            <View style={styles.countrySheetHeader}>
              <Text style={styles.countrySheetTitle}>Select country code</Text>
              <Pressable
                onPress={() => {
                  setCountryQuery('');
                  setCountryPickerVisible(false);
                }}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              >
                <Ionicons color={colors.textPrimary} name="close" size={18} />
              </Pressable>
            </View>
            <View style={styles.countrySearchWrap}>
              <Ionicons color={colors.textMuted} name="search-outline" size={16} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setCountryQuery}
                placeholder="Search country or code"
                placeholderTextColor={colors.textMuted}
                style={styles.countrySearchInput}
                value={countryQuery}
              />
            </View>

            <FlatList
              data={filteredCountryOptions}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCountrySelectedManually(true);
                    setSelectedCountry(item);
                    setCountryQuery('');
                    setCountryPickerVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemActive,
                    pressed && styles.countryItemPressed,
                  ]}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <View style={styles.countryItemTextBlock}>
                    <Text style={styles.countryItemName}>{item.name}</Text>
                    <Text style={styles.countryItemDial}>
                      {item.dialCode} ({item.code})
                    </Text>
                  </View>
                  {selectedCountry.code === item.code ? (
                    <Ionicons color={colors.primary} name="checkmark-circle" size={18} />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyCountryWrap}>
                  <Text style={styles.emptyCountryText}>No country found.</Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
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
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroCardCompact: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  heroShapeOne: {
    backgroundColor: 'rgba(236, 219, 180, 0.16)',
    borderRadius: 999,
    height: 112,
    position: 'absolute',
    right: -26,
    top: -26,
    width: 112,
  },
  heroShapeTwo: {
    borderColor: 'rgba(236, 219, 180, 0.23)',
    borderRadius: 999,
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
    fontSize: 22,
    marginTop: 3,
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
    maxWidth: '90%',
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
  progressTitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.sm,
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
    marginBottom: spacing.xl,
  },
  formCardCompact: {
    marginBottom: spacing.lg,
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  phoneLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  phoneLabelDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  phoneLabel: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  phoneRequiredMark: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginLeft: 4,
  },
  phoneFieldShell: {
    alignItems: 'center',
    backgroundColor: '#FCFEFC',
    borderColor: colors.stroke,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  phoneFieldShellFocused: {
    backgroundColor: '#F8FCF9',
    borderColor: '#8FC3A8',
  },
  phoneFieldShellError: {
    borderColor: '#D06456',
  },
  phoneCountryButton: {
    alignItems: 'center',
    backgroundColor: '#EFF5F1',
    borderColor: '#D4E2DA',
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  countryCodeButtonPressed: pressStyles.micro,
  countryFlag: {
    fontSize: 15,
    marginRight: 1,
  },
  countryCodeText: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  phoneFieldInput: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  phoneFieldHint: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  phoneFieldError: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  checkRow: {
    alignItems: 'flex-start',
    borderTopColor: '#E5ECE8',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  checkRowPressed: pressStyles.text,
  checkBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.stroke,
    borderRadius: 8,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkLabel: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  footerCompact: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    backgroundColor: 'rgba(8, 18, 13, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  countrySheet: {
    backgroundColor: '#F7FBF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '72%',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  countrySheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  countrySheetTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 18,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#EAF2EC',
    borderColor: '#D1E0D7',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  closeButtonPressed: pressStyles.icon,
  countrySearchWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1ECE5',
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  countrySearchInput: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 14,
    height: 40,
  },
  countryItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1ECE5',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  countryItemActive: {
    borderColor: '#8FC3A8',
  },
  countryItemPressed: pressStyles.row,
  countryItemFlag: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  countryItemTextBlock: {
    flex: 1,
  },
  countryItemName: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
  countryItemDial: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 1,
  },
  emptyCountryWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyCountryText: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 13,
  },
});
