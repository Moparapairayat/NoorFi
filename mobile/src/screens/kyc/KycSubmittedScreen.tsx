import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, createSupportTicket, getDiditSessionStatus, startDiditSession } from '../../services/api';
import { launchDiditNativeVerification } from '../../services/kyc/diditNative';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'KycSubmitted'>;
type DiditTone = 'success' | 'warning' | 'danger' | 'muted';

function resolveDiditTone(status: string): DiditTone {
  const value = status.trim().toLowerCase();

  if (
    value.includes('approved')
    || value.includes('verified')
    || value.includes('pass')
    || value.includes('success')
  ) {
    return 'success';
  }

  if (
    value.includes('rejected')
    || value.includes('declined')
    || value.includes('failed')
    || value.includes('expired')
    || value.includes('abandoned')
    || value.includes('cancel')
  ) {
    return 'danger';
  }

  if (
    value.includes('review')
    || value.includes('progress')
    || value.includes('pending')
    || value.includes('started')
  ) {
    return 'warning';
  }

  return 'muted';
}

export function KycSubmittedScreen({ navigation, route }: Props) {
  const { submissionId, submittedAt, reviewEta, tierAfterApproval } = route.params;
  const [diditSessionId, setDiditSessionId] = useState(route.params.diditSessionId ?? null);
  const [diditProviderStatus, setDiditProviderStatus] = useState(
    route.params.diditProviderStatus ?? null
  );
  const [diditDecision, setDiditDecision] = useState(route.params.diditDecision ?? null);
  const [loadingLaunch, setLoadingLaunch] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const diditSummary = useMemo(() => {
    if (diditDecision) {
      return diditDecision;
    }

    if (diditProviderStatus) {
      return diditProviderStatus;
    }

    return 'Not started';
  }, [diditDecision, diditProviderStatus]);

  const isReviewLocked = useMemo(() => {
    const value = diditSummary.trim().toLowerCase();
    return (
      value.includes('review')
      || value.includes('progress')
      || value.includes('pending')
      || value.includes('started')
    );
  }, [diditSummary]);

  const diditTone = useMemo(() => resolveDiditTone(diditSummary), [diditSummary]);
  const isApproved = diditTone === 'success';
  const isRejected = diditTone === 'danger';

  const primaryButtonTitle = useMemo(() => {
    if (isApproved) {
      return 'Verification completed';
    }

    if (loadingLaunch) {
      return 'Opening verification...';
    }

    if (isRejected) {
      return 'Retry verification';
    }

    if (isReviewLocked) {
      return 'Verification in review';
    }

    return diditSessionId ? 'Continue verification' : 'Start verification';
  }, [diditSessionId, isApproved, isRejected, isReviewLocked, loadingLaunch]);

  const onStartVerification = async () => {
    if (loadingLaunch || isReviewLocked || isApproved) {
      return;
    }

    setErrorMessage(null);
    setLoadingLaunch(true);

    try {
      const response = await startDiditSession(true);
      const sessionToken = response.session_token?.trim() ?? '';
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

      setDiditSessionId(latest?.session_id ?? launchResult.sessionId ?? response.session_id ?? null);
      setDiditProviderStatus(
        latest?.provider_status ?? launchResult.providerStatus ?? response.provider_status ?? null
      );
      setDiditDecision(
        latest?.decision
        ?? response.decision
        ?? (launchResult.state === 'approved'
          ? 'Approved'
          : launchResult.state === 'declined'
            ? 'Declined'
            : launchResult.state === 'pending'
              ? 'Pending'
              : null)
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Unable to launch verification.';
      setErrorMessage(message);
    } finally {
      setLoadingLaunch(false);
    }
  };

  const onRefreshStatus = async () => {
    if (loadingRefresh) {
      return;
    }

    setLoadingRefresh(true);
    setErrorMessage(null);

    try {
      const response = await getDiditSessionStatus(true);
      setDiditSessionId(response.session_id ?? null);
      setDiditProviderStatus(response.provider_status ?? null);
      setDiditDecision(response.decision ?? null);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Unable to refresh verification status.';
      setErrorMessage(message);
    } finally {
      setLoadingRefresh(false);
    }
  };

  const openSupportEmailFallback = async (): Promise<boolean> => {
    const subject = encodeURIComponent('NoorFi KYC Support Request');
    const body = encodeURIComponent(
      `Submission ID: ${submissionId}\nCurrent status: ${diditSummary}\n\nPlease help me complete verification.`
    );
    const mailtoUrl = `mailto:support@noorfi.com?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (!supported) {
        return false;
      }

      await Linking.openURL(mailtoUrl);
      return true;
    } catch {
      return false;
    }
  };

  const onContactSupport = async () => {
    if (loadingSupport) {
      return;
    }

    setLoadingSupport(true);

    try {
      const response = await createSupportTicket({
        category: 'kyc',
        submission_id: submissionId,
        subject: 'KYC verification support needed',
        message: `User requested help for submission ${submissionId}. Current status: ${diditSummary}.`,
        meta: {
          didit_status: diditSummary,
          didit_session_id: diditSessionId,
        },
      });

      Alert.alert(
        'Support ticket submitted',
        `Ticket #${response.ticket.id} has been created. NoorFi support will contact you soon.`
      );
    } catch (error) {
      const fallbackOpened = await openSupportEmailFallback();
      if (!fallbackOpened) {
        const message =
          error instanceof ApiError && error.message.trim().length > 0
            ? error.message
            : 'Please email support@noorfi.com for verification help.';
        Alert.alert('Support', message);
      }
    } finally {
      setLoadingSupport(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="close" size={20} />
        </Pressable>
        <Text style={styles.title}>
          {isApproved ? 'Verification approved' : isRejected ? 'Verification declined' : 'Verification submitted'}
        </Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <LinearGradient
        colors={
          isApproved
            ? ['#0B4A37', '#127052', '#1E8A63']
            : isRejected
              ? ['#5C1F26', '#8E2E3A', '#B84A57']
              : ['#10392D', '#195A43', '#257356']
        }
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.successIconWrap}>
          <Ionicons
            color="#EED8A7"
            name={isApproved ? 'checkmark-done' : isRejected ? 'alert-circle' : 'checkmark'}
            size={18}
          />
        </View>
        <Text style={styles.heroOverline}>NoorFi KYC</Text>
        <Text style={styles.heroTitle}>
          {isApproved
            ? 'Identity verified successfully'
            : isRejected
              ? 'Verification needs action'
              : 'Documents received successfully'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {isApproved
            ? 'Your account is now trusted and ready for full NoorFi access.'
            : isRejected
              ? 'Your verification was declined. Update details and retry verification, or contact support.'
              : 'Your verification is being reviewed. You can continue Didit anytime from below.'}
        </Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaPill}>
            <Ionicons
              color="#EED8A7"
              name={isApproved ? 'checkmark-circle-outline' : isRejected ? 'alert-circle-outline' : 'time-outline'}
              size={13}
            />
            <Text style={styles.heroMetaText}>
              {isApproved ? 'Completed' : isRejected ? 'Action required' : reviewEta}
            </Text>
          </View>
          <View style={styles.heroMetaPill}>
            <Ionicons color="#EED8A7" name="layers-outline" size={13} />
            <Text style={styles.heroMetaText}>{tierAfterApproval}</Text>
          </View>
        </View>
      </LinearGradient>

      <GlassCard style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Submission details</Text>
        <View style={styles.row}>
          <Text style={styles.key}>Submission ID</Text>
          <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.val, styles.idValue]}>
            {submissionId}
          </Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.key}>Submitted at</Text>
          <Text style={styles.val}>{submittedAt}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.statusHead}>
          <View style={styles.statusIconWrap}>
            <Ionicons color={colors.primaryDark} name="shield-checkmark-outline" size={15} />
          </View>
          <View style={styles.statusHeadMeta}>
            <Text style={styles.sectionTitle}>Didit verification</Text>
            <Text style={styles.statusSub}>Session managed by Didit</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              diditTone === 'success' && styles.statusPillSuccess,
              diditTone === 'warning' && styles.statusPillWarning,
              diditTone === 'danger' && styles.statusPillDanger,
              diditTone === 'muted' && styles.statusPillMuted,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                diditTone === 'success' && styles.statusPillTextSuccess,
                diditTone === 'warning' && styles.statusPillTextWarning,
                diditTone === 'danger' && styles.statusPillTextDanger,
                diditTone === 'muted' && styles.statusPillTextMuted,
              ]}
            >
              {diditSummary}
            </Text>
          </View>
        </View>

        <View style={styles.sessionWrap}>
          <Text style={styles.sessionLabel}>Didit session ID</Text>
          <Text numberOfLines={1} style={styles.sessionValue}>
            {diditSessionId ?? '--'}
          </Text>
        </View>

        <Text style={styles.statusNote}>
          {diditSessionId
            ? isApproved
              ? 'Verification is approved. No additional verification action is required.'
              : isRejected
                ? 'Verification is declined. You can retry after correcting your details.'
              : isReviewLocked
                ? 'Verification is currently in review. Please wait for final decision before retrying.'
                : 'Verification session is linked. Continue verification opens Didit directly in-app.'
            : 'Start verification to create a secure Didit session.'}
        </Text>
      </GlassCard>

      <GlassCard style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>What happens next</Text>
        <View style={styles.timelineRow}>
          <View style={styles.timelineDotDone} />
          <Text style={styles.timelineText}>KYC form submitted and linked to your account</Text>
        </View>
        <View style={styles.timelineRow}>
          <View style={isApproved ? styles.timelineDotDone : isRejected ? styles.timelineDotDanger : styles.timelineDotActive} />
          <Text style={styles.timelineText}>
            {isApproved
              ? 'Didit document and selfie checks completed'
              : isRejected
                ? 'Didit review returned a decline decision'
              : 'Didit document and selfie checks in progress'}
          </Text>
        </View>
        <View style={styles.timelineRowLast}>
          <View style={isApproved ? styles.timelineDotDone : isRejected ? styles.timelineDotActive : styles.timelineDotIdle} />
          <Text style={styles.timelineText}>
            {isApproved
              ? `Tier upgraded to ${tierAfterApproval}`
              : isRejected
                ? 'Retry verification with corrected details or contact support'
                : 'Tier upgrade applied automatically after approval'}
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={[styles.tipCard, isApproved && styles.tipCardSuccess, isRejected && styles.tipCardDanger]}>
        <Ionicons
          color={isApproved ? '#1E7A52' : isRejected ? '#A73E35' : '#A37728'}
          name={isApproved ? 'shield-checkmark-outline' : isRejected ? 'warning-outline' : 'information-circle-outline'}
          size={16}
        />
        <Text style={[styles.tipText, isRejected && styles.tipTextDanger]}>
          {isApproved
            ? 'Verification is complete. Keep notifications enabled for future security alerts.'
            : isRejected
              ? 'Please verify your submitted details carefully before starting a retry.'
            : 'Keep notifications enabled to receive instant approval or retry updates.'}
        </Text>
      </GlassCard>

      {isRejected ? (
        <GlassCard style={styles.dangerCard}>
          <View style={styles.dangerHead}>
            <Ionicons color="#B5473B" name="help-buoy-outline" size={18} />
            <Text style={styles.dangerTitle}>Need help with re-verification?</Text>
          </View>
          <Text style={styles.dangerBody}>
            Contact NoorFi support with your submission ID for quick assistance.
          </Text>
          <AppButton
            title={loadingSupport ? 'Opening support...' : 'Contact support'}
            variant="ghost"
            disabled={loadingSupport}
            style={styles.dangerButton}
            onPress={() => void onContactSupport()}
          />
        </GlassCard>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {isApproved ? (
        <AppButton title="Go to home" onPress={() => navigation.navigate('MainTabs')} />
      ) : (
        <>
          <AppButton
            title={primaryButtonTitle}
            disabled={loadingLaunch || isReviewLocked}
            onPress={() => void onStartVerification()}
          />
          <AppButton
            title={loadingRefresh ? 'Refreshing status...' : 'Refresh verification status'}
            variant="ghost"
            style={styles.secondaryBtn}
            onPress={() => void onRefreshStatus()}
          />
          <AppButton
            title="Go to home"
            variant="ghost"
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('MainTabs')}
          />
        </>
      )}
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
    alignItems: 'center',
    borderColor: '#2E7B5E',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  successIconWrap: {
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
    marginTop: 4,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(233, 243, 238, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroMetaPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 34, 26, 0.36)',
    borderColor: 'rgba(238, 216, 167, 0.26)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  heroMetaText: {
    color: '#F0DFC0',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  row: {
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  rowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  key: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 14,
  },
  val: {
    color: colors.textPrimary,
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    marginLeft: spacing.sm,
    textAlign: 'right',
  },
  idValue: {
    maxWidth: '64%',
  },
  statusHead: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusIconWrap: {
    alignItems: 'center',
    backgroundColor: '#E9F1EC',
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  statusHeadMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  statusSub: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: -2,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '45%',
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  statusPillSuccess: {
    backgroundColor: '#E9F7EF',
    borderColor: '#9AD1AE',
  },
  statusPillWarning: {
    backgroundColor: '#FFF6E7',
    borderColor: '#E8CB91',
  },
  statusPillDanger: {
    backgroundColor: '#FFF0EF',
    borderColor: '#E5B1AC',
  },
  statusPillMuted: {
    backgroundColor: '#EEF2EF',
    borderColor: '#CFD9D2',
  },
  statusPillText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    textAlign: 'center',
  },
  statusPillTextSuccess: {
    color: '#1D7A4F',
  },
  statusPillTextWarning: {
    color: '#9A6B1B',
  },
  statusPillTextDanger: {
    color: '#B5473B',
  },
  statusPillTextMuted: {
    color: '#5E6E65',
  },
  sessionWrap: {
    backgroundColor: '#F5F8F6',
    borderColor: '#DDE7E1',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sessionLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    marginBottom: 2,
  },
  sessionValue: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  statusNote: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  timelineCard: {
    marginBottom: spacing.lg,
  },
  timelineRow: {
    alignItems: 'center',
    borderBottomColor: '#E8EEEA',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
  },
  timelineRowLast: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 9,
    width: 9,
  },
  timelineDotActive: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    height: 9,
    width: 9,
  },
  timelineDotDanger: {
    backgroundColor: '#D26A5D',
    borderRadius: radius.pill,
    height: 9,
    width: 9,
  },
  timelineDotIdle: {
    backgroundColor: '#C9D6CF',
    borderRadius: radius.pill,
    height: 9,
    width: 9,
  },
  timelineText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  tipCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E8',
    borderColor: '#F0D9AD',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tipCardSuccess: {
    backgroundColor: '#ECF8F1',
    borderColor: '#BDE4CC',
  },
  tipCardDanger: {
    backgroundColor: '#FFF1F0',
    borderColor: '#EBC2BE',
  },
  tipText: {
    color: '#7A6437',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  tipTextDanger: {
    color: '#8B3A34',
  },
  dangerCard: {
    backgroundColor: '#FFF6F5',
    borderColor: '#E8C7C3',
    marginBottom: spacing.lg,
  },
  dangerHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dangerTitle: {
    color: '#8A2E28',
    flex: 1,
    fontFamily: typography.heading,
    fontSize: 15,
  },
  dangerBody: {
    color: '#8A4540',
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  dangerButton: {
    minHeight: 46,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  secondaryBtn: {
    marginTop: spacing.md,
  },
});
