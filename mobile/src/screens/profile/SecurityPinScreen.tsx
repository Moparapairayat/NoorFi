import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, setPin } from '../../services/api';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  getBiometricDisplayName,
  isBiometricLoginEnabled,
  isLoginAlertPreferenceEnabled,
  setBiometricLoginEnabled,
  setLoginAlertPreferenceEnabled,
} from '../../services/security/biometric';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'SecurityPin'>;
const PIN_LENGTH = 4;

function normalizePinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

function isWeakPin(value: string): boolean {
  if (value.length !== PIN_LENGTH) {
    return false;
  }

  if (/^(\d)\1+$/.test(value)) {
    return true;
  }

  const asc = '01234567890123456789';
  const desc = '98765432109876543210';

  return asc.includes(value) || desc.includes(value);
}

export function SecurityPinScreen({ navigation }: Props) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [biometricTypeLabel, setBiometricTypeLabel] = useState('Biometrics');
  const [loginAlertEnabled, setLoginAlertEnabled] = useState(true);

  const pinMismatch = newPin.length === PIN_LENGTH && confirmPin.length > 0 && newPin !== confirmPin;
  const newPinWeak = isWeakPin(newPin);
  const sameAsCurrent = currentPin.length === PIN_LENGTH && newPin.length === PIN_LENGTH && currentPin === newPin;
  const canSave = useMemo(() => {
    return (
      currentPin.length === PIN_LENGTH
      && newPin.length === PIN_LENGTH
      && confirmPin.length === PIN_LENGTH
      && !pinMismatch
      && !newPinWeak
      && !sameAsCurrent
      && !savingPin
    );
  }, [confirmPin.length, currentPin.length, newPin.length, pinMismatch, newPinWeak, sameAsCurrent, savingPin]);

  useEffect(() => {
    let mounted = true;

    const loadPreferences = async () => {
      try {
        const [enabled, capability, loginAlerts] = await Promise.all([
          isBiometricLoginEnabled(),
          getBiometricCapability(),
          isLoginAlertPreferenceEnabled(),
        ]);

        if (!mounted) {
          return;
        }

        setBiometricEnabled(enabled);
        setBiometricTypeLabel(getBiometricDisplayName(capability.type));
        setLoginAlertEnabled(loginAlerts);
      } catch {
        if (!mounted) {
          return;
        }
        setBiometricEnabled(false);
      }
    };

    void loadPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  const onToggleBiometric = async () => {
    if (preferenceBusy) {
      return;
    }

    setPreferenceBusy(true);
    try {
      if (biometricEnabled) {
        await setBiometricLoginEnabled(false);
        setBiometricEnabled(false);
        return;
      }

      const capability = await getBiometricCapability();
      const methodLabel = getBiometricDisplayName(capability.type);
      setBiometricTypeLabel(methodLabel);

      if (!capability.available) {
        Alert.alert(
          'Biometric unavailable',
          'No enrolled biometrics found on this device. Add fingerprint or face unlock first.'
        );
        return;
      }

      const unlocked = await authenticateWithBiometrics(`Enable ${methodLabel} login for NoorFi`);
      if (!unlocked) {
        return;
      }

      await setBiometricLoginEnabled(true);
      setBiometricEnabled(true);
    } catch {
      Alert.alert('Security', 'Unable to update biometric settings right now. Please try again.');
    } finally {
      setPreferenceBusy(false);
    }
  };

  const onToggleLoginAlert = async () => {
    if (preferenceBusy) {
      return;
    }

    setPreferenceBusy(true);
    const nextValue = !loginAlertEnabled;
    try {
      await setLoginAlertPreferenceEnabled(nextValue);
      setLoginAlertEnabled(nextValue);
    } catch {
      Alert.alert('Security', 'Unable to update login alert settings right now.');
    } finally {
      setPreferenceBusy(false);
    }
  };

  const onSaveSecurity = async () => {
    if (!canSave) {
      return;
    }

    setSaveError(null);
    setSavingPin(true);

    try {
      await setPin(newPin, currentPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      Alert.alert('Security updated', 'Transaction PIN has been updated successfully.');
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : 'Unable to update transaction PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Security & PIN</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#10392D', '#185841', '#247154']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Text style={styles.heroOverline}>Account protection</Text>
        <Text style={styles.heroTitle}>Secure your NoorFi access</Text>
        <Text style={styles.heroSubtitle}>
          Use strong PIN, biometric login and security alerts for safer account control.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaChip}>
            <Ionicons color="#EAD5A8" name="finger-print-outline" size={12} />
            <Text style={styles.heroMetaText}>
              {biometricEnabled ? 'Biometric on' : 'Biometric off'}
            </Text>
          </View>
          <View style={styles.heroMetaChip}>
            <Ionicons color="#EAD5A8" name="notifications-outline" size={12} />
            <Text style={styles.heroMetaText}>
              {loginAlertEnabled ? 'Alerts on' : 'Alerts off'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Change transaction PIN</Text>

        <AppInput
          label="Current PIN"
          value={currentPin}
          onChangeText={(value) => setCurrentPin(normalizePinInput(value))}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          secureTextEntry
          placeholder="****"
          hintText="Enter your current 4-digit PIN"
        />
        <AppInput
          label="New PIN"
          value={newPin}
          onChangeText={(value) => setNewPin(normalizePinInput(value))}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          secureTextEntry
          placeholder="****"
          wrapperStyle={styles.fieldGap}
          hintText="Avoid repeated or sequential digits"
        />
        <AppInput
          label="Confirm new PIN"
          value={confirmPin}
          onChangeText={(value) => setConfirmPin(normalizePinInput(value))}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          secureTextEntry
          placeholder="****"
          wrapperStyle={styles.fieldGap}
        />

        {pinMismatch ? (
          <Text style={styles.errorText}>PIN confirmation does not match.</Text>
        ) : null}
        {sameAsCurrent ? (
          <Text style={styles.errorText}>New PIN must be different from current PIN.</Text>
        ) : null}
        {newPinWeak ? (
          <Text style={styles.errorText}>Choose a stronger PIN. Avoid repeating or sequence patterns.</Text>
        ) : null}

        <Pressable
          onPress={() => navigation.navigate('ForgotPin')}
          style={({ pressed }) => [styles.inlineLinkWrap, pressed && styles.inlineLinkPressed]}
        >
          <Text style={styles.inlineLink}>Forgot PIN?</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Security preferences</Text>

        <Pressable
          disabled={preferenceBusy}
          onPress={() => void onToggleBiometric()}
          style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
        >
          <View style={styles.settingLeftWrap}>
            <View style={styles.settingIconWrap}>
              <Ionicons color={colors.primary} name="finger-print-outline" size={16} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingLabel}>{`Biometric login (${biometricTypeLabel})`}</Text>
              <Text style={styles.settingHint}>Unlock NoorFi quickly without typing password</Text>
            </View>
          </View>
          {preferenceBusy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons
              color={biometricEnabled ? colors.success : colors.textMuted}
              name={biometricEnabled ? 'toggle' : 'toggle-outline'}
              size={30}
            />
          )}
        </Pressable>

        <Pressable
          disabled={preferenceBusy}
          onPress={() => void onToggleLoginAlert()}
          style={({ pressed }) => [
            styles.settingRow,
            styles.settingRowLast,
            pressed && styles.settingRowPressed,
          ]}
        >
          <View style={styles.settingLeftWrap}>
            <View style={styles.settingIconWrap}>
              <Ionicons color={colors.primary} name="notifications-outline" size={16} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingLabel}>New login alerts</Text>
              <Text style={styles.settingHint}>Get notified instantly on every new device login</Text>
            </View>
          </View>
          {preferenceBusy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons
              color={loginAlertEnabled ? colors.success : colors.textMuted}
              name={loginAlertEnabled ? 'toggle' : 'toggle-outline'}
              size={30}
            />
          )}
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.noticeCard}>
        <Ionicons color="#A37728" name="information-circle-outline" size={16} />
        <Text style={styles.noticeText}>
          PIN changes are applied instantly for transfers, withdrawals, exchange and card reveal actions.
        </Text>
      </GlassCard>

      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <View style={styles.buttonWrap}>
        <AppButton
          title={savingPin ? 'Saving security...' : 'Save security settings'}
          onPress={() => void onSaveSecurity()}
          disabled={!canSave}
        />
        <AppButton
          title="Back to profile"
          variant="ghost"
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        />
      </View>
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
    borderColor: '#2E7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroShapeOne: {
    backgroundColor: 'rgba(233, 213, 165, 0.18)',
    borderRadius: radius.pill,
    height: 110,
    position: 'absolute',
    right: -30,
    top: -24,
    width: 110,
  },
  heroShapeTwo: {
    borderColor: 'rgba(233, 213, 165, 0.24)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 72,
    position: 'absolute',
    right: 12,
    top: 10,
    width: 52,
  },
  heroOverline: {
    color: '#EDD8AB',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: 4,
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.82)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    maxWidth: '94%',
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroMetaChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 30, 23, 0.44)',
    borderColor: 'rgba(233, 213, 165, 0.3)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  heroMetaText: {
    color: '#F1E5C6',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  card: {
    borderColor: '#D5E2DA',
    marginBottom: spacing.lg,
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
  inlineLinkWrap: {
    alignSelf: 'flex-end',
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inlineLinkPressed: pressStyles.text,
  inlineLink: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingRowPressed: pressStyles.row,
  settingLeftWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  settingIconWrap: {
    alignItems: 'center',
    backgroundColor: '#ECF5F0',
    borderColor: '#D3E6DB',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  settingCopy: {
    flex: 1,
  },
  settingLabel: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
  settingHint: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 1,
  },
  noticeCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E8',
    borderColor: '#F0D9AD',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  noticeText: {
    color: '#7A6437',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  buttonWrap: {
    marginTop: spacing.lg,
  },
  secondaryButton: {
    marginTop: spacing.md,
  },
});
