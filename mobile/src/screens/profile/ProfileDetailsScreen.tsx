import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, getDiditSessionStatus, getKycProfile, getMe } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetails'>;

type DetailsState = {
  name: string;
  email: string;
  phoneNumber: string;
  accountStatus: string;
  kycStatus: string;
  kycSubmittedAt: string;
  lastLoginAt: string;
};

const initialState: DetailsState = {
  name: '--',
  email: '--',
  phoneNumber: '--',
  accountStatus: '--',
  kycStatus: '--',
  kycSubmittedAt: '--',
  lastLoginAt: '--',
};
const PROFILE_DETAILS_SYNC_INTERVAL_MS = 8000;

function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(input?: string | null): string {
  if (!input) {
    return '--';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(input));
  } catch {
    return '--';
  }
}

function statusTone(value: string): 'success' | 'warning' | 'default' {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes('approved') || normalized.includes('verified') || normalized.includes('active')) {
    return 'success';
  }

  if (normalized.includes('pending') || normalized.includes('review')) {
    return 'warning';
  }

  return 'default';
}

export function ProfileDetailsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [details, setDetails] = useState<DetailsState>(initialState);

  const initials = useMemo(() => {
    const chunks = details.name.split(' ').filter(Boolean);

    if (chunks.length === 0 || details.name === '--') {
      return 'NF';
    }

    return `${chunks[0]?.[0] ?? ''}${chunks[1]?.[0] ?? ''}`.toUpperCase() || 'NF';
  }, [details.name]);

  const kycTone = statusTone(details.kycStatus);
  const accountTone = statusTone(details.accountStatus);

  const loadDetails = useCallback(async (options?: { silent?: boolean; syncDidit?: boolean }) => {
    const silent = options?.silent ?? false;
    const syncDidit = options?.syncDidit ?? false;

    try {
      if (!silent) {
        setLoading(true);
        setErrorText(null);
      }

      let meResponse = await getMe();
      let kycResponse = null;

      try {
        kycResponse = await getKycProfile();
      } catch {
        // Keep fallback values from /auth/me
      }

      const currentKycStatus = String(kycResponse?.kyc_status ?? meResponse.user.kyc_status ?? '')
        .trim()
        .toLowerCase();
      const hasActiveDiditSession = Boolean(
        kycResponse?.didit?.session_id || kycResponse?.profile?.didit?.session_id
      );
      const shouldSyncDidit = syncDidit
        && hasActiveDiditSession
        && ['submitted', 'pending', 'in_review', 'in review'].includes(currentKycStatus);

      if (shouldSyncDidit) {
        try {
          await getDiditSessionStatus(true);
          meResponse = await getMe();
          try {
            kycResponse = await getKycProfile();
          } catch {
            // keep /auth/me fallback
          }
        } catch {
          // silent fallback
        }
      }

      const profile = kycResponse?.profile ?? null;

      setDetails({
        name: meResponse.user.name || '--',
        email: meResponse.user.email || '--',
        phoneNumber: meResponse.user.phone_number || '--',
        accountStatus: toTitleCase(meResponse.user.account_status || '--'),
        kycStatus: toTitleCase(kycResponse?.kyc_status || meResponse.user.kyc_status || '--'),
        kycSubmittedAt: formatDateTime(profile?.submitted_at ?? null),
        lastLoginAt: formatDateTime(meResponse.user.last_login_at ?? null),
      });
    } catch (error) {
      if (!silent) {
        setErrorText(error instanceof ApiError ? error.message : 'Unable to load profile details.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadDetails({ syncDidit: true });

      const interval = setInterval(() => {
        if (!active) {
          return;
        }
        void loadDetails({ silent: true, syncDidit: true });
      }, PROFILE_DETAILS_SYNC_INTERVAL_MS);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [loadDetails])
  );

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>

        <Text style={styles.title}>Profile details</Text>

        <Pressable
          onPress={() => void loadDetails({ syncDidit: true })}
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
        <Text style={styles.heroOverline}>NoorFi identity</Text>

        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text numberOfLines={1} style={styles.name}>
              {details.name}
            </Text>
            <Text numberOfLines={1} style={styles.email}>
              {details.email}
            </Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <StatusBadge
            tone={accountTone}
            value={details.accountStatus}
            labelPrefix="Account"
          />
          <StatusBadge
            tone={kycTone}
            value={details.kycStatus}
            labelPrefix="KYC"
          />
        </View>
      </LinearGradient>

      <Text style={styles.subtitle}>Your verified identity and account status for secure NoorFi access.</Text>

      <Text style={styles.sectionTitle}>Identity</Text>
      <GlassCard style={styles.sectionCard}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <>
            <DetailRow icon="person-outline" label="Full name" value={details.name} />
            <DetailRow icon="mail-outline" label="Email" value={details.email} />
            <DetailRow icon="call-outline" label="Mobile number" value={details.phoneNumber} isLast />
          </>
        )}
      </GlassCard>

      <Text style={styles.sectionTitle}>Compliance</Text>
      <GlassCard style={styles.sectionCard}>
        <DetailRow icon="shield-checkmark-outline" label="KYC status" value={details.kycStatus} />
        <DetailRow icon="checkmark-circle-outline" label="Account status" value={details.accountStatus} />
        <DetailRow icon="document-text-outline" label="KYC submitted" value={details.kycSubmittedAt} isLast />
      </GlassCard>

      <Text style={styles.sectionTitle}>Session</Text>
      <GlassCard style={styles.sectionCard}>
        <DetailRow icon="time-outline" label="Last login" value={details.lastLoginAt} isLast />
      </GlassCard>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      <View style={styles.buttonWrap}>
        <AppButton title="Edit profile" onPress={() => navigation.navigate('ProfileEdit')} />
        <AppButton
          title="Security & PIN"
          variant="ghost"
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SecurityPin')}
        />
      </View>
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

type DetailRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
};

function DetailRow({ icon, label, value, isLast }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <View style={styles.detailIconWrap}>
        <Ionicons color={colors.primary} name={icon} size={16} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type StatusBadgeProps = {
  labelPrefix: string;
  value: string;
  tone: 'success' | 'warning' | 'default';
};

function StatusBadge({ labelPrefix, value, tone }: StatusBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
      ]}
    >
      <Text style={styles.badgeText}>
        {labelPrefix}: {value}
      </Text>
    </View>
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
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(246, 251, 247, 0.2)',
    borderColor: 'rgba(243, 228, 197, 0.3)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    color: '#F2E5C4',
    fontFamily: typography.bodyBold,
    fontSize: 18,
  },
  heroMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    color: '#F5FBF7',
    fontFamily: typography.heading,
    fontSize: 18,
  },
  email: {
    color: 'rgba(224, 234, 228, 0.86)',
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  badge: {
    backgroundColor: 'rgba(8, 30, 23, 0.35)',
    borderColor: 'rgba(239, 223, 186, 0.2)',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: spacing.md,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(22, 74, 54, 0.56)',
    borderColor: 'rgba(173, 219, 192, 0.35)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(100, 65, 14, 0.42)',
    borderColor: 'rgba(241, 217, 172, 0.3)',
  },
  badgeText: {
    color: '#EBDCB8',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderColor: '#D5E2DA',
    marginTop: spacing.sm,
  },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  detailRow: {
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  detailIconWrap: {
    alignItems: 'center',
    backgroundColor: '#ECF5F0',
    borderColor: '#D3E6DB',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  detailBody: {
    flex: 1,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  detailValue: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 15,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
  },
  buttonWrap: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  secondaryButton: {
    minHeight: 48,
  },
  bottomSpace: {
    height: spacing.xxl,
  },
});
