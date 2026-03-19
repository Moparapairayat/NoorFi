import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { AppButton } from '../../components/AppButton';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { useWallet } from '../../context/WalletContext';
import { ApiError, clearApiCache, syncDeposit, warmupSessionData } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { RootStackParamList, TopUpMethodId } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TopUpInstructions'>;

type InstructionMeta = {
  title: string;
  subtitle: string;
  networkLabel?: string;
  primaryField: string;
  primaryValue: string;
  secondaryField: string;
  secondaryValue: string;
};

function readText(source: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getInstructionMeta(
  method: TopUpMethodId,
  walletId: string,
  instructions?: Record<string, unknown>
): InstructionMeta {
  if (method === 'heleket') {
    const paymentUrl = readText(instructions, 'payment_url') ?? 'https://pay.heleket.com/checkout';
    const invoiceUuid = readText(instructions, 'invoice_uuid') ?? 'PENDING-INVOICE';
    const network = readText(instructions, 'network');

    return {
      title: 'Pay with Heleket',
      subtitle: 'Complete payment in hosted secure checkout.',
      networkLabel: network,
      primaryField: 'Payment URL',
      primaryValue: paymentUrl,
      secondaryField: 'Invoice ID',
      secondaryValue: invoiceUuid,
    };
  }

  if (method === 'crypto_wallet') {
    const network = readText(instructions, 'network') ?? (walletId === 'sol' ? 'SOL' : 'TRC20');
    const address =
      readText(instructions, 'address') ??
      (walletId === 'sol'
        ? '4KpJ9sMdtqj8K2xwq8aTQzdrDam6DCeA44y7Nys8KM2z'
        : 'TK5vP6sawCJJz7HiN46vP5VYFXe1QHkBLS');

    return {
      title: 'Send to deposit address',
      subtitle: 'Send exact amount from your crypto wallet.',
      networkLabel: network,
      primaryField: 'Network',
      primaryValue: network,
      secondaryField: 'Address',
      secondaryValue: address,
    };
  }

  const binanceId = readText(instructions, 'binance_pay_id') ?? 'NOORFI-9074458';
  const checkoutUrl = readText(instructions, 'checkout_url') ?? readText(instructions, 'deeplink');
  const referenceNote = readText(instructions, 'reference_note') ?? 'NF-REFERENCE';

  return {
    title: 'Pay with Binance Pay',
    subtitle: 'Scan QR or open checkout URL in Binance app for instant funding.',
    primaryField: checkoutUrl ? 'Checkout URL' : 'Binance Pay ID',
    primaryValue: checkoutUrl ?? binanceId,
    secondaryField: 'Reference note',
    secondaryValue: referenceNote,
  };
}

export function TopUpInstructionsScreen({ navigation, route }: Props) {
  const { amount, feeUsd, method, etaLabel, referenceId, walletId, depositId, instructions } =
    route.params;
  const { formatFromUsd } = useWallet();
  const instructionMeta = getInstructionMeta(method, walletId, instructions);
  const qrValue = readText(instructions, 'qr_payload')
    ?? readText(instructions, 'payment_url')
    ?? readText(instructions, 'checkout_url')
    ?? readText(instructions, 'deeplink')
    ?? instructionMeta.primaryValue
    ?? instructionMeta.secondaryValue;
  const qrDataUri = readText(instructions, 'address_qr_code');
  const qrInlineUri = qrDataUri && qrDataUri.startsWith('data:image') ? qrDataUri : null;
  const qrDisplayValue = qrValue.trim();
  const [copiedField, setCopiedField] = useState<'address' | 'binance' | 'heleket' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const syncInFlightRef = useRef(false);
  const completedRef = useRef(false);

  const isProviderSyncMethod =
    method === 'binance_pay' || method === 'heleket' || method === 'crypto_wallet';

  const onCopyValue = async (value: string, field: 'address' | 'binance' | 'heleket') => {
    await Clipboard.setStringAsync(value);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1600);
  };

  const goToSuccess = useCallback((resolvedFeeUsd?: number) => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;

    clearApiCache('/wallets');
    clearApiCache('/transactions');
    clearApiCache('/auth/me');
    void warmupSessionData({ forceRefresh: true });

    navigation.navigate('TopUpSuccess', {
      walletId,
      method,
      amount,
      feeUsd: resolvedFeeUsd ?? feeUsd,
      referenceId,
      depositId,
    });
  }, [amount, depositId, feeUsd, method, navigation, referenceId, walletId]);

  const checkProviderStatus = useCallback(async (silent = false) => {
    if (!isProviderSyncMethod || syncInFlightRef.current || completedRef.current) {
      return;
    }
    syncInFlightRef.current = true;

    if (!silent) {
      setStatusNote(null);
      setSyncing(true);
    }

    try {
      const response = await syncDeposit(depositId);
      if (response.deposit.status === 'completed') {
        goToSuccess(response.deposit.fee);
        return;
      }

      if (!silent) {
        setStatusNote(response.message);
      }
    } catch (error) {
      if (!silent) {
        setStatusNote(error instanceof ApiError ? error.message : 'Unable to sync payment status.');
      }
    } finally {
      syncInFlightRef.current = false;
      if (!silent) {
        setSyncing(false);
      }
    }
  }, [depositId, goToSuccess, isProviderSyncMethod]);

  useEffect(() => {
    if (!isProviderSyncMethod) {
      return;
    }

    void checkProviderStatus(true);
    const intervalId = setInterval(() => {
      void checkProviderStatus(true);
    }, 8000);

    return () => {
      clearInterval(intervalId);
    };
  }, [checkProviderStatus, isProviderSyncMethod]);

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <Text style={styles.title}>Deposit instructions</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <GlassCard style={styles.stepCard}>
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>Step 3 of 3</Text>
        </View>
        <Text style={styles.stepTitle}>{instructionMeta.title}</Text>
        <Text style={styles.stepDesc}>{instructionMeta.subtitle}</Text>
      </GlassCard>

      <GlassCard style={styles.block}>
        <View style={styles.row}>
          <Text style={styles.key}>{instructionMeta.primaryField}</Text>
          {method === 'binance_pay' || method === 'heleket' ? (
            <View style={styles.inlineCopyWrap}>
              <Text style={[styles.val, styles.valInlineCopy]}>{instructionMeta.primaryValue}</Text>
              <Pressable
                onPress={() => onCopyValue(instructionMeta.primaryValue, method === 'heleket' ? 'heleket' : 'binance')}
                style={({ pressed }) => [styles.inlineCopyBtn, pressed && styles.inlineCopyBtnPressed]}
              >
                <Ionicons
                  color="#1A6B4E"
                  name={
                    copiedField === (method === 'heleket' ? 'heleket' : 'binance')
                      ? 'checkmark'
                      : 'copy-outline'
                  }
                  size={13}
                />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.val}>{instructionMeta.primaryValue}</Text>
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>{instructionMeta.secondaryField}</Text>
          <Text style={styles.val}>{instructionMeta.secondaryValue}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Reference code</Text>
          <Text style={styles.val}>{referenceId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Expected processing</Text>
          <Text style={styles.val}>{etaLabel}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={styles.totalKey}>Amount to send</Text>
          <Text style={styles.totalVal}>{formatFromUsd(amount + feeUsd)}</Text>
        </View>
      </GlassCard>

      {method === 'crypto_wallet' || method === 'heleket' || method === 'binance_pay' ? (
        <GlassCard style={styles.qrCard}>
          <Text style={styles.qrTitle}>
            {method === 'heleket' || method === 'binance_pay'
              ? 'Scan QR to open checkout'
              : 'Scan QR to deposit'}
          </Text>
          <View style={styles.qrWrap}>
            {qrInlineUri ? (
              <Image source={{ uri: qrInlineUri }} style={styles.qrImage} />
            ) : (
              <View style={styles.qrSvgWrap}>
                <QRCode
                  backgroundColor="#FFFFFF"
                  color="#0D3428"
                  size={170}
                  value={qrDisplayValue.length > 0 ? qrDisplayValue : 'NOORFI-DEPOSIT'}
                />
              </View>
            )}
          </View>
          {instructionMeta.networkLabel ? (
            <Text style={styles.qrNetwork}>Network: {instructionMeta.networkLabel}</Text>
          ) : null}
          <Text style={styles.qrAddress}>{qrValue}</Text>
          <Pressable
            onPress={() => onCopyValue(qrValue, 'address')}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.copyBtnPressed]}
          >
            <Ionicons
              color="#1A6B4E"
              name={copiedField === 'address' ? 'checkmark' : 'copy-outline'}
              size={14}
            />
            <Text style={styles.copyBtnText}>
              {copiedField === 'address' ? 'Copied' : 'Copy address'}
            </Text>
          </Pressable>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.noticeCard}>
        <Ionicons color="#A37728" name="information-circle-outline" size={16} />
        <Text style={styles.noticeText}>
          {method === 'heleket'
            ? 'After checkout payment, tap the button below. NoorFi will auto-sync Heleket status and credit your wallet when confirmed.'
            : method === 'binance_pay'
              ? 'After Binance Pay checkout, tap the button below. NoorFi will verify provider status and credit your wallet instantly when paid.'
              : `After transfer, tap the button below. NoorFi will confirm on-chain payment and credit your ${walletId.toUpperCase()} wallet.`}
        </Text>
      </GlassCard>

      <AppButton
        title={
          isProviderSyncMethod
            ? syncing
              ? 'Checking payment...'
              : 'Check payment status'
            : 'I have sent the payment'
        }
        onPress={() => {
          if (isProviderSyncMethod) {
            void checkProviderStatus(false);
            return;
          }

          goToSuccess();
        }}
      />
      {statusNote ? <Text style={styles.statusNote}>{statusNote}</Text> : null}
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
  stepCard: {
    backgroundColor: '#EDF7F2',
    borderColor: '#CEE7DA',
    marginBottom: spacing.lg,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F1E8',
    borderColor: '#BFDCCB',
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  stepPillText: {
    color: '#1A6B4E',
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  stepTitle: {
    color: '#183B2E',
    fontFamily: typography.heading,
    fontSize: 20,
    marginTop: spacing.md,
  },
  stepDesc: {
    color: '#4C665B',
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: 3,
  },
  block: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowLast: {
    borderTopColor: '#E5ECE8',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  key: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 14,
  },
  val: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    maxWidth: '58%',
    textAlign: 'right',
  },
  inlineCopyWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    maxWidth: '62%',
  },
  valInlineCopy: {
    maxWidth: '100%',
  },
  inlineCopyBtn: {
    alignItems: 'center',
    backgroundColor: '#EAF4EE',
    borderColor: '#CFE2D6',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  inlineCopyBtnPressed: pressStyles.micro,
  totalKey: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  totalVal: {
    color: colors.primary,
    fontFamily: typography.display,
    fontSize: 22,
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
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#F8FCFA',
    borderColor: '#D6EBDD',
    marginBottom: spacing.lg,
  },
  qrTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  qrWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE6E0',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  qrImage: {
    height: 170,
    width: 170,
  },
  qrSvgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrNetwork: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
  },
  qrAddress: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  copyBtn: {
    alignItems: 'center',
    backgroundColor: '#EAF4EE',
    borderColor: '#CFE2D6',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: spacing.md,
    minHeight: 30,
    paddingHorizontal: spacing.md,
  },
  copyBtnPressed: pressStyles.micro,
  copyBtnText: {
    color: '#1A6B4E',
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  statusNote: {
    color: '#7A6437',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
