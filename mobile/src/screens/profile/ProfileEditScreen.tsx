import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, getKycProfile, getMe, updateProfile } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

function normalizeText(value?: string | null, fallback = '--'): string {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function ProfileEditScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [baselineFullName, setBaselineFullName] = useState('');
  const [email, setEmail] = useState('--');
  const [phone, setPhone] = useState('--');
  const [city, setCity] = useState('--');
  const [occupation, setOccupation] = useState('--');
  const [kycStatus, setKycStatus] = useState('--');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const normalizedFullName = useMemo(
    () => fullName.trim().replace(/\s+/g, ' '),
    [fullName]
  );
  const isDirty = normalizedFullName !== baselineFullName;
  const isNameValid = normalizedFullName.length >= 3;
  const canSave = isNameValid && isDirty && !loading && !saving;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText(null);

      const [meResponse, kycResponse] = await Promise.all([getMe(), getKycProfile()]);
      const loadedName = normalizeText(meResponse.user.name, '');
      const kycProfile = kycResponse.profile;

      setFullName(loadedName);
      setBaselineFullName(loadedName);
      setEmail(normalizeText(meResponse.user.email));
      setPhone(normalizeText(meResponse.user.phone_number));
      setCity(normalizeText((kycProfile?.city as string | null | undefined) ?? null));
      setOccupation(normalizeText((kycProfile?.occupation as string | null | undefined) ?? null));
      setKycStatus(normalizeText(kycResponse.kyc_status ?? meResponse.user.kyc_status));
    } catch (error) {
      setErrorText(error instanceof ApiError ? error.message : 'Unable to load profile information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const onSave = async () => {
    setAttemptedSave(true);

    if (!canSave) {
      return;
    }

    try {
      setSaving(true);
      setErrorText(null);

      const response = await updateProfile({
        full_name: normalizedFullName,
      });

      const savedName = normalizeText(response.user.name, normalizedFullName);
      setBaselineFullName(savedName);
      setFullName(savedName);

      Alert.alert('Profile updated', response.message, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      setErrorText(error instanceof ApiError ? error.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
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
        <Text style={styles.title}>Edit profile</Text>
        <Pressable
          onPress={() => void loadProfile()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons color={colors.textPrimary} name="refresh-outline" size={18} />
          )}
        </Pressable>
      </View>

      <LinearGradient
        colors={['#113A2E', '#1A5A43', '#247255']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroPatternOne} />
        <View style={styles.heroPatternTwo} />
        <Text style={styles.heroOverline}>Profile update</Text>
        <Text style={styles.heroTitle}>Keep your account identity accurate</Text>
        <Text style={styles.heroSubtitle}>
          Name change is saved instantly. Email and mobile stay locked for account security.
        </Text>
      </LinearGradient>

      {loading ? (
        <GlassCard style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </GlassCard>
      ) : null}

      <Text style={styles.sectionTitle}>Primary identity</Text>
      <GlassCard style={styles.formCard}>
        <AppInput
          required
          autoCapitalize="words"
          label="Full name"
          maxLength={120}
          onChangeText={setFullName}
          placeholder="Your full legal name"
          value={fullName}
          errorText={
            attemptedSave && !isNameValid
              ? 'Full name must be at least 3 characters.'
              : null
          }
          hintText="This name appears on card holder profile and compliance records."
        />
      </GlassCard>

      <Text style={styles.sectionTitle}>Contact (Locked)</Text>
      <GlassCard style={styles.formCard}>
        <AppInput
          label="Email"
          value={email}
          editable={false}
          leftAdornment={<Ionicons color={colors.textMuted} name="mail-outline" size={16} />}
        />
        <AppInput
          label="Mobile number"
          value={phone}
          editable={false}
          wrapperStyle={styles.fieldGap}
          leftAdornment={<Ionicons color={colors.textMuted} name="call-outline" size={16} />}
          hintText="For security, mobile change requires verification support."
        />
      </GlassCard>

      <Text style={styles.sectionTitle}>KYC snapshot</Text>
      <GlassCard style={styles.formCard}>
        <View style={styles.metaRow}>
          <View style={styles.metaIconWrap}>
            <Ionicons color={colors.primary} name="business-outline" size={14} />
          </View>
          <View style={styles.metaBody}>
            <Text style={styles.metaLabel}>City</Text>
            <Text style={styles.metaValue}>{city}</Text>
          </View>
        </View>
        <View style={[styles.metaRow, styles.metaRowDivider]}>
          <View style={styles.metaIconWrap}>
            <Ionicons color={colors.primary} name="briefcase-outline" size={14} />
          </View>
          <View style={styles.metaBody}>
            <Text style={styles.metaLabel}>Occupation</Text>
            <Text style={styles.metaValue}>{occupation}</Text>
          </View>
        </View>
        <View style={[styles.metaRow, styles.metaRowDivider]}>
          <View style={styles.metaIconWrap}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={14} />
          </View>
          <View style={styles.metaBody}>
            <Text style={styles.metaLabel}>KYC status</Text>
            <Text style={styles.metaValue}>{kycStatus}</Text>
          </View>
        </View>

        <AppButton
          title="Open KYC profile"
          variant="ghost"
          style={styles.kycButton}
          onPress={() => navigation.navigate('Kyc')}
        />
      </GlassCard>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      <View style={styles.buttonWrap}>
        <AppButton
          title={saving ? 'Saving changes...' : 'Save changes'}
          onPress={() => void onSave()}
          disabled={!canSave}
        />
      </View>
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
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
  title: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 18,
  },
  heroCard: {
    borderColor: '#2F7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroPatternOne: {
    backgroundColor: 'rgba(238, 223, 189, 0.14)',
    borderRadius: radius.pill,
    height: 120,
    position: 'absolute',
    right: -36,
    top: -32,
    width: 120,
  },
  heroPatternTwo: {
    borderColor: 'rgba(238, 223, 189, 0.23)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 74,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 58,
  },
  heroOverline: {
    color: '#EDDDBA',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F5FBF7',
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: 3,
  },
  heroSubtitle: {
    color: 'rgba(224, 234, 228, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    maxWidth: '92%',
  },
  loadingCard: {
    alignItems: 'center',
    borderColor: '#D5E2DA',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 52,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  formCard: {
    borderColor: '#D5E2DA',
    marginTop: spacing.sm,
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  metaRowDivider: {
    borderTopColor: '#E5ECE8',
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  metaIconWrap: {
    alignItems: 'center',
    backgroundColor: '#ECF5F0',
    borderColor: '#D3E6DB',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  metaBody: {
    flex: 1,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  metaValue: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    marginTop: 1,
  },
  kycButton: {
    marginTop: spacing.md,
    minHeight: 44,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
  },
  buttonWrap: {
    marginTop: spacing.xl,
  },
  bottomSpace: {
    height: spacing.xxl,
  },
});
