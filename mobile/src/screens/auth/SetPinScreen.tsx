import React, { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, setPin as setPinRequest } from '../../services/api';
import { setBiometricLoginEnabled } from '../../services/security/biometric';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';
import { useAuthEntrance, useAuthLayout } from './useAuthUi';

type Props = NativeStackScreenProps<RootStackParamList, 'SetPin'>;

function isWeakPin(value: string): boolean {
  if (!/^\d{4}$/.test(value)) {
    return false;
  }

  if (/^(\d)\1{3}$/.test(value)) {
    return true;
  }

  const sequences = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'];
  return sequences.includes(value);
}

export function SetPinScreen({ navigation, route }: Props) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [saveDevice, setSaveDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isCompact } = useAuthLayout();
  const { heroStyle, contentStyle, footerStyle } = useAuthEntrance(50);
  const [touched, setTouched] = useState({
    pin: false,
    confirmPin: false,
  });
  const { flow, fullName, email } = route.params;

  const meta = useMemo(() => {
    if (flow === 'signup') {
      return {
        topTitle: 'Create PIN',
        overline: 'Step 3 of 3',
        title: 'Set your transaction PIN',
        subtitle: `This PIN protects all transfers and withdrawals for ${fullName ?? 'your account'}.`,
        chips: ['Profile', 'Verify', 'Set PIN'],
        activeChip: 2,
        buttonLabel: 'Finish account setup',
      };
    }

    if (flow === 'recovery') {
      return {
        topTitle: 'Reset PIN',
        overline: 'Step 2 of 2',
        title: 'Choose a new secure PIN',
        subtitle: `PIN reset is linked to ${email}. Keep it private and do not share.`,
        chips: ['Email', 'OTP + New PIN'],
        activeChip: 1,
        buttonLabel: 'Save new PIN',
      };
    }

    return {
      topTitle: 'Set Security PIN',
      overline: 'Step 2 of 2',
      title: 'Add transaction protection',
      subtitle: 'Create your 4 digit PIN to secure transfers, card controls and withdrawals.',
      chips: ['Login', 'Set PIN'],
      activeChip: 1,
      buttonLabel: 'Save PIN',
    };
  }, [flow, fullName, email]);

  const normalizedPin = pin.replace(/\D/g, '').slice(0, 4);
  const normalizedConfirmPin = confirmPin.replace(/\D/g, '').slice(0, 4);
  const pinError =
    touched.pin && normalizedPin.length === 4 && isWeakPin(normalizedPin)
      ? 'Avoid weak PIN like 1111 or 1234.'
      : null;
  const pinLengthError =
    touched.pin && normalizedPin.length > 0 && normalizedPin.length < 4 ? 'PIN must be 4 digits.' : null;
  const confirmError =
    touched.confirmPin &&
    normalizedConfirmPin.length > 0 &&
    normalizedConfirmPin.length === 4 &&
    normalizedPin !== normalizedConfirmPin
      ? 'PIN confirmation does not match.'
      : null;

  const canContinue = useMemo(
    () =>
      normalizedPin.length === 4 &&
      normalizedConfirmPin.length === 4 &&
      normalizedPin === normalizedConfirmPin &&
      !isWeakPin(normalizedPin) &&
      !loading,
    [normalizedPin, normalizedConfirmPin, loading]
  );

  const onContinue = async () => {
    if (!canContinue) {
      setTouched({ pin: true, confirmPin: true });
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await setPinRequest(normalizedPin);
      try {
        await setBiometricLoginEnabled(saveDevice);
      } catch {
        // Ignore biometric preference errors; PIN setup should not fail.
      }
      navigation.replace('MainTabs');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to set PIN. Please try again.');
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
        <Text style={styles.topTitle}>{meta.topTitle}</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <Animated.View style={heroStyle}>
        <LinearGradient
          colors={['#10392D', '#195A43', '#257356']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.heroCard, isCompact && styles.heroCardCompact]}
        >
          <View style={styles.shieldWrap}>
            <Ionicons color="#EED8A7" name="lock-closed-outline" size={18} />
          </View>
          <Text style={styles.heroOverline}>{meta.overline}</Text>
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>{meta.title}</Text>
          <Text style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}>{meta.subtitle}</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={contentStyle}>
        <GlassCard style={[styles.progressCard, isCompact && styles.progressCardCompact]}>
          <View style={styles.progressRow}>
            {meta.chips.map((chip, index) => (
              <View key={chip} style={[styles.progressPill, index === meta.activeChip && styles.progressPillActive]}>
                <Text
                  style={[
                    styles.progressPillText,
                    index === meta.activeChip && styles.progressPillTextActive,
                  ]}
                >
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={[styles.formCard, isCompact && styles.formCardCompact]}>
          <Text style={styles.sectionTitle}>PIN setup</Text>
          <AppInput
            keyboardType="number-pad"
            label="Enter 4 digit PIN"
            leftAdornment={<Ionicons color={colors.textMuted} name="keypad-outline" size={17} />}
            maxLength={4}
            onBlur={() => setTouched((current) => ({ ...current, pin: true }))}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
            placeholder="****"
            required
            rightAdornment={
              <Ionicons
                color={colors.textMuted}
                name={showPin ? 'eye-off-outline' : 'eye-outline'}
                size={18}
              />
            }
            onRightAdornmentPress={() => setShowPin((value) => !value)}
            secureTextEntry={!showPin}
            value={normalizedPin}
            hintText="Avoid sequential or repeated PIN"
            errorText={pinLengthError || pinError}
          />
          <AppInput
            keyboardType="number-pad"
            label="Confirm PIN"
            leftAdornment={<Ionicons color={colors.textMuted} name="checkmark-done-outline" size={17} />}
            maxLength={4}
            onBlur={() => setTouched((current) => ({ ...current, confirmPin: true }))}
            onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 4))}
            placeholder="****"
            required
            rightAdornment={
              <Ionicons
                color={colors.textMuted}
                name={showConfirmPin ? 'eye-off-outline' : 'eye-outline'}
                size={18}
              />
            }
            onRightAdornmentPress={() => setShowConfirmPin((value) => !value)}
            secureTextEntry={!showConfirmPin}
            value={normalizedConfirmPin}
            wrapperStyle={styles.fieldGap}
            errorText={confirmError}
          />
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            onPress={() => setSaveDevice((value) => !value)}
            style={({ pressed }) => [styles.saveRow, pressed && styles.saveRowPressed]}
          >
            <View style={[styles.checkBox, saveDevice && styles.checkBoxActive]}>
              {saveDevice ? <Ionicons color="#F8FBF9" name="checkmark" size={13} /> : null}
            </View>
            <Text style={styles.saveText}>Enable biometric quick unlock after this setup.</Text>
          </Pressable>
        </GlassCard>
      </Animated.View>

      <Animated.View style={[styles.footer, isCompact && styles.footerCompact, footerStyle]}>
        <AppButton disabled={!canContinue} onPress={onContinue} title={loading ? 'Saving PIN...' : meta.buttonLabel} />
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
    alignItems: 'center',
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
  shieldWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 47, 36, 0.44)',
    borderColor: 'rgba(238, 216, 167, 0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroOverline: {
    color: '#EED8A7',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: 2,
    textAlign: 'center',
  },
  heroTitleCompact: {
    fontSize: 20,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
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
  formCard: {
    marginBottom: spacing.lg,
  },
  formCardCompact: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  saveRow: {
    alignItems: 'center',
    borderTopColor: '#E5ECE8',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  saveRowPressed: pressStyles.text,
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
  saveText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginBottom: spacing.xl,
  },
  footerCompact: {
    marginBottom: spacing.lg,
  },
});
