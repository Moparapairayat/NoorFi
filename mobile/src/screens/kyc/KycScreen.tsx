import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import {
  ApiError,
  getKycProfile,
  getDiditSessionStatus,
  startDiditSession,
  submitKycProfile,
  type KycProfilePayload,
} from '../../services/api';
import { launchDiditNativeVerification } from '../../services/kyc/diditNative';
import { colors, radius, spacing, typography, pressStyles } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Kyc'>;

const documentTypeOptions: Array<{ id: KycProfilePayload['document_type']; label: string }> = [
  { id: 'national_id', label: 'National ID' },
  { id: 'passport', label: 'Passport' },
  { id: 'driving_license', label: 'Driving license' },
];

const addressProofOptions: Array<{ id: KycProfilePayload['address_proof_type']; label: string }> = [
  { id: 'utility_bill', label: 'Utility bill' },
  { id: 'bank_statement', label: 'Bank statement' },
  { id: 'rental_agreement', label: 'Rental agreement' },
];

const documentTypeSet = new Set<KycProfilePayload['document_type']>([
  'national_id',
  'passport',
  'driving_license',
]);

const addressProofTypeSet = new Set<KycProfilePayload['address_proof_type']>([
  'utility_bill',
  'bank_statement',
  'rental_agreement',
]);
const submittedProfileStatuses = new Set(['submitted', 'in_review', 'approved', 'rejected']);

function formatSubmittedAt(iso: string | null): string {
  if (!iso) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }
}

export function KycScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [occupation, setOccupation] = useState('');
  const [documentType, setDocumentType] = useState<KycProfilePayload['document_type']>('national_id');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuingCountry, setIssuingCountry] = useState('');
  const [documentExpiryDate, setDocumentExpiryDate] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [addressProofType, setAddressProofType] = useState<KycProfilePayload['address_proof_type']>(
    'utility_bill'
  );
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    let active = true;

    const normalizeText = (value: unknown): string =>
      typeof value === 'string' ? value.trim() : '';

    const loadProfile = async () => {
      try {
        const response = await getKycProfile();
        const profile = response.profile;
        const diditRoot = response.didit ?? {};

        if (!active) {
          return;
        }

        if (profile && submittedProfileStatuses.has(String(profile.status ?? '').trim().toLowerCase())) {
          const didit = profile.didit ?? {};
          navigation.replace('KycSubmitted', {
            submissionId: `KYC-${String(profile.id).padStart(6, '0')}`,
            submittedAt: formatSubmittedAt(profile.submitted_at ?? null),
            reviewEta: response.kyc_status === 'approved' ? 'Completed' : '24-48 hours',
            tierAfterApproval: 'Tier 3',
            diditSessionId: didit.session_id ?? diditRoot.session_id ?? null,
            diditVerificationUrl: didit.session_url ?? diditRoot.session_url ?? null,
            diditProviderStatus: didit.provider_status ?? diditRoot.provider_status ?? null,
            diditDecision: didit.decision ?? diditRoot.decision ?? null,
          });
          return;
        }

        if (!profile && (diditRoot.session_id || diditRoot.session_url)) {
          navigation.replace('KycSubmitted', {
            submissionId: diditRoot.session_id ?? 'DIDIT-PENDING',
            submittedAt: '--',
            reviewEta: response.kyc_status === 'approved' ? 'Completed' : '24-48 hours',
            tierAfterApproval: 'Tier 3',
            diditSessionId: diditRoot.session_id ?? null,
            diditVerificationUrl: diditRoot.session_url ?? null,
            diditProviderStatus: diditRoot.provider_status ?? null,
            diditDecision: diditRoot.decision ?? null,
          });
          return;
        }

        if (!profile) {
          return;
        }

        setFullName(normalizeText(profile.full_name));
        setDateOfBirth(normalizeText(profile.date_of_birth));
        setNationality(normalizeText(profile.nationality));
        setOccupation(normalizeText(profile.occupation));
        setDocumentNumber(normalizeText(profile.document_number));
        setIssuingCountry(normalizeText(profile.issuing_country));
        setDocumentExpiryDate(normalizeText(profile.document_expiry_date));
        setAddressLine(normalizeText(profile.address_line));
        setCity(normalizeText(profile.city));
        setPostalCode(normalizeText(profile.postal_code));
        setCountry(normalizeText(profile.country));
        setPhoneNumber(normalizeText(profile.phone_number));

        const profileDocumentType = profile.document_type;
        if (profileDocumentType && documentTypeSet.has(profileDocumentType)) {
          setDocumentType(profileDocumentType);
        }

        const profileAddressProofType = profile.address_proof_type;
        if (profileAddressProofType && addressProofTypeSet.has(profileAddressProofType)) {
          setAddressProofType(profileAddressProofType);
        }
      } catch {
        // Keep form empty if profile fetch fails.
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [navigation]);

  const formError = useMemo(() => {
    const required: Array<{ value: string; label: string }> = [
      { value: fullName, label: 'Full name' },
      { value: dateOfBirth, label: 'Date of birth' },
      { value: nationality, label: 'Nationality' },
      { value: occupation, label: 'Occupation' },
      { value: documentNumber, label: 'Document number' },
      { value: issuingCountry, label: 'Issuing country' },
      { value: documentExpiryDate, label: 'Document expiry date' },
      { value: addressLine, label: 'Address line' },
      { value: city, label: 'City' },
      { value: postalCode, label: 'Postal code' },
      { value: country, label: 'Country' },
      { value: phoneNumber, label: 'Phone number' },
    ];

    const empty = required.find((item) => item.value.trim().length === 0);
    if (empty) {
      return `${empty.label} is required.`;
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dateOfBirth.trim())) {
      return 'Date of birth must be in YYYY-MM-DD format.';
    }

    if (!datePattern.test(documentExpiryDate.trim())) {
      return 'Document expiry date must be in YYYY-MM-DD format.';
    }

    return null;
  }, [
    addressLine,
    city,
    country,
    dateOfBirth,
    documentExpiryDate,
    documentNumber,
    fullName,
    issuingCountry,
    nationality,
    occupation,
    phoneNumber,
    postalCode,
  ]);

  const openDiditFlow = async () => {
    if (loading || loadingProfile) {
      return;
    }

    if (formError) {
      setErrorMessage(formError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const submitResponse = await submitKycProfile({
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth.trim(),
        nationality: nationality.trim(),
        occupation: occupation.trim(),
        document_type: documentType,
        document_number: documentNumber.trim(),
        issuing_country: issuingCountry.trim(),
        document_expiry_date: documentExpiryDate.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        postal_code: postalCode.trim(),
        country: country.trim(),
        address_proof_type: addressProofType,
        phone_number: phoneNumber.trim(),
        selfie_confirmed: true,
      });

      const created = await startDiditSession(true);
      const sessionToken = created.session_token?.trim() ?? '';
      if (!sessionToken) {
        throw new Error(
          'Didit session token is missing. Please check backend Didit session response.'
        );
      }

      const launchResult = await launchDiditNativeVerification(sessionToken);
      if (launchResult.state === 'failed') {
        throw new Error(launchResult.message);
      }

      let latest = null as Awaited<ReturnType<typeof getDiditSessionStatus>> | null;
      try {
        latest = await getDiditSessionStatus(true);
      } catch {
        latest = null;
      }

      const finalSessionId = latest?.session_id ?? launchResult.sessionId ?? created.session_id ?? null;
      const finalProviderStatus =
        latest?.provider_status ?? launchResult.providerStatus ?? created.provider_status ?? null;
      const finalDecision =
        latest?.decision
        ?? created.decision
        ?? (launchResult.state === 'approved'
          ? 'Approved'
          : launchResult.state === 'declined'
            ? 'Declined'
            : launchResult.state === 'pending'
              ? 'Pending'
              : null);

      if (!finalSessionId) {
        throw new Error('Didit session ID missing after verification start. Please try again.');
      }

      navigation.replace('KycSubmitted', {
        submissionId: submitResponse.submission_id ?? finalSessionId,
        submittedAt: formatSubmittedAt(submitResponse.submitted_at),
        reviewEta: submitResponse.review_eta ?? '24-48 hours',
        tierAfterApproval: submitResponse.tier_after_approval ?? 'Tier 3',
        diditSessionId: finalSessionId,
        diditVerificationUrl: latest?.verification_url ?? created.verification_url ?? null,
        diditProviderStatus: finalProviderStatus,
        diditDecision: finalDecision,
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Unable to start verification.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
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
        <Text style={styles.title}>Trust verification</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={['#113A2E', '#1A5B43', '#247255']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Text style={styles.heroOverline}>Didit KYC</Text>
        <Text style={styles.heroTitle}>Verify identity instantly</Text>
        <Text style={styles.heroSubtitle}>
          First submit KYC profile data, then NoorFi opens secure Didit verification.
        </Text>
      </LinearGradient>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Personal details</Text>
        <AppInput
          label="Full name"
          onChangeText={setFullName}
          placeholder="MOPARA PAIR AYAT"
          value={fullName}
        />
        <AppInput
          label="Date of birth (YYYY-MM-DD)"
          onChangeText={setDateOfBirth}
          placeholder="1999-12-31"
          value={dateOfBirth}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          label="Nationality"
          onChangeText={setNationality}
          placeholder="Bangladeshi"
          value={nationality}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          label="Occupation"
          onChangeText={setOccupation}
          placeholder="Business"
          value={occupation}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          keyboardType="phone-pad"
          label="Phone number"
          onChangeText={setPhoneNumber}
          placeholder="+8801XXXXXXXXX"
          value={phoneNumber}
          wrapperStyle={styles.fieldGap}
        />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Document details</Text>
        <Text style={styles.sectionSubTitle}>Document type</Text>
        <View style={styles.choiceRow}>
          {documentTypeOptions.map((item) => {
            const selected = item.id === documentType;
            return (
              <Pressable
                key={item.id}
                onPress={() => setDocumentType(item.id)}
                style={({ pressed }) => [
                  styles.choiceChip,
                  selected && styles.choiceChipSelected,
                  pressed && !selected && styles.choiceChipPressed,
                ]}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppInput
          label="Document number"
          onChangeText={setDocumentNumber}
          placeholder="ID/PASSPORT NUMBER"
          value={documentNumber}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          label="Issuing country"
          onChangeText={setIssuingCountry}
          placeholder="Bangladesh"
          value={issuingCountry}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          label="Document expiry (YYYY-MM-DD)"
          onChangeText={setDocumentExpiryDate}
          placeholder="2030-12-31"
          value={documentExpiryDate}
          wrapperStyle={styles.fieldGap}
        />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Address details</Text>
        <AppInput
          label="Address line"
          onChangeText={setAddressLine}
          placeholder="House/Road/Area"
          value={addressLine}
        />
        <AppInput
          label="City"
          onChangeText={setCity}
          placeholder="Dhaka"
          value={city}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          label="Postal code"
          onChangeText={setPostalCode}
          placeholder="1207"
          value={postalCode}
          wrapperStyle={styles.fieldGap}
        />
        <AppInput
          label="Country"
          onChangeText={setCountry}
          placeholder="Bangladesh"
          value={country}
          wrapperStyle={styles.fieldGap}
        />
        <Text style={[styles.sectionSubTitle, styles.fieldGap]}>Address proof</Text>
        <View style={styles.choiceRow}>
          {addressProofOptions.map((item) => {
            const selected = item.id === addressProofType;
            return (
              <Pressable
                key={item.id}
                onPress={() => setAddressProofType(item.id)}
                style={({ pressed }) => [
                  styles.choiceChip,
                  selected && styles.choiceChipSelected,
                  pressed && !selected && styles.choiceChipPressed,
                ]}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.stepsWrap}>
        <View style={styles.stepRow}>
          <View style={styles.dotProgress} />
          <Text style={styles.stepText}>Submit KYC profile to NoorFi database</Text>
          <Text style={styles.stepStatus}>Now</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.dot} />
          <Text style={styles.stepText}>Open native Didit identity checks</Text>
          <Text style={styles.stepStatus}>Next</Text>
        </View>
        <View style={styles.stepRowLast}>
          <View style={styles.dot} />
          <Text style={styles.stepText}>Status sync to NoorFi</Text>
          <Text style={styles.stepStatus}>Auto</Text>
        </View>
      </GlassCard>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <AppButton
        disabled={loading || loadingProfile}
        title={loadingProfile ? 'Loading profile...' : loading ? 'Submitting & opening Didit...' : 'Submit profile & verify'}
        onPress={() => void openDiditFlow()}
      />
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
    borderColor: '#2F7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroShapeOne: {
    backgroundColor: 'rgba(237, 221, 185, 0.16)',
    borderRadius: radius.pill,
    height: 112,
    position: 'absolute',
    right: -28,
    top: -28,
    width: 112,
  },
  heroShapeTwo: {
    borderColor: 'rgba(237, 221, 185, 0.22)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 68,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 54,
  },
  heroOverline: {
    color: '#EEDDB8',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F5FBF8',
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
  stepsWrap: {
    marginBottom: spacing.xl,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  sectionSubTitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    backgroundColor: '#F7FBF8',
    borderColor: '#D6E5DC',
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  choiceChipSelected: {
    backgroundColor: '#E4F3EA',
    borderColor: '#6DA489',
  },
  choiceChipPressed: pressStyles.chip,
  choiceText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  choiceTextSelected: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
  },
  stepRow: {
    alignItems: 'center',
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  stepRowLast: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dot: {
    backgroundColor: '#C8D7CE',
    borderRadius: radius.pill,
    height: 10,
    marginRight: spacing.md,
    width: 10,
  },
  dotProgress: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    height: 10,
    marginRight: spacing.md,
    width: 10,
  },
  stepText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
  stepStatus: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 12,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
