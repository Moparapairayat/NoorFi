import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { useWallet } from '../../context/WalletContext';
import { ApiError, getMe, getTransactions, getWallets, TransactionRecord } from '../../services/api';
import { colors, pressStyles, radius, spacing, typography } from '../../theme';
import { MainTabParamList, RootStackParamList } from '../../types/navigation';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type HomeAction = {
  id: 'withdraw' | 'exchange' | 'charity';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type HomeTxFilter = 'all' | 'incoming' | 'outgoing';

type HomeTransaction = {
  id: string;
  title: string;
  time: string;
  amountUsd: number;
  direction: 'incoming' | 'outgoing';
  status: string;
  statusType: 'pending' | 'completed';
  icon: keyof typeof Ionicons.glyphMap;
};

const homeActions: HomeAction[] = [
  { id: 'withdraw', label: 'Withdraw', icon: 'arrow-down' },
  { id: 'exchange', label: 'Exchange', icon: 'swap-horizontal' },
  { id: 'charity', label: 'Sadaqah', icon: 'heart-outline' },
];

const txFilters: { id: HomeTxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' },
];

const prayerSchedule = [
  { name: 'Fajr', at: '05:08' },
  { name: 'Dhuhr', at: '12:17' },
  { name: 'Asr', at: '15:42' },
  { name: 'Maghrib', at: '18:06' },
  { name: 'Isha', at: '19:25' },
];

const currencyRate: Record<string, number> = {
  usd: 1,
  usdt: 1,
  sol: 170,
};

function toUsdValue(currency: string, amount: number): number {
  const rate = currencyRate[currency.toLowerCase()] ?? 1;
  return amount * rate;
}

function formatTransactionTime(isoDate: string | null): string {
  if (!isoDate) {
    return 'Recently';
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function iconForTransaction(type: string, direction: 'incoming' | 'outgoing'): keyof typeof Ionicons.glyphMap {
  if (type === 'deposit') return 'add';
  if (type === 'send') return 'paper-plane-outline';
  if (type === 'withdraw') return 'arrow-down-outline';
  if (type === 'exchange') return 'swap-horizontal-outline';
  if (type === 'card_apply') return 'card-outline';
  if (direction === 'incoming') return 'arrow-down-outline';
  return 'arrow-up-outline';
}

function mapToHomeTransaction(item: TransactionRecord): HomeTransaction {
  const direction = item.direction === 'credit' ? 'incoming' : 'outgoing';
  const amountUsd = toUsdValue(item.currency, item.amount) * (direction === 'incoming' ? 1 : -1);
  const title = item.description?.trim() || item.type.replace('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  return {
    id: String(item.id),
    title,
    time: formatTransactionTime(item.occurred_at ?? item.created_at),
    amountUsd,
    direction,
    status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    statusType: item.status === 'completed' ? 'completed' : 'pending',
    icon: iconForTransaction(item.type, direction),
  };
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'NF';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function nextPrayer(now: Date): {
  name: string;
  at: string;
  left: string;
  upcoming: { name: string; at: string }[];
  periodLabel: string;
} {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const list = prayerSchedule.map((item) => ({ ...item, mins: toMinutes(item.at) }));
  let idx = list.findIndex((item) => item.mins > currentMinutes);
  let diff = 0;

  if (idx === -1) {
    idx = 0;
    diff = 24 * 60 - currentMinutes + list[0].mins;
  } else {
    diff = list[idx].mins - currentMinutes;
  }

  const h = Math.floor(diff / 60);
  const m = diff % 60;
  const left = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  const upcoming = [1, 2].map((offset) => {
    const next = list[(idx + offset) % list.length];
    return { name: next.name, at: next.at };
  });
  const periodLabel =
    now.getHours() < 12 ? 'Morning schedule' : now.getHours() < 18 ? 'Day schedule' : 'Evening schedule';

  return { name: list[idx].name, at: list[idx].at, left, upcoming, periodLabel };
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { formatFromUsd } = useWallet();
  const [txFilter, setTxFilter] = useState<HomeTxFilter>('all');
  const [now, setNow] = useState(() => new Date());
  const [displayName, setDisplayName] = useState('NoorFi User');
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [portfolioUsd, setPortfolioUsd] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<HomeTransaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshingData, setRefreshingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasFocusedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const glow = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async (forceRefresh: boolean, withLoader: boolean) => {
    const requestId = ++loadRequestRef.current;
    setLoadError(null);

    if (withLoader) {
      setLoadingData(true);
    } else {
      setRefreshingData(true);
    }

    try {
      const [profile, walletResponse, transactionResponse] = await Promise.all([
        getMe({ forceRefresh }),
        getWallets({ forceRefresh }),
        getTransactions({ perPage: 10, forceRefresh }),
      ]);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      setDisplayName(profile.user.name || 'NoorFi User');
      setKycStatus((profile.user.kyc_status ?? '').trim().toLowerCase());
      setPortfolioUsd(Number(walletResponse.summary.total_usd_value ?? 0));
      setTransactions(transactionResponse.data.map(mapToHomeTransaction));
    } catch (error) {
      if (requestId !== loadRequestRef.current) {
        return;
      }

      setLoadError(
        error instanceof ApiError
          ? error.message
          : 'Unable to load latest wallet activity.'
      );
      setPortfolioUsd((value) => (value === null ? 0 : value));
    } finally {
      if (requestId !== loadRequestRef.current) {
        return;
      }

      if (withLoader) {
        setLoadingData(false);
      } else {
        setRefreshingData(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const isInitialFocus = !hasFocusedRef.current;
      hasFocusedRef.current = true;

      void loadDashboard(!isInitialFocus, isInitialFocus);

      return undefined;
    }, [loadDashboard])
  );

  const dateText = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).format(now),
    [now]
  );
  const timeText = useMemo(
    () => new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(now),
    [now]
  );
  const jumuahText = useMemo(() => {
    const days = (5 - now.getDay() + 7) % 7;
    return days === 0 ? 'Jumuah today' : `Jumuah in ${days} day${days > 1 ? 's' : ''}`;
  }, [now]);

  const prayer = useMemo(() => nextPrayer(now), [now]);
  const isKycVerified = useMemo(() => {
    if (!kycStatus) {
      return false;
    }

    return ['approved', 'verified', 'completed', 'complete'].includes(kycStatus);
  }, [kycStatus]);
  const showKycNotice = useMemo(() => {
    if (loadingData && kycStatus === null) {
      return false;
    }
    return !isKycVerified;
  }, [isKycVerified, kycStatus, loadingData]);
  const kycStatusLabel = useMemo(() => {
    if (!kycStatus) {
      return 'Not submitted';
    }

    if (kycStatus === 'in_review') {
      return 'In review';
    }

    if (kycStatus === 'submitted') {
      return 'Submitted';
    }

    if (kycStatus === 'rejected' || kycStatus === 'declined') {
      return 'Action needed';
    }

    return 'Not verified';
  }, [kycStatus]);

  const filteredTx = useMemo(
    () => (txFilter === 'all' ? transactions : transactions.filter((item) => item.direction === txFilter)),
    [txFilter, transactions]
  );

  const incomingTotal = useMemo(
    () => transactions.filter((item) => item.direction === 'incoming').reduce((sum, item) => sum + Math.abs(item.amountUsd), 0),
    [transactions]
  );
  const outgoingTotal = useMemo(
    () => transactions.filter((item) => item.direction === 'outgoing').reduce((sum, item) => sum + Math.abs(item.amountUsd), 0),
    [transactions]
  );
  const pendingCount = useMemo(
    () => transactions.filter((item) => item.statusType === 'pending').length,
    [transactions]
  );

  const glowX = glow.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] });
  const glowY = glow.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-320, 320] });
  const heroAmountText = loadingData && portfolioUsd === null ? '...' : formatFromUsd(portfolioUsd ?? 0);

  const onActionPress = (actionId: HomeAction['id']) => {
    if (actionId === 'withdraw') {
      navigation.navigate('Withdraw');
      return;
    }
    if (actionId === 'exchange') {
      navigation.navigate('Exchange');
      return;
    }
    if (actionId === 'charity') {
      navigation.navigate('Sadaqah', { presetAmount: 10 });
      return;
    }
    navigation.navigate('Activity');
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <LinearGradient
        colors={['#0F3A2C', '#1A5640', '#246A4E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerCard}
      >
        <View style={styles.headerShapeOne} />
        <View style={styles.headerShapeTwo} />
        <View style={styles.headerShapeThree} />

        <View style={styles.headerMainRow}>
          <View style={styles.profileIntro}>
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              style={({ pressed }) => [styles.avatarOuter, pressed && styles.avatarPressed]}
            >
              <LinearGradient
                colors={['#EEDDB8', '#D4B46A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarInner}
              >
                <Text style={styles.avatarText}>{initialsFromName(displayName)}</Text>
              </LinearGradient>
              <View style={styles.avatarOnlineDot} />
            </Pressable>
            <View style={styles.profileMeta}>
              <Text style={styles.salamText}>Assalamu Alaikum</Text>
              <Text numberOfLines={1} style={styles.userName}>{displayName}</Text>
              <Text style={styles.greeting}>May your day be full of barakah</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.noticeBtn, pressed && styles.noticeBtnPressed]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons color="#F7EED6" name="notifications-outline" size={17} />
          </Pressable>
        </View>
      </LinearGradient>

      <Animated.View style={styles.heroCardWrap}>
        <LinearGradient
          colors={['#0D3A2D', '#145843', '#1D7A56']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Animated.View style={[styles.heroGlow, { transform: [{ translateX: glowX }, { translateY: glowY }] }]} />
          <View style={styles.heroArch} />

          <Animated.View style={[styles.heroSheen, { transform: [{ translateX: sheenX }] }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroSheenGradient}
            />
          </Animated.View>

          <View style={styles.heroTopRow}>
            <View style={styles.compliantPill}>
              <Ionicons color="#EAD2A0" name="shield-checkmark-outline" size={13} />
              <Text style={styles.compliantText}>Shariah Compliant</Text>
            </View>
            <Text style={styles.updatedText}>No interest / no riba</Text>
          </View>

          <Text style={styles.heroLabel}>Total value</Text>
          <Text style={styles.heroAmount}>{heroAmountText}</Text>

          <Text style={styles.heroUtilityLabel}>Quick tools</Text>
          <View style={styles.heroUtilityRow}>
            <Pressable
              onPress={() => navigation.navigate('TopUp')}
              style={({ pressed }) => [styles.heroUtilityBtn, pressed && styles.heroUtilityBtnPressed]}
            >
              <View style={styles.heroUtilityIconWrap}>
                <Ionicons color="#EED7A7" name="add-outline" size={13} />
              </View>
              <Text style={styles.heroUtilityText}>Deposit</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Transfer')}
              style={({ pressed }) => [styles.heroUtilityBtn, pressed && styles.heroUtilityBtnPressed]}
            >
              <View style={styles.heroUtilityIconWrap}>
                <Ionicons color="#EED7A7" name="paper-plane-outline" size={13} />
              </View>
              <Text style={styles.heroUtilityText}>Send</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Assets')}
              style={({ pressed }) => [styles.heroUtilityBtn, pressed && styles.heroUtilityBtnPressed]}
            >
              <View style={styles.heroUtilityIconWrap}>
                <Ionicons color="#EED7A7" name="layers-outline" size={13} />
              </View>
              <Text style={styles.heroUtilityText}>Assets</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      {showKycNotice ? (
        <LinearGradient
          colors={['#FFF8E8', '#F6E6C0', '#EBD3A1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.kycNoticeCard}
        >
          <View style={styles.kycNoticeGlow} />
          <View style={styles.kycNoticeGlowSoft} />
          <View style={styles.kycNoticeHead}>
            <View style={styles.kycNoticeTitleWrap}>
              <View style={styles.kycNoticeIconWrap}>
                <Ionicons color="#7E6130" name="shield-outline" size={15} />
              </View>
              <View style={styles.kycNoticeCopy}>
                <Text style={styles.kycNoticeTitle}>Complete KYC verification</Text>
                <Text style={styles.kycNoticeSub}>
                  Verify identity to unlock full card and transfer limits.
                </Text>
              </View>
            </View>
            <View style={styles.kycStatusPill}>
              <Text style={styles.kycStatusText}>{kycStatusLabel}</Text>
            </View>
          </View>
          <View style={styles.kycNoticeDivider} />

          <Pressable
            onPress={() => navigation.navigate('Kyc')}
            style={({ pressed }) => [styles.kycNoticeBtn, pressed && styles.kycNoticeBtnPressed]}
          >
            <Text style={styles.kycNoticeBtnText}>Start verification</Text>
            <View style={styles.kycNoticeBtnIconWrap}>
              <Ionicons color="#F8EED2" name="arrow-forward" size={14} />
            </View>
          </Pressable>
        </LinearGradient>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionHeadTitle}>Quick actions</Text>
        {loadingData || refreshingData ? (
          <Text style={styles.sectionMeta}>
            {loadingData ? 'Syncing latest data...' : 'Refreshing latest data...'}
          </Text>
        ) : null}
        {loadError ? <Text style={styles.sectionMetaError}>{loadError}</Text> : null}
      </View>

      <View style={styles.actionGrid}>
        {homeActions.map((action) => (
          <Pressable
            key={action.id}
            onPress={() => onActionPress(action.id)}
            style={({ pressed }) => [styles.actionTile, pressed && styles.actionTilePressed]}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons color="#1A6B4E" name={action.icon} size={16} />
            </View>
            <Text numberOfLines={1} style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <LinearGradient
        colors={['#FBF6E9', '#F2E7CC', '#E7D7AE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.prayerCard}
      >
        <View style={styles.prayerGlow} />
        <View style={styles.prayerPatternRing} />
        <View style={styles.prayerPatternRingInner} />
        <View style={styles.prayerPatternStar} />
        <View style={styles.prayerHead}>
          <View style={styles.prayerTag}>
            <Ionicons color="#6D5C34" name="moon-outline" size={11} />
            <Text style={styles.prayerTagText}>Next prayer</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.reloadBtn, pressed && styles.reloadBtnPressed]}
            onPress={() => {
              setNow(new Date());
              void loadDashboard(true, false);
            }}
          >
            <Ionicons color="#6D5C34" name="refresh-outline" size={12} />
          </Pressable>
        </View>

        <View style={styles.prayerInfoRow}>
          <View style={styles.prayerInfoChip}>
            <Ionicons color="#7A6430" name="time-outline" size={11} />
            <Text numberOfLines={1} style={styles.prayerInfoText}>{dateText} | {timeText}</Text>
          </View>
          <View style={styles.prayerInfoChip}>
            <Ionicons color="#7A6430" name="moon-outline" size={11} />
            <Text numberOfLines={1} style={styles.prayerInfoText}>{jumuahText}</Text>
          </View>
        </View>

        <View style={styles.prayerMainRow}>
          <View>
            <Text style={styles.prayerTitle}>{prayer.name}</Text>
            <Text style={styles.prayerTime}>{prayer.at}</Text>
            <Text style={styles.prayerMeta}>{prayer.left} | {prayer.periodLabel}</Text>
          </View>
          <View style={styles.prayerFocusIcon}>
            <Ionicons color="#836B33" name="sparkles-outline" size={13} />
            <View style={styles.prayerFocusDot} />
          </View>
        </View>

        <View style={styles.upcomingRow}>
          {prayer.upcoming.map((item, index) => (
            <View key={item.name} style={[styles.upcomingChip, index === 0 && styles.upcomingChipPrimary]}>
              <Text style={styles.upcomingName}>{item.name}</Text>
              <Text style={styles.upcomingAt}>{item.at}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.txCard}>
        <View style={styles.txHead}>
          <Text style={styles.txTitle}>Transactions</Text>
          <Pressable style={({ pressed }) => [styles.seeAllWrap, pressed && styles.seeAllWrapPressed]} onPress={() => navigation.navigate('Activity')}>
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons color="#B08A3A" name="chevron-forward" size={13} />
          </Pressable>
        </View>

        <View style={styles.txSummaryRow}>
          <View style={styles.txSummaryChip}>
            <Text style={styles.txSummaryLabel}>Incoming</Text>
            <Text style={styles.txSummaryValue}>{formatFromUsd(incomingTotal)}</Text>
          </View>
          <View style={styles.txSummaryChip}>
            <Text style={styles.txSummaryLabel}>Outgoing</Text>
            <Text style={styles.txSummaryValue}>{formatFromUsd(outgoingTotal)}</Text>
          </View>
          <View style={[styles.txSummaryChip, styles.txSummaryChipWarning]}>
            <Text style={styles.txSummaryLabel}>Pending</Text>
            <Text style={styles.txSummaryValue}>{pendingCount}</Text>
          </View>
        </View>

        <View style={styles.txFilterRow}>
          {txFilters.map((filter) => {
            const active = txFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => setTxFilter(filter.id)}
                style={({ pressed }) => [styles.txFilterChip, active && styles.txFilterChipActive, pressed && styles.txFilterChipPressed]}
              >
                <Text style={[styles.txFilterText, active && styles.txFilterTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {filteredTx.length === 0 ? (
          <View style={styles.txEmptyState}>
            <Ionicons color="#86A193" name="receipt-outline" size={18} />
            <Text style={styles.txEmptyTitle}>No transactions in this filter</Text>
            <Text style={styles.txEmptyMeta}>Try another filter to see recent activity.</Text>
          </View>
        ) : (
          filteredTx.map((item, index) => (
            <View key={item.id} style={[styles.txRow, index === filteredTx.length - 1 && styles.txRowLast]}>
              <View style={[styles.txIconWrap, item.statusType === 'completed' ? styles.txIconDone : styles.txIconWait]}>
                <Ionicons color={item.statusType === 'completed' ? '#1B7A57' : '#A5711B'} name={item.icon} size={15} />
              </View>
              <View style={styles.txMeta}>
                <Text style={styles.txItemTitle}>{item.title}</Text>
                <Text style={styles.txTime}>{item.time}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>{formatFromUsd(item.amountUsd, true)}</Text>
                <View style={styles.txStatusRow}>
                  <View style={[styles.txStatusDot, item.statusType === 'completed' ? styles.txStatusDotDone : styles.txStatusDotWait]} />
                  <Text style={styles.txStatusText}>{item.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.footSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl + spacing.xl,
    paddingTop: spacing.lg,
  },
  headerCard: {
    borderColor: '#2F8262',
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  headerShapeOne: {
    backgroundColor: 'rgba(244, 226, 182, 0.18)',
    borderRadius: radius.pill,
    height: 168,
    position: 'absolute',
    right: -52,
    top: -64,
    width: 168,
  },
  headerShapeTwo: {
    borderColor: 'rgba(244, 226, 182, 0.28)',
    borderRadius: radius.pill,
    borderWidth: 1.6,
    height: 112,
    position: 'absolute',
    right: 16,
    top: 8,
    transform: [{ rotate: '8deg' }],
    width: 92,
  },
  headerShapeThree: {
    backgroundColor: 'rgba(8, 27, 20, 0.2)',
    borderRadius: radius.lg,
    bottom: 10,
    left: 10,
    position: 'absolute',
    right: 10,
    top: 76,
  },
  salamText: {
    color: '#EFD8A6',
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  headerMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  profileIntro: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileMeta: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  userName: {
    color: '#F6FBF7',
    fontFamily: typography.heading,
    fontSize: 23,
    letterSpacing: -0.25,
  },
  greeting: {
    color: 'rgba(228, 236, 232, 0.86)',
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1,
  },
  avatarOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarPressed: pressStyles.icon,
  avatarInner: {
    alignItems: 'center',
    borderColor: 'rgba(21, 84, 61, 0.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  avatarText: {
    color: '#153629',
    fontFamily: typography.bodyBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  avatarOnlineDot: {
    backgroundColor: '#1FAE71',
    borderColor: '#F2F6F2',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    bottom: 2,
    height: 10,
    position: 'absolute',
    right: 0,
    width: 10,
  },
  noticeBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 35, 26, 0.4)',
    borderColor: 'rgba(241, 212, 154, 0.32)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  noticeBtnPressed: pressStyles.icon,
  heroCardWrap: {
    marginTop: 1,
  },
  heroCard: {
    borderColor: '#2A7D5E',
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: 'rgba(255, 211, 138, 0.15)',
    borderRadius: radius.pill,
    height: 180,
    left: -62,
    position: 'absolute',
    top: -80,
    width: 180,
  },
  heroArch: {
    borderColor: 'rgba(242, 215, 160, 0.22)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 104,
    position: 'absolute',
    right: 26,
    top: 18,
    width: 84,
  },
  heroSheen: {
    bottom: 0,
    left: -120,
    position: 'absolute',
    top: 0,
    width: 120,
  },
  heroSheenGradient: {
    flex: 1,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compliantPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 34, 27, 0.35)',
    borderColor: 'rgba(234, 210, 160, 0.3)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: spacing.md,
  },
  compliantText: {
    color: '#F4E5C0',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  updatedText: {
    color: 'rgba(237, 242, 239, 0.75)',
    fontFamily: typography.body,
    fontSize: 11,
  },
  heroLabel: {
    color: 'rgba(236, 241, 238, 0.84)',
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    marginTop: spacing.lg,
  },
  heroAmount: {
    color: '#F8FCFA',
    fontFamily: typography.display,
    fontSize: 39,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  heroUtilityLabel: {
    color: 'rgba(230, 238, 233, 0.74)',
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.45,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  heroUtilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroUtilityBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 27, 21, 0.48)',
    borderColor: 'rgba(238, 220, 185, 0.26)',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  heroUtilityBtnPressed: pressStyles.micro,
  heroUtilityIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(238, 220, 185, 0.14)',
    borderColor: 'rgba(238, 220, 185, 0.32)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  heroUtilityText: {
    color: '#EFDDB8',
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  kycNoticeCard: {
    borderColor: '#D8BE81',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    overflow: 'hidden',
    padding: spacing.md,
    position: 'relative',
    shadowColor: '#9B7A3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2,
  },
  kycNoticeGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
    borderRadius: radius.pill,
    height: 92,
    position: 'absolute',
    right: -30,
    top: -28,
    width: 92,
  },
  kycNoticeGlowSoft: {
    borderColor: 'rgba(133, 99, 43, 0.18)',
    borderRadius: radius.pill,
    borderWidth: 1.2,
    height: 66,
    position: 'absolute',
    right: 12,
    top: 10,
    width: 50,
  },
  kycNoticeHead: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  kycNoticeTitleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  kycNoticeCopy: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  kycNoticeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderColor: 'rgba(125, 95, 43, 0.34)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  kycNoticeTitle: {
    color: '#3F2E13',
    fontFamily: typography.bodyBold,
    fontSize: 15,
  },
  kycNoticeSub: {
    color: '#6E5A30',
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  kycStatusPill: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    borderColor: 'rgba(127, 98, 45, 0.4)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  kycStatusText: {
    color: '#624B21',
    fontFamily: typography.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  kycNoticeDivider: {
    backgroundColor: 'rgba(132, 101, 48, 0.18)',
    height: 1,
    marginTop: spacing.xs,
  },
  kycNoticeBtn: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#2F664D',
    borderColor: '#285942',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  kycNoticeBtnPressed: pressStyles.button,
  kycNoticeBtnText: {
    color: '#F8EED2',
    fontFamily: typography.bodyBold,
    fontSize: 13,
    letterSpacing: 0.15,
    textAlign: 'left',
  },
  kycNoticeBtnIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(238, 220, 181, 0.16)',
    borderColor: 'rgba(238, 220, 181, 0.32)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  sectionHead: {
    marginTop: spacing.lg,
  },
  sectionHeadTitle: {
    color: '#1A352A',
    fontFamily: typography.heading,
    fontSize: 17,
  },
  sectionMeta: {
    color: '#6A7F74',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    marginTop: 3,
  },
  sectionMetaError: {
    color: colors.warning,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    marginTop: 3,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  actionTile: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 80,
    paddingHorizontal: 3,
    paddingVertical: spacing.sm,
    width: '31.5%',
  },
  actionTilePressed: pressStyles.button,
  actionIconWrap: {
    alignItems: 'center',
    backgroundColor: '#E9F2EC',
    borderRadius: radius.pill,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  actionLabel: {
    color: '#18392D',
    fontFamily: typography.bodyBold,
    fontSize: 10,
    marginTop: 5,
    textAlign: 'center',
  },
  prayerCard: {
    borderColor: '#D9C69A',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    position: 'relative',
    shadowColor: '#AA8A47',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  prayerGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: radius.pill,
    height: 64,
    position: 'absolute',
    right: -14,
    top: -18,
    width: 64,
  },
  prayerPatternRing: {
    borderColor: 'rgba(155, 128, 67, 0.18)',
    borderRadius: radius.pill,
    borderWidth: 1.2,
    height: 70,
    left: -28,
    position: 'absolute',
    top: 20,
    width: 70,
  },
  prayerPatternRingInner: {
    borderColor: 'rgba(155, 128, 67, 0.14)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    left: -15,
    position: 'absolute',
    top: 32,
    width: 44,
  },
  prayerPatternStar: {
    backgroundColor: 'rgba(152, 122, 62, 0.2)',
    borderRadius: radius.pill,
    height: 6,
    position: 'absolute',
    right: 14,
    top: 26,
    width: 6,
  },
  prayerHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prayerTag: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderColor: 'rgba(153, 129, 70, 0.42)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 20,
    paddingHorizontal: spacing.xs,
  },
  prayerTagText: {
    color: '#624F24',
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  reloadBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderColor: 'rgba(153, 129, 70, 0.36)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  reloadBtnPressed: pressStyles.micro,
  prayerInfoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  prayerInfoChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(153, 129, 70, 0.32)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    minHeight: 20,
    paddingHorizontal: spacing.xs,
  },
  prayerInfoText: {
    color: '#5F502A',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 9,
  },
  prayerMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  prayerTitle: {
    color: '#46361A',
    fontFamily: typography.heading,
    fontSize: 16,
  },
  prayerTime: {
    color: '#19573E',
    fontFamily: typography.bodyBold,
    fontSize: 14,
    marginTop: 1,
  },
  prayerMeta: {
    color: '#67624D',
    fontFamily: typography.body,
    fontSize: 9,
    marginTop: 1,
  },
  prayerFocusIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
    borderColor: 'rgba(153, 129, 70, 0.38)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    position: 'relative',
    width: 26,
  },
  prayerFocusDot: {
    backgroundColor: '#9E7C38',
    borderRadius: radius.pill,
    height: 4,
    position: 'absolute',
    right: 4,
    top: 4,
    width: 4,
  },
  upcomingRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  upcomingChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderColor: 'rgba(153, 129, 70, 0.32)',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  upcomingChipPrimary: {
    backgroundColor: 'rgba(255, 250, 238, 0.82)',
    borderColor: 'rgba(161, 129, 59, 0.5)',
  },
  upcomingName: {
    color: '#564724',
    fontFamily: typography.bodyBold,
    fontSize: 9,
  },
  upcomingAt: {
    color: '#285C43',
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    marginTop: 0,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE6E2',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  txHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  txTitle: {
    color: '#1A352A',
    fontFamily: typography.heading,
    fontSize: 21,
  },
  seeAllWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  seeAllWrapPressed: pressStyles.text,
  seeAllText: {
    color: '#B08A3A',
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  txSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  txSummaryChip: {
    alignItems: 'center',
    backgroundColor: '#F3F7F4',
    borderColor: '#D9E5DE',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  txSummaryChipWarning: {
    backgroundColor: '#FFF6E6',
    borderColor: '#F2D9A7',
  },
  txSummaryLabel: {
    color: '#6D7F76',
    fontFamily: typography.body,
    fontSize: 10,
  },
  txSummaryValue: {
    color: '#1A362B',
    fontFamily: typography.bodyBold,
    fontSize: 12,
    marginTop: 2,
  },
  txFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  txFilterChip: {
    backgroundColor: '#EEF4F0',
    borderColor: '#D6E2DB',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: spacing.md,
  },
  txFilterChipPressed: pressStyles.chip,
  txFilterChipActive: {
    backgroundColor: '#E4F1EA',
    borderColor: '#BFD8CB',
  },
  txFilterText: {
    color: '#60746A',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
  },
  txFilterTextActive: {
    color: '#1A6B4E',
  },
  txEmptyState: {
    alignItems: 'center',
    backgroundColor: '#F1F6F3',
    borderColor: '#D8E5DD',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  txEmptyTitle: {
    color: '#294236',
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginTop: 6,
  },
  txEmptyMeta: {
    color: '#708379',
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  txRow: {
    alignItems: 'center',
    borderBottomColor: '#EEF2F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingBottom: spacing.md,
  },
  txRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  txIconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  txIconDone: {
    backgroundColor: '#E7F4EE',
  },
  txIconWait: {
    backgroundColor: '#FFF4DF',
  },
  txMeta: {
    flex: 1,
  },
  txItemTitle: {
    color: '#24392F',
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  txTime: {
    color: '#7C8982',
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    color: '#20372D',
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  txStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 2,
  },
  txStatusDot: {
    borderRadius: radius.pill,
    height: 6,
    marginRight: 4,
    width: 6,
  },
  txStatusDotDone: {
    backgroundColor: '#1DA96F',
  },
  txStatusDotWait: {
    backgroundColor: '#D79A2E',
  },
  txStatusText: {
    color: '#7D8A83',
    fontFamily: typography.body,
    fontSize: 10,
  },
  footSpace: {
    height: spacing.xl,
  },
});



