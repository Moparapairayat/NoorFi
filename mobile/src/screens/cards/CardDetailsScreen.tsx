import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { CardPreview, CardPreviewTheme } from '../../components/CardPreview';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import {
  ApiError,
  CardRecord,
  ProviderCardTransaction,
  RevealedCardDetails,
  TransactionRecord,
  addCardFund,
  freezeCard,
  getCard,
  getCardProviderTransactions,
  getTransactions,
  revealCardDetails,
  unfreezeCard,
  upgradeCardLimit,
  withdrawFromCard,
} from '../../services/api';
import { colors, radius, spacing, typography, pressStyles } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetails'>;

function mapThemeFromApi(theme: string): CardPreviewTheme {
  const normalized = theme.trim().toLowerCase();

  if (
    normalized === 'nebula'
    || normalized === 'midnight'
    || normalized === 'ocean'
    || normalized === 'sunset'
    || normalized === 'islamic'
    || normalized === 'emerald'
  ) {
    return normalized;
  }

  return 'islamic';
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '--';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '--';
  }
}

function maskPan(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) {
    return cardNumber;
  }

  const middleLength = Math.max(digits.length - 8, 0);
  const masked = `${digits.slice(0, 4)}${'*'.repeat(middleLength)}${digits.slice(-4)}`;

  return masked.match(/.{1,4}/g)?.join(' ') ?? masked;
}

function maskCvv(cvv: string): string {
  if (!cvv) {
    return '***';
  }

  return '*'.repeat(Math.max(cvv.length, 3));
}

export function CardDetailsScreen({ navigation, route }: Props) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [card, setCard] = useState<CardRecord | null>(null);
  const [cardTransactions, setCardTransactions] = useState<TransactionRecord[]>([]);
  const [providerTransactions, setProviderTransactions] = useState<ProviderCardTransaction[]>([]);
  const [pin, setPin] = useState('');
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedCardDetails | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [controlLoading, setControlLoading] = useState<'freeze' | 'unfreeze' | 'fund' | 'withdraw' | 'upgrade' | null>(null);
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeAmountAction, setActiveAmountAction] = useState<'fund' | 'withdraw' | null>(null);

  const cardId = Number(route.params.cardId);

  const loadCardData = useCallback(async () => {
    if (!Number.isFinite(cardId) || cardId <= 0) {
      setErrorMessage('Invalid card reference.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const [cardData, txData, providerTxData] = await Promise.all([
        getCard(cardId),
        getTransactions({ perPage: 100 }),
        getCardProviderTransactions(cardId, 20).catch(() => [] as ProviderCardTransaction[]),
      ]);

      const txRows = txData.data
        .filter((row) => {
          if (!row.type.startsWith('card_')) {
            return false;
          }

          const relatedType = row.related_type?.toLowerCase() ?? '';
          if (row.related_id === cardId && relatedType.includes('card')) {
            return true;
          }

          const meta = row.meta ?? {};
          const metaCardIdRaw = meta.card_id;
          const metaCardId =
            typeof metaCardIdRaw === 'number'
              ? metaCardIdRaw
              : typeof metaCardIdRaw === 'string'
                ? Number(metaCardIdRaw)
                : NaN;

          if (Number.isFinite(metaCardId) && metaCardId === cardId) {
            return true;
          }

          const metaProviderCardId = typeof meta.provider_card_id === 'string'
            ? meta.provider_card_id.trim()
            : '';
          const providerCardId = cardData.provider_card_id?.trim() ?? '';

          return providerCardId !== '' && metaProviderCardId !== '' && metaProviderCardId === providerCardId;
        })
        .slice(0, 6);

      setCard(cardData);
      setCardTransactions(txRows);
      setProviderTransactions(providerTxData);
      setRevealed(null);
      setShowSensitive(false);
      setPin('');
      setRevealError(null);
      setControlMessage(null);
      setControlError(null);
      setActiveAmountAction(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to load card details.');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useFocusEffect(
    useCallback(() => {
      void loadCardData();
    }, [loadCardData])
  );

  const handleRevealPress = useCallback(async () => {
    if (!Number.isFinite(cardId) || cardId <= 0) {
      return;
    }

    if (revealed) {
      setShowSensitive((current) => !current);
      return;
    }

    const trimmedPin = pin.trim();
    if (trimmedPin.length < 4) {
      setRevealError('Enter your transaction PIN to reveal card details.');
      return;
    }

    setRevealLoading(true);
    setRevealError(null);

    try {
      const response = await revealCardDetails(cardId, trimmedPin);
      setCard(response.card);
      setRevealed(response.sensitive);
      setShowSensitive(true);
      setPin('');
    } catch (error) {
      setRevealError(error instanceof ApiError ? error.message : 'Unable to reveal card details.');
    } finally {
      setRevealLoading(false);
    }
  }, [cardId, pin, revealed]);

  const expiryDate = useMemo(() => {
    if (!card?.expiry_month || !card?.expiry_year) {
      return '--/--';
    }

    const yearShort = String(card.expiry_year).slice(-2);
    return `${String(card.expiry_month).padStart(2, '0')}/${yearShort}`;
  }, [card]);

  const isPhysicalCard = card?.type === 'physical';
  const isCardFrozen = useMemo(() => {
    if (!card) {
      return false;
    }

    const status = card.status.trim().toLowerCase();
    const providerStatusRaw = card.meta?.provider_status;
    const providerStatus =
      typeof providerStatusRaw === 'string' ? providerStatusRaw.trim().toLowerCase() : '';

    return status === 'frozen' || status === 'freeze' || providerStatus === 'frozen' || providerStatus === 'freeze';
  }, [card]);
  const theme = mapThemeFromApi(card?.theme ?? 'islamic');
  const previewCardNumber = revealed?.card_number ?? card?.masked_number ?? `**** **** **** ${card?.last4 ?? '----'}`;
  const previewExpiry = revealed?.expiry ?? expiryDate;
  const previewCvv = revealed?.cvv ?? '***';
  const revealButtonLabel = revealed
    ? showSensitive
      ? 'Hide full details'
      : 'Show full details'
    : revealLoading
      ? 'Verifying PIN...'
      : 'Reveal card details';

  const handleFreezeToggle = useCallback(async () => {
    if (!card || controlLoading) {
      return;
    }

    setControlError(null);
    setControlMessage(null);
    setControlLoading(isCardFrozen ? 'unfreeze' : 'freeze');

    try {
      const response = isCardFrozen ? await unfreezeCard(card.id) : await freezeCard(card.id);
      setCard(response.card);
      setControlMessage(response.message);
    } catch (error) {
      setControlError(
        error instanceof ApiError ? error.message : 'Unable to update card freeze status.'
      );
    } finally {
      setControlLoading(null);
    }
  }, [card, controlLoading, isCardFrozen]);

  const handleAddFund = useCallback(async () => {
    if (!card || controlLoading) {
      return;
    }

    const amount = Number(fundAmount.trim());

    if (!Number.isFinite(amount) || amount <= 0) {
      setControlError('Enter a valid add fund amount.');
      return;
    }

    setControlError(null);
    setControlMessage(null);
    setControlLoading('fund');

    try {
      const response = await addCardFund(card.id, { amount });
      setCard(response.card);
      setControlMessage(response.message);
      setFundAmount('');
      setActiveAmountAction(null);
    } catch (error) {
      setControlError(error instanceof ApiError ? error.message : 'Unable to add fund to card.');
    } finally {
      setControlLoading(null);
    }
  }, [card, controlLoading, fundAmount]);

  const handleWithdrawFromCard = useCallback(async () => {
    if (!card || controlLoading) {
      return;
    }

    const amount = Number(withdrawAmount.trim());

    if (!Number.isFinite(amount) || amount <= 0) {
      setControlError('Enter a valid withdrawal amount.');
      return;
    }

    setControlError(null);
    setControlMessage(null);
    setControlLoading('withdraw');

    try {
      const response = await withdrawFromCard(card.id, { amount });
      setCard(response.card);
      setControlMessage(response.message);
      setWithdrawAmount('');
      setActiveAmountAction(null);
    } catch (error) {
      setControlError(error instanceof ApiError ? error.message : 'Unable to withdraw from card.');
    } finally {
      setControlLoading(null);
    }
  }, [card, controlLoading, withdrawAmount]);
  const handleUpgradeLimit = useCallback(async () => {
    if (!card || controlLoading) {
      return;
    }

    setControlError(null);
    setControlMessage(null);
    setControlLoading('upgrade');

    try {
      const response = await upgradeCardLimit(card.id);
      setCard(response.card);
      setControlMessage(response.message);
    } catch (error) {
      setControlError(error instanceof ApiError ? error.message : 'Unable to upgrade card limit.');
    } finally {
      setControlLoading(null);
    }
  }, [card, controlLoading]);

  const handleQuickActionPress = useCallback((action: 'freeze' | 'fund' | 'withdraw' | 'upgrade') => {
    if (controlLoading !== null) {
      return;
    }

    if (action === 'freeze') {
      setActiveAmountAction(null);
      void handleFreezeToggle();
      return;
    }

    if (action === 'upgrade') {
      setActiveAmountAction(null);
      void handleUpgradeLimit();
      return;
    }

    setControlError(null);
    setControlMessage(null);
    setActiveAmountAction(action);
  }, [controlLoading, handleFreezeToggle, handleUpgradeLimit]);
  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>

        <View style={styles.topCenter}>
          <Text style={styles.title}>Card details</Text>
          <Text style={styles.subTitle}>
            {card ? `${card.brand} | ${card.type.toUpperCase()} | **** ${card.last4 ?? '----'}` : 'Loading card'}
          </Text>
        </View>

        <Pressable
          onPress={() => void loadCardData()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons color={colors.textPrimary} name="refresh-outline" size={18} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading card data...</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {card ? (
        <>
          <CardPreview
            holderName={card.holder_name}
            cardNumber={previewCardNumber}
            expiryDate={previewExpiry}
            cvv={previewCvv}
            maskCardNumber={!showSensitive}
            orientation="landscape"
            side="front"
            showChip={isPhysicalCard}
            theme={theme}
            style={styles.cardPreview}
          />

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusChip,
                isCardFrozen ? styles.statusChipFrozen : styles.statusChipLive,
              ]}
            >
              <View style={[styles.statusDot, isCardFrozen && styles.statusDotFrozen]} />
              <Text style={isCardFrozen ? styles.statusTextFrozen : styles.statusTextLive}>
                {card.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>{card.currency} wallet linked</Text>
            </View>
            {card.provider ? (
              <View style={styles.statusChip}>
                <Text style={styles.statusText}>{card.provider}</Text>
              </View>
            ) : null}
          </View>

          <GlassCard style={styles.controlCard}>
            <Text style={styles.sectionTitle}>Card controls</Text>
            <Text style={styles.controlHint}>
              Strowallet actions: freeze/unfreeze, add fund, withdraw to wallet, and limit upgrade.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.controlActionRow}
            >
              <Pressable
                disabled={controlLoading !== null}
                onPress={() => handleQuickActionPress('freeze')}
                style={({ pressed }) => [
                  styles.controlBlock,
                  styles.controlBlockFreeze,
                  isCardFrozen && styles.controlBlockFreezeActive,
                  pressed && styles.controlBlockPressed,
                ]}
              >
                <View style={[styles.controlBlockStripe, styles.controlBlockStripeFreeze]} />
                <View style={[styles.controlBlockIconWrap, styles.controlBlockIconWrapFreeze]}>
                  <Ionicons
                    color={isCardFrozen ? '#A62E2E' : '#15543D'}
                    name={isCardFrozen ? 'lock-open-outline' : 'lock-closed-outline'}
                    size={18}
                  />
                </View>
                <Text style={styles.controlBlockTitle}>
                  {controlLoading === 'freeze' || controlLoading === 'unfreeze'
                    ? 'Updating...'
                    : isCardFrozen ? 'Unfreeze' : 'Freeze'}
                </Text>
                <Text style={styles.controlBlockMeta}>{isCardFrozen ? 'Unlock card' : 'Lock card'}</Text>
              </Pressable>

              <Pressable
                disabled={controlLoading !== null}
                onPress={() => handleQuickActionPress('fund')}
                style={({ pressed }) => [
                  styles.controlBlock,
                  styles.controlBlockFund,
                  activeAmountAction === 'fund' && styles.controlBlockFundActive,
                  pressed && styles.controlBlockPressed,
                ]}
              >
                <View style={[styles.controlBlockStripe, styles.controlBlockStripeFund]} />
                <View style={[styles.controlBlockIconWrap, styles.controlBlockIconWrapFund]}>
                  <Ionicons color='#0D8A55' name="add-circle-outline" size={18} />
                </View>
                <Text style={styles.controlBlockTitle}>Add fund</Text>
                <Text style={styles.controlBlockMeta}>Top up card</Text>
              </Pressable>

              <Pressable
                disabled={controlLoading !== null}
                onPress={() => handleQuickActionPress('withdraw')}
                style={({ pressed }) => [
                  styles.controlBlock,
                  styles.controlBlockWithdraw,
                  activeAmountAction === 'withdraw' && styles.controlBlockWithdrawActive,
                  pressed && styles.controlBlockPressed,
                ]}
              >
                <View style={[styles.controlBlockStripe, styles.controlBlockStripeWithdraw]} />
                <View style={[styles.controlBlockIconWrap, styles.controlBlockIconWrapWithdraw]}>
                  <Ionicons color='#1D64B2' name="arrow-up-circle-outline" size={18} />
                </View>
                <Text style={styles.controlBlockTitle}>Withdraw</Text>
                <Text style={styles.controlBlockMeta}>Move to wallet</Text>
              </Pressable>

              <Pressable
                disabled={controlLoading !== null}
                onPress={() => handleQuickActionPress('upgrade')}
                style={({ pressed }) => [
                  styles.controlBlock,
                  styles.controlBlockUpgrade,
                  pressed && styles.controlBlockPressed,
                ]}
              >
                <View style={[styles.controlBlockStripe, styles.controlBlockStripeUpgrade]} />
                <View style={[styles.controlBlockIconWrap, styles.controlBlockIconWrapUpgrade]}>
                  <Ionicons color='#8E6300' name="trending-up-outline" size={18} />
                </View>
                <Text style={styles.controlBlockTitle}>
                  {controlLoading === 'upgrade' ? 'Upgrading...' : 'Upgrade'}
                </Text>
                <Text style={styles.controlBlockMeta}>Raise limit</Text>
              </Pressable>
            </ScrollView>

            {activeAmountAction ? (
              <View style={styles.controlAmountPanel}>
                <AppInput
                  keyboardType="decimal-pad"
                  label={activeAmountAction === 'fund' ? 'Add fund to card (USD)' : 'Withdraw from card (USD)'}
                  onChangeText={activeAmountAction === 'fund' ? setFundAmount : setWithdrawAmount}
                  placeholder="0.00"
                  value={activeAmountAction === 'fund' ? fundAmount : withdrawAmount}
                  wrapperStyle={styles.controlInput}
                />
                <AppButton
                  disabled={controlLoading !== null}
                  onPress={() => {
                    if (activeAmountAction === 'fund') {
                      void handleAddFund();
                    } else {
                      void handleWithdrawFromCard();
                    }
                  }}
                  style={styles.controlAmountButton}
                  title={
                    activeAmountAction === 'fund'
                      ? controlLoading === 'fund'
                        ? 'Adding...'
                        : 'Confirm add fund'
                      : controlLoading === 'withdraw'
                        ? 'Withdrawing...'
                        : 'Confirm withdraw'
                  }
                  variant={activeAmountAction === 'fund' ? 'primary' : 'ghost'}
                />
              </View>
            ) : null}
            {controlMessage ? <Text style={styles.controlSuccess}>{controlMessage}</Text> : null}
            {controlError ? <Text style={styles.controlError}>{controlError}</Text> : null}
          </GlassCard>

          <GlassCard style={styles.revealCard}>
            <Text style={styles.sectionTitle}>Secure card details</Text>
            <Text style={styles.revealHint}>Use your transaction PIN to access full PAN and CVV.</Text>

            {!revealed ? (
              <AppInput
                keyboardType="number-pad"
                label="Transaction PIN"
                maxLength={6}
                onChangeText={setPin}
                placeholder="Enter PIN"
                secureTextEntry
                value={pin}
                wrapperStyle={styles.revealInput}
              />
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.key}>Card number</Text>
                  <Text style={styles.val}>{showSensitive ? revealed.card_number : maskPan(revealed.card_number)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Expiry</Text>
                  <Text style={styles.val}>{revealed.expiry ?? expiryDate}</Text>
                </View>
                <View style={styles.rowLast}>
                  <Text style={styles.key}>CVV</Text>
                  <Text style={styles.val}>{showSensitive ? revealed.cvv : maskCvv(revealed.cvv)}</Text>
                </View>
              </>
            )}

            {revealError ? <Text style={styles.revealError}>{revealError}</Text> : null}

            <AppButton
              onPress={() => {
                if (!revealLoading) {
                  void handleRevealPress();
                }
              }}
              title={revealButtonLabel}
              variant={revealed ? 'ghost' : 'primary'}
            />
          </GlassCard>

          <GlassCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Card summary</Text>

            <View style={styles.row}>
              <Text style={styles.key}>Card name</Text>
              <Text style={styles.val}>{card.template_name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.key}>Cardholder</Text>
              <Text style={styles.val}>{card.holder_name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.key}>Masked number</Text>
              <Text style={styles.val}>{card.masked_number ?? `**** ${card.last4 ?? ''}`}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.key}>Expiry</Text>
              <Text style={styles.val}>{expiryDate}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.key}>Issued at</Text>
              <Text style={styles.val}>{formatDateTime(card.issued_at)}</Text>
            </View>
            <View style={styles.rowLast}>
              <Text style={styles.key}>Provider card ID</Text>
              <Text style={styles.val}>{card.provider_card_id ?? '--'}</Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.feeCard}>
            <Text style={styles.sectionTitle}>Issuance ledger</Text>
            <View style={styles.row}>
              <Text style={styles.key}>Issue fee</Text>
              <Text style={styles.val}>USD {formatUsd(Number((card.meta?.issue_fee as number) ?? 0))}</Text>
            </View>
            <View style={styles.rowLast}>
              <Text style={styles.key}>Prefund amount</Text>
              <Text style={styles.val}>USD {formatUsd(Number((card.meta?.prefund_amount as number) ?? 0))}</Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.txCard}>
            <Text style={styles.sectionTitle}>Provider card activity</Text>
            {providerTransactions.length === 0 ? (
              <Text style={styles.emptyText}>No provider transactions yet.</Text>
            ) : (
              providerTransactions.map((tx, index) => (
                <View key={`${tx.id}_${index}`} style={[styles.txRow, index === providerTransactions.length - 1 && styles.txRowLast]}>
                  <View style={[styles.txIconWrap, tx.direction === 'credit' && styles.txIconCredit]}>
                    <Ionicons
                      color={tx.direction === 'credit' ? colors.success : colors.primary}
                      name={tx.direction === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={16}
                    />
                  </View>

                  <View style={styles.txMeta}>
                    <Text style={styles.txMerchant}>{tx.merchant || tx.description || tx.type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.txTime}>{formatDateTime(tx.occurred_at)}</Text>
                  </View>

                  <Text style={[styles.txAmount, tx.direction === 'credit' && styles.txAmountCredit]}>
                    {tx.direction === 'credit' ? '+' : '-'} {tx.currency} {formatUsd(Math.abs(Number(tx.amount ?? 0)))}
                  </Text>
                </View>
              ))
            )}
          </GlassCard>

          <GlassCard style={styles.txCard}>
            <Text style={styles.sectionTitle}>NoorFi card ledger</Text>
            {cardTransactions.length === 0 ? (
              <Text style={styles.emptyText}>No card ledger activity yet.</Text>
            ) : (
              cardTransactions.map((tx, index) => (
                <View key={tx.id} style={[styles.txRow, index === cardTransactions.length - 1 && styles.txRowLast]}>
                  <View style={[styles.txIconWrap, tx.direction === 'credit' && styles.txIconCredit]}>
                    <Ionicons
                      color={tx.direction === 'credit' ? colors.success : colors.primary}
                      name={tx.direction === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={16}
                    />
                  </View>

                  <View style={styles.txMeta}>
                    <Text style={styles.txMerchant}>{tx.description ?? tx.type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.txTime}>{formatDateTime(tx.occurred_at ?? tx.created_at)}</Text>
                  </View>

                  <Text style={[styles.txAmount, tx.direction === 'credit' && styles.txAmountCredit]}>
                    {tx.direction === 'credit' ? '+' : '-'} USD {formatUsd(Math.abs(tx.net_amount))}
                  </Text>
                </View>
              ))
            )}
          </GlassCard>

          <AppButton title="Back to cards" variant="ghost" onPress={() => navigation.goBack()} />
        </>
      ) : null}
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
  topCenter: {
    alignItems: 'center',
    flex: 1,
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
  subTitle: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1,
  },
  loadingWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 13,
    marginLeft: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  cardPreview: {
    alignSelf: 'center',
    marginBottom: spacing.md,
    maxWidth: 370,
    width: '95%',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipLive: {
    backgroundColor: '#EAF9F1',
    borderColor: '#C9ECD8',
  },
  statusChipFrozen: {
    backgroundColor: '#FFF1F1',
    borderColor: '#F1CACA',
  },
  statusDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  statusDotFrozen: {
    backgroundColor: colors.danger,
  },
  statusText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  statusTextLive: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  statusTextFrozen: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  controlCard: {
    marginBottom: spacing.lg,
  },
  controlHint: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  controlActionRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingRight: spacing.xs,
  },
  controlBlock: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 96,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    position: 'relative',
    width: 102,
  },
  controlBlockStripe: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  controlBlockStripeFreeze: {
    backgroundColor: '#2F7A5A',
  },
  controlBlockStripeFund: {
    backgroundColor: '#14A66B',
  },
  controlBlockStripeWithdraw: {
    backgroundColor: '#2A78CF',
  },
  controlBlockStripeUpgrade: {
    backgroundColor: '#B8862E',
  },
  controlBlockFreeze: {
    backgroundColor: '#F7FCF9',
    borderColor: '#D6E8DD',
  },
  controlBlockFreezeActive: {
    backgroundColor: '#F0F9F4',
    borderColor: '#6EA688',
    shadowColor: '#2E7A5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  controlBlockFund: {
    backgroundColor: '#F5FBF7',
    borderColor: '#D2EEDF',
  },
  controlBlockFundActive: {
    backgroundColor: '#ECF9F1',
    borderColor: '#63B588',
    shadowColor: '#179A64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  controlBlockWithdraw: {
    backgroundColor: '#F4F9FF',
    borderColor: '#D5E4F7',
  },
  controlBlockWithdrawActive: {
    backgroundColor: '#ECF4FF',
    borderColor: '#6E9CD8',
    shadowColor: '#2D73C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  controlBlockUpgrade: {
    backgroundColor: '#FFF9EF',
    borderColor: '#F0E1C7',
  },
  controlBlockPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  controlBlockIconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 38,
  },
  controlBlockIconWrapFreeze: {
    backgroundColor: '#E6F3EC',
    borderColor: '#C6E2D4',
    borderWidth: 1,
  },
  controlBlockIconWrapFund: {
    backgroundColor: '#E7F7EE',
    borderColor: '#C8EAD8',
    borderWidth: 1,
  },
  controlBlockIconWrapWithdraw: {
    backgroundColor: '#E8F0FD',
    borderColor: '#C9DBF3',
    borderWidth: 1,
  },
  controlBlockIconWrapUpgrade: {
    backgroundColor: '#FCEFD9',
    borderColor: '#F0DCB8',
    borderWidth: 1,
  },
  controlBlockTitle: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    textAlign: 'center',
  },
  controlBlockMeta: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  controlAmountPanel: {
    backgroundColor: '#F8FCFA',
    borderColor: '#D8E9E0',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  controlInput: {
    marginBottom: spacing.sm,
  },
  controlAmountButton: {
    minHeight: 48,
  },
  controlSuccess: {
    color: colors.success,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  controlError: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  revealCard: {
    marginBottom: spacing.lg,
  },
  revealHint: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  revealInput: {
    marginBottom: spacing.md,
  },
  revealError: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  feeCard: {
    marginBottom: spacing.lg,
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
    fontSize: 13,
  },
  val: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    maxWidth: '58%',
    textAlign: 'right',
  },
  txCard: {
    marginBottom: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
  },
  txRow: {
    alignItems: 'center',
    borderBottomColor: '#E5ECE8',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
  },
  txRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  txIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EAF4EE',
    borderRadius: radius.md,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  txIconCredit: {
    backgroundColor: '#E8FAF1',
  },
  txMeta: {
    flex: 1,
  },
  txMerchant: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  txTime: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1,
  },
  txAmount: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  txAmountCredit: {
    color: colors.success,
  },
});





















