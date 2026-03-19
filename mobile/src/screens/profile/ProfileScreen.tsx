import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import {
  ApiError,
  getDiditSessionStatus,
  getKycProfile,
  getMe,
  logout as logoutRequest,
  setAccessToken,
} from '../../services/api';
import { persistSessionToken } from '../../services/security/biometric';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MenuId = 'details' | 'kyc' | 'notifications' | 'security' | 'fees' | 'logout';

type MenuItem = {
  id: MenuId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const identityMenus: MenuItem[] = [
  {
    id: 'details',
    title: 'Profile details',
    subtitle: 'Personal info, email and mobile',
    icon: 'person-outline',
  },
  {
    id: 'kyc',
    title: 'KYC verification',
    subtitle: 'Submit or review identity check',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'security',
    title: 'Security & PIN',
    subtitle: 'Manage PIN and account protection',
    icon: 'lock-closed-outline',
  },
];

const preferenceMenus: MenuItem[] = [
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Alerts, pushes and updates',
    icon: 'notifications-outline',
  },
  {
    id: 'fees',
    title: 'Fees & limits',
    subtitle: 'Transaction charges and caps',
    icon: 'options-outline',
  },
];

const accountMenus: MenuItem[] = [
  {
    id: 'logout',
    title: 'Logout',
    subtitle: 'Sign out from this device',
    icon: 'log-out-outline',
  },
];
const PROFILE_SYNC_INTERVAL_MS = 8000;

function toTitleCase(value?: string | null): string {
  const source = String(value ?? '').trim();

  if (!source) {
    return '--';
  }

  return source
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatSubmittedAt(submittedAt?: string | null): string {
  if (!submittedAt) {
    return '--';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(submittedAt));
  } catch {
    return '--';
  }
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('NoorFi User');
  const [email, setEmail] = useState('--');
  const [accountStatus, setAccountStatus] = useState('--');
  const [kycStatus, setKycStatus] = useState('--');
  const hasFocusedRef = useRef(false);
  const profileLoadRequestRef = useRef(0);

  const initials = useMemo(() => {
    const parts = fullName.split(' ').filter(Boolean);

    if (parts.length === 0) {
      return 'NF';
    }

    const first = parts[0]?.charAt(0) ?? '';
    const second = parts[1]?.charAt(0) ?? '';
    const merged = `${first}${second}`.toUpperCase();
    return merged || 'NF';
  }, [fullName]);

  const normalizedKyc = kycStatus.trim().toLowerCase();
  const isKycApproved = normalizedKyc === 'approved';
  const kycBadgeText = isKycApproved ? 'KYC verified' : 'KYC pending';

  const loadProfile = useCallback(async (options?: {
    silent?: boolean;
    syncDidit?: boolean;
    forceRefresh?: boolean;
  }) => {
    const silent = options?.silent ?? false;
    const syncDidit = options?.syncDidit ?? false;
    const forceRefresh = options?.forceRefresh ?? false;
    const requestId = ++profileLoadRequestRef.current;
    const isStale = () => requestId !== profileLoadRequestRef.current;

    if (!silent) {
      if (!profileReady) {
        setLoadingProfile(true);
      }
      setProfileError(null);
    }

    try {
      let meResponse = await getMe({ forceRefresh });
      if (isStale()) {
        return;
      }

      setFullName(meResponse.user.name || 'NoorFi User');
      setEmail(meResponse.user.email || '--');
      setAccountStatus(toTitleCase(meResponse.user.account_status));
      setKycStatus(toTitleCase(meResponse.user.kyc_status));
      setProfileReady(true);

      if (!silent) {
        setLoadingProfile(false);
      }

      let kycResponse = null;

      try {
        kycResponse = await getKycProfile({ forceRefresh });
        if (!isStale()) {
          setKycStatus(toTitleCase(kycResponse.kyc_status ?? meResponse.user.kyc_status));
        }
      } catch {
        // Keep fallback values from /auth/me
      }

      if (isStale()) {
        return;
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
          if (isStale()) {
            return;
          }

          meResponse = await getMe({ forceRefresh: true });
          if (isStale()) {
            return;
          }

          setFullName(meResponse.user.name || 'NoorFi User');
          setEmail(meResponse.user.email || '--');
          setAccountStatus(toTitleCase(meResponse.user.account_status));
          setKycStatus(toTitleCase(meResponse.user.kyc_status));

          try {
            kycResponse = await getKycProfile({ forceRefresh: true });
            if (!isStale()) {
              setKycStatus(toTitleCase(kycResponse.kyc_status ?? meResponse.user.kyc_status));
            }
          } catch {
            // Keep /auth/me values even if kyc reload fails.
          }
        } catch {
          // Silent fallback: periodic sync should not block profile rendering.
        }
      }
    } catch (error) {
      if (isStale()) {
        return;
      }

      setProfileReady(true);
      if (!silent) {
        setProfileError(error instanceof ApiError ? error.message : 'Unable to load profile data.');
      }
    } finally {
      if (!silent && !isStale()) {
        setLoadingProfile(false);
      }
    }
  }, [profileReady]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const isInitialFocus = !hasFocusedRef.current;
      hasFocusedRef.current = true;

      void loadProfile({
        silent: !isInitialFocus,
        syncDidit: false,
        forceRefresh: !isInitialFocus,
      });

      const interval = setInterval(() => {
        if (!active) {
          return;
        }
        void loadProfile({ silent: true, syncDidit: true, forceRefresh: true });
      }, PROFILE_SYNC_INTERVAL_MS);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [loadProfile])
  );

  const onPressMenu = async (id: MenuId) => {
    if (id === 'details') {
      navigation.navigate('ProfileDetails');
      return;
    }

    if (id === 'kyc') {
      if (loadingKyc) {
        return;
      }

      setLoadingKyc(true);

      try {
        const response = await getKycProfile();
        const profile = response.profile;
        const diditFromRoot = response.didit ?? {};

        if (
          profile
          && ['submitted', 'in_review', 'approved', 'rejected'].includes(String(profile.status))
        ) {
          const didit = profile.didit ?? {};
          navigation.navigate('KycSubmitted', {
            submissionId: `KYC-${String(profile.id).padStart(6, '0')}`,
            submittedAt: formatSubmittedAt(profile.submitted_at),
            reviewEta: response.kyc_status === 'approved' ? 'Completed' : '24-48 hours',
            tierAfterApproval: 'Tier 3',
            diditSessionId: didit.session_id ?? null,
            diditVerificationUrl: didit.session_url ?? null,
            diditProviderStatus: didit.provider_status ?? null,
            diditDecision: didit.decision ?? null,
          });
        } else if (diditFromRoot.session_id || diditFromRoot.session_url) {
          navigation.navigate('KycSubmitted', {
            submissionId: diditFromRoot.session_id ?? 'DIDIT-PENDING',
            submittedAt: '--',
            reviewEta: response.kyc_status === 'approved' ? 'Completed' : '24-48 hours',
            tierAfterApproval: 'Tier 3',
            diditSessionId: diditFromRoot.session_id ?? null,
            diditVerificationUrl: diditFromRoot.session_url ?? null,
            diditProviderStatus: diditFromRoot.provider_status ?? null,
            diditDecision: diditFromRoot.decision ?? null,
          });
        } else {
          navigation.navigate('Kyc');
        }
      } catch (error) {
        navigation.navigate('Kyc');
        if (error instanceof ApiError) {
          Alert.alert('KYC', error.message);
        }
      } finally {
        setLoadingKyc(false);
      }

      return;
    }

    if (id === 'notifications') {
      navigation.navigate('Notifications');
      return;
    }

    if (id === 'security') {
      navigation.navigate('SecurityPin');
      return;
    }

    if (id === 'fees') {
      navigation.navigate('FeesLimits');
      return;
    }

    if (id === 'logout') {
      if (loggingOut) {
        return;
      }

      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLoggingOut(true);
              try {
                await logoutRequest();
              } catch (error) {
                if (error instanceof ApiError) {
                  Alert.alert('Logout', error.message);
                }
              } finally {
                setAccessToken(null);
                try {
                  await persistSessionToken(null);
                } catch {
                  // Ignore secure store cleanup errors.
                }
                setLoggingOut(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            })();
          },
        },
      ]);
    }
  };

  const renderMenuSection = (title: string, items: MenuItem[]) => (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <GlassCard style={styles.menuCard}>
        {items.map((menu, index) => {
          const isLast = index === items.length - 1;
          const isDanger = menu.id === 'logout';
          const rowDisabled = (menu.id === 'kyc' && loadingKyc) || (menu.id === 'logout' && loggingOut);

          return (
            <Pressable
              key={menu.id}
              disabled={rowDisabled}
              onPress={() => void onPressMenu(menu.id)}
              style={({ pressed }) => [
                styles.menuRow,
                isLast && styles.menuRowLast,
                pressed && styles.menuRowPressed,
              ]}
            >
              {menu.id === 'kyc' && loadingKyc ? (
                <ActivityIndicator color={colors.primary} size="small" style={styles.loadingIcon} />
              ) : menu.id === 'logout' && loggingOut ? (
                <ActivityIndicator color={colors.danger} size="small" style={styles.loadingIcon} />
              ) : (
                <View style={[styles.menuIconWrap, isDanger && styles.menuIconWrapDanger]}>
                  <Ionicons
                    color={isDanger ? colors.danger : colors.primary}
                    name={menu.icon as never}
                    size={16}
                  />
                </View>
              )}

              <View style={styles.menuBody}>
                <Text style={[styles.menuTitle, isDanger && styles.menuTitleDanger]}>{menu.title}</Text>
                <Text style={styles.menuSubtitle}>{menu.subtitle}</Text>
              </View>

              <View style={styles.menuRight}>
                {menu.id === 'kyc' ? (
                  <View style={[styles.kycPill, isKycApproved ? styles.kycPillApproved : styles.kycPillPending]}>
                    <Text style={[styles.kycPillText, isKycApproved && styles.kycPillTextApproved]}>
                      {isKycApproved ? 'Verified' : 'Pending'}
                    </Text>
                  </View>
                ) : null}
                <Ionicons
                  color={isDanger ? colors.danger : colors.textMuted}
                  name="chevron-forward"
                  size={16}
                />
              </View>
            </Pressable>
          );
        })}
      </GlassCard>
    </>
  );

  return (
    <Screen scroll>
      <LinearGradient
        colors={['#113A2E', '#1A5A43', '#247255']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroPatternOne} />
        <View style={styles.heroPatternTwo} />
        <Text style={styles.heroOverline}>NoorFi profile</Text>

        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text numberOfLines={1} style={styles.name}>
              {fullName}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {email}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('ProfileEdit')}
            style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
          >
            <Ionicons color="#F2E4C1" name="create-outline" size={15} />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Account: {accountStatus}</Text>
          </View>
          <View style={[styles.badge, isKycApproved ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={styles.badgeText}>{kycBadgeText}</Text>
          </View>
        </View>
      </LinearGradient>

      <Text style={styles.subtitle}>Manage identity, verification, security and app preferences.</Text>

      {loadingProfile && !profileReady ? (
        <GlassCard style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </GlassCard>
      ) : null}

      {!loadingProfile && !isKycApproved ? (
        <GlassCard style={styles.verifyCard}>
          <View style={styles.verifyHeader}>
            <View style={styles.verifyIconWrap}>
              <Ionicons color="#B56D10" name="shield-outline" size={16} />
            </View>
            <Text style={styles.verifyTitle}>Complete KYC to unlock full limits</Text>
          </View>
          <Text style={styles.verifySubtitle}>
            Card issuance and higher limits need identity verification.
          </Text>
          <AppButton
            title={loadingKyc ? 'Opening verification...' : 'Continue verification'}
            onPress={() => void onPressMenu('kyc')}
            style={styles.verifyButton}
          />
        </GlassCard>
      ) : null}

      {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

      {renderMenuSection('Identity & Security', identityMenus)}
      {renderMenuSection('Preferences', preferenceMenus)}
      {renderMenuSection('Account', accountMenus)}
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderColor: '#2F7B5E',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: spacing.lg,
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
  heroMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(246, 251, 247, 0.2)',
    borderColor: 'rgba(243, 228, 197, 0.3)',
    borderRadius: 28,
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
  editBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 36, 28, 0.35)',
    borderColor: 'rgba(242, 228, 197, 0.25)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  editBtnPressed: pressStyles.icon,
  name: {
    color: '#F5FBF7',
    fontFamily: typography.heading,
    fontSize: 18,
  },
  meta: {
    color: 'rgba(224, 234, 228, 0.84)',
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
  loadingCard: {
    alignItems: 'center',
    borderColor: '#D5E2DA',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 54,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  verifyCard: {
    borderColor: '#E8D9BC',
    marginTop: spacing.md,
  },
  verifyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  verifyIconWrap: {
    alignItems: 'center',
    backgroundColor: '#FFF4DD',
    borderColor: '#F2D8A9',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  verifyTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: typography.bodyBold,
    fontSize: 15,
  },
  verifySubtitle: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  verifyButton: {
    marginTop: spacing.md,
    minHeight: 42,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  menuCard: {
    borderColor: '#D5E2DA',
    marginTop: spacing.sm,
  },
  menuRow: {
    alignItems: 'center',
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  menuRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  menuRowPressed: pressStyles.row,
  menuIconWrap: {
    alignItems: 'center',
    backgroundColor: '#ECF5F0',
    borderColor: '#D3E6DB',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  menuIconWrapDanger: {
    backgroundColor: '#FFECEC',
    borderColor: '#F0CDCD',
  },
  menuBody: {
    flex: 1,
  },
  menuTitle: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  menuTitleDanger: {
    color: colors.danger,
  },
  menuSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 1,
  },
  menuRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  kycPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 22,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  kycPillApproved: {
    backgroundColor: '#E4F4EB',
    borderColor: '#C6E1D2',
  },
  kycPillPending: {
    backgroundColor: '#FFF1DB',
    borderColor: '#F1D9AC',
  },
  kycPillText: {
    color: '#8A5A12',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  kycPillTextApproved: {
    color: '#236446',
  },
  loadingIcon: {
    width: 30,
  },
  bottomSpace: {
    height: spacing.xxl,
  },
});
