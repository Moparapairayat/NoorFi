import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import {
  CardNetworkBrand,
  CardChipStyle,
  CardPreview,
  CardPreviewTheme,
} from '../../components/CardPreview';
import { GlassCard } from '../../components/GlassCard';
import { Screen } from '../../components/Screen';
import { ApiError, CardRecord, getCards } from '../../services/api';
import { colors, radius, spacing, typography, pressStyles } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const themeOptions: { id: CardPreviewTheme; label: string; colors: [string, string] }[] = [
  { id: 'nebula', label: 'Nebula', colors: ['#1A1E2D', '#6B56E9'] },
  { id: 'midnight', label: 'Midnight', colors: ['#181B24', '#5E677C'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0F2A3B', '#4AC6A8'] },
  { id: 'sunset', label: 'Sunset', colors: ['#3B1630', '#F3A963'] },
  { id: 'islamic', label: 'Islamic', colors: ['#0A3D31', '#D4B46A'] },
  { id: 'emerald', label: 'Emerald', colors: ['#123826', '#8EE3B4'] },
];

const chipOptions: { id: CardChipStyle; label: string }[] = [
  { id: 'gold', label: 'Gold chip' },
  { id: 'platinum', label: 'Platinum chip' },
];
const AUTO_SWIPE_INTERVAL_MS = 2800;

export function CardsScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const carouselRef = useRef<ScrollView | null>(null);
  const [cardType, setCardType] = useState<'virtual' | 'physical'>('virtual');
  const [cardName, setCardName] = useState('NoorFi card');
  const [holderName, setHolderName] = useState('MOPARA PAIR AYAT');
  const [theme, setTheme] = useState<CardPreviewTheme>('islamic');
  const [chipStyle, setChipStyle] = useState<CardChipStyle>('gold');
  const [activeVirtualCard, setActiveVirtualCard] = useState<CardRecord | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const cleanCardName = cardName.trim().length > 0 ? cardName.trim() : 'Custom card';
  const isPhysicalCard = cardType === 'physical';
  const applyCtaTitle = isPhysicalCard ? 'Physical card | Coming soon' : 'Apply for card | 15 USD';
  const previewTheme = theme;
  const previewHolder = activeVirtualCard?.holder_name ?? holderName;
  const baseCardName = activeVirtualCard?.template_name ?? cleanCardName;
  const carouselPageWidth = Math.min(Math.max(width - spacing.xl * 2, 260), 340);

  const previewCards = useMemo(
    () =>
      isPhysicalCard
        ? [
            {
              id: 'physical-mastercard',
              brand: 'mastercard' as CardNetworkBrand,
              name: `${baseCardName} Physical`,
            },
            {
              id: 'physical-visa',
              brand: 'visa' as CardNetworkBrand,
              name: `${baseCardName} Physical Visa`,
            },
          ]
        : [
            {
              id: 'virtual-mastercard',
              brand: 'mastercard' as CardNetworkBrand,
              name: baseCardName,
            },
            {
              id: 'virtual-visa',
              brand: 'visa' as CardNetworkBrand,
              name: `${baseCardName} Visa`,
            },
          ],
    [baseCardName, isPhysicalCard]
  );

  const safeActivePreviewIndex = Math.min(activePreviewIndex, Math.max(previewCards.length - 1, 0));
  const activePreviewCard = previewCards[safeActivePreviewIndex];
  const previewCardName = activePreviewCard?.name ?? baseCardName;
  const previewBrandLabel = activePreviewCard?.brand === 'visa' ? 'VISA' : 'MASTERCARD';

  const loadCards = useCallback(async () => {
    try {
      setCardsError(null);
      const response = await getCards();
      const latestVirtual = response.find((card) => card.type === 'virtual') ?? null;
      setActiveVirtualCard(latestVirtual);
    } catch (error) {
      setCardsError(error instanceof ApiError ? error.message : 'Unable to load cards.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCards();
    }, [loadCards])
  );

  useEffect(() => {
    setActivePreviewIndex(0);
    carouselRef.current?.scrollTo({ x: 0, animated: false });
  }, [cardType, baseCardName]);


  useEffect(() => {
    if (previewCards.length < 2) {
      return;
    }

    const interval = setInterval(() => {
      setActivePreviewIndex((current) => {
        const nextIndex = (current + 1) % previewCards.length;
        carouselRef.current?.scrollTo({ x: nextIndex * carouselPageWidth, animated: true });
        return nextIndex;
      });
    }, AUTO_SWIPE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [carouselPageWidth, previewCards.length]);

  const handleCardSwipeEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / carouselPageWidth);
      const boundedIndex = Math.max(0, Math.min(nextIndex, previewCards.length - 1));
      setActivePreviewIndex(boundedIndex);
    },
    [carouselPageWidth, previewCards.length]
  );

  return (
    <Screen scroll>
      <LinearGradient
        colors={['#0E392D', '#19563F', '#226E4F']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroPatternOne} />
        <View style={styles.heroPatternTwo} />
        <View style={styles.heroPatternThree} />
        <Text style={styles.title}>Cards</Text>
      </LinearGradient>

      <View style={styles.segmentWrap}>
        <Pressable
          onPress={() => setCardType('virtual')}
          style={({ pressed }) => [
            styles.segmentBtn,
            cardType === 'virtual' && styles.segmentBtnActive,
            pressed && styles.segmentBtnPressed,
          ]}
        >
          <Text style={[styles.segmentText, cardType === 'virtual' && styles.segmentTextActive]}>
            Virtual card
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setCardType('physical')}
          style={({ pressed }) => [
            styles.segmentBtn,
            cardType === 'physical' && styles.segmentBtnActive,
            pressed && styles.segmentBtnPressed,
          ]}
        >
          <Text style={[styles.segmentText, cardType === 'physical' && styles.segmentTextActive]}>
            Physical card
          </Text>
        </Pressable>
      </View>

      <View style={[styles.carouselWrap, { width: carouselPageWidth }]}>
        <ScrollView
          ref={carouselRef}
          decelerationRate="fast"
          horizontal
          onMomentumScrollEnd={handleCardSwipeEnd}
          pagingEnabled
          scrollEnabled={false}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
        >
          {previewCards.map((previewCard) => (
            <View key={previewCard.id} style={[styles.carouselPage, { width: carouselPageWidth }]}>
              <View style={styles.cardTapArea}>
                <CardPreview
                  brand={previewCard.brand}
                  chipStyle={chipStyle}
                  holderName={previewHolder}
                  style={styles.cardPreview}
                  theme={previewTheme}
                  showChip={cardType === 'physical'}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {previewCards.length > 1 ? (
        <>
          <View style={styles.carouselDots}>
            {previewCards.map((previewCard, index) => (
              <View
                key={previewCard.id}
                style={[styles.carouselDot, index === safeActivePreviewIndex && styles.carouselDotActive]}
              />
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.cardName}>{previewCardName}</Text>
      <Text style={styles.cardDesc}>
        {activeVirtualCard
          ? `Status: ${activeVirtualCard.status.toUpperCase()} | ${previewBrandLabel} | **** ${activeVirtualCard.last4 ?? '----'}`
          : `${previewBrandLabel} card. Works with Apple & Google Pay. Accepted by 130M+ merchants worldwide.`}
      </Text>
      {cardsError ? <Text style={styles.errorText}>{cardsError}</Text> : null}

      {cardType === 'virtual' && activeVirtualCard ? (
        <AppButton
          title="Open active card"
          variant="ghost"
          style={styles.openCardCta}
          onPress={() => navigation.navigate('CardDetails', { cardId: String(activeVirtualCard.id) })}
        />
      ) : null}

      <GlassCard style={styles.offerBanner}>
        <Text style={styles.offerText}>Transparent fees, no interest model and full spending control.</Text>
      </GlassCard>

      <Text style={styles.sectionLabel}>Theme style</Text>
      <View style={styles.themeGrid}>
        {themeOptions.map((item) => {
          const selected = theme === item.id;

          return (
            <Pressable
              key={item.id}
              accessibilityLabel={`Theme ${item.label}`}
              onPress={() => setTheme(item.id)}
              style={({ pressed }) => [
                styles.themeOption,
                selected && styles.themeOptionSelected,
                pressed && styles.themeOptionPressed,
              ]}
            >
              <LinearGradient
                colors={[item.colors[0], item.colors[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.themeSwatch}
              >
                <View style={styles.themeSwatchSheen} />
              </LinearGradient>

              {selected ? (
                <View style={styles.themeCheckWrap}>
                  <Ionicons color={colors.primary} name="checkmark" size={10} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <GlassCard style={styles.personalWrap}>
        <Text style={styles.personalTitle}>Card personalization</Text>

        <AppInput
          autoCapitalize="words"
          label="Card name"
          maxLength={22}
          onChangeText={setCardName}
          placeholder="Example: Travel Card"
          value={cardName}
        />

        <AppInput
          autoCapitalize="characters"
          label="Card holder name"
          maxLength={26}
          onChangeText={setHolderName}
          placeholder="YOUR FULL NAME"
          value={holderName}
          wrapperStyle={styles.fieldGap}
        />

        {isPhysicalCard ? (
          <>
            <Text style={styles.optionLabel}>Chip style</Text>
            <View style={styles.chipRow}>
              {chipOptions.map((item) => {
                const selected = chipStyle === item.id;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setChipStyle(item.id)}
                    style={({ pressed }) => [
                      styles.chipBtn,
                      selected && styles.chipBtnSelected,
                      pressed && styles.chipBtnPressed,
                    ]}
                  >
                    <Text style={[styles.chipBtnText, selected && styles.chipBtnTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </GlassCard>

      <AppButton
        title={applyCtaTitle}
        style={[styles.applyCta, isPhysicalCard && styles.applyCtaDisabled]}
        onPress={!isPhysicalCard ? () => navigation.navigate('VirtualCardApplySetup', {
          cardType,
          cardName: cleanCardName,
          holderName,
          theme,
          chipStyle,
        }) : undefined}
      />

      <View style={styles.footSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderColor: '#2D7A5D',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
    position: 'relative',
  },
  heroPatternOne: {
    backgroundColor: 'rgba(235, 216, 177, 0.15)',
    borderRadius: radius.pill,
    height: 130,
    position: 'absolute',
    right: -30,
    top: -40,
    width: 130,
  },
  heroPatternTwo: {
    borderColor: 'rgba(235, 216, 177, 0.2)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 88,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 74,
  },
  heroPatternThree: {
    borderColor: 'rgba(235, 216, 177, 0.2)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 68,
    position: 'absolute',
    right: 20,
    top: 20,
    width: 54,
  },
  heroOverline: {
    color: '#EEDDB8',
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4FBF6',
    fontFamily: typography.display,
    fontSize: 36,
    letterSpacing: -0.7,
    marginTop: 2,
  },
  heroSubtitle: {
    color: 'rgba(234, 244, 239, 0.84)',
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.xs,
    maxWidth: '82%',
  },
  segmentWrap: {
    backgroundColor: colors.buttonSoft,
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: spacing.lg,
    padding: 3,
  },
  segmentBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentBtnActive: {
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderWidth: 1,
    shadowColor: '#0F2E22',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  segmentBtnPressed: pressStyles.button,
  segmentText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
  },
  carouselWrap: {
    alignSelf: 'center',
    marginTop: spacing.xxl,
  },
  carouselPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTapArea: {
    padding: 0,
  },
  carouselDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  carouselDot: {
    backgroundColor: '#CCD8D2',
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  carouselDotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
  cardPreview: {
    alignSelf: 'center',
    maxWidth: 274,
    width: '78%',
  },
  cardName: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  cardDesc: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  openCardCta: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    minHeight: 44,
  },
  offerBanner: {
    backgroundColor: '#EAF5EF',
    borderColor: '#CFE6D8',
    marginTop: spacing.lg,
  },
  offerText: {
    color: colors.primaryDark,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  personalWrap: {
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  personalTitle: {
    color: colors.textPrimary,
    fontFamily: typography.heading,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  fieldGap: {
    marginTop: spacing.md,
  },
  optionLabel: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  themeOption: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    padding: 4,
    position: 'relative',
    width: '15.5%',
  },
  themeOptionSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
    elevation: 3,
    shadowColor: '#1D7A56',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  themeOptionPressed: pressStyles.swatch,
  themeSwatch: {
    borderRadius: 6,
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    height: 20,
    width: '100%',
  },
  themeSwatchSheen: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    height: 6,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  themeCheckWrap: {
    alignItems: 'center',
    backgroundColor: '#E5F2EA',
    borderColor: '#C3DECF',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 14,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipBtn: {
    alignItems: 'center',
    backgroundColor: colors.buttonGhostTop,
    borderColor: colors.buttonBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  chipBtnSelected: {
    backgroundColor: colors.buttonSoftStrong,
    borderColor: colors.buttonBorderStrong,
  },
  chipBtnPressed: pressStyles.chip,
  chipBtnText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  chipBtnTextSelected: {
    color: colors.textPrimary,
  },
  applyCta: {
    minHeight: 48,
  },
  applyCtaDisabled: {
    opacity: 0.58,
  },
  footSpace: {
    height: spacing.xxl,
  },
});

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














