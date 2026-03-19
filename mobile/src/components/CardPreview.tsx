import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, shadows, typography } from '../theme';

export type CardPreviewTheme =
  | 'nebula'
  | 'midnight'
  | 'ocean'
  | 'sunset'
  | 'islamic'
  | 'emerald';
export type CardChipStyle = 'gold' | 'platinum';
export type CardNetworkBrand = 'mastercard' | 'visa';
export type CardPreviewOrientation = 'portrait' | 'landscape';
export type CardPreviewSide = 'front' | 'back';

type CardPreviewProps = {
  style?: StyleProp<ViewStyle>;
  holderName?: string;
  issuerLabel?: string;
  brand?: CardNetworkBrand;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  maskCardNumber?: boolean;
  theme?: CardPreviewTheme;
  chipStyle?: CardChipStyle;
  orientation?: CardPreviewOrientation;
  side?: CardPreviewSide;
  showChip?: boolean;
};

type ThemePalette = {
  gradient: [string, string, string, string];
  glowOne: string;
  glowTwo: string;
};

const themePalette: Record<CardPreviewTheme, ThemePalette> = {
  nebula: {
    gradient: ['#0E1118', '#1A1E2D', '#7157EB', '#2AC79C'],
    glowOne: 'rgba(104, 69, 255, 0.36)',
    glowTwo: 'rgba(42, 199, 156, 0.34)',
  },
  midnight: {
    gradient: ['#0E1015', '#1B1F2B', '#2B3247', '#646B82'],
    glowOne: 'rgba(131, 141, 174, 0.32)',
    glowTwo: 'rgba(83, 96, 130, 0.32)',
  },
  ocean: {
    gradient: ['#071521', '#0F2A3B', '#19647A', '#4AC6A8'],
    glowOne: 'rgba(44, 130, 193, 0.34)',
    glowTwo: 'rgba(74, 198, 168, 0.34)',
  },
  sunset: {
    gradient: ['#1B0E15', '#3B1630', '#B44C6F', '#F3A963'],
    glowOne: 'rgba(255, 111, 145, 0.3)',
    glowTwo: 'rgba(243, 169, 99, 0.3)',
  },
  islamic: {
    gradient: ['#06261E', '#0A3D31', '#0F6B54', '#D4B46A'],
    glowOne: 'rgba(15, 107, 84, 0.34)',
    glowTwo: 'rgba(212, 180, 106, 0.3)',
  },
  emerald: {
    gradient: ['#0B1A12', '#123826', '#1F7A4D', '#8EE3B4'],
    glowOne: 'rgba(42, 154, 98, 0.33)',
    glowTwo: 'rgba(142, 227, 180, 0.32)',
  },
};

type ChipPalette = {
  gradient: [string, string, string];
  border: string;
  highlight: string;
  frame: string;
  line: string;
};

const chipPalette: Record<CardChipStyle, ChipPalette> = {
  gold: {
    gradient: ['#E6C883', '#C79A50', '#8C6632'],
    border: 'rgba(255, 236, 193, 0.6)',
    highlight: 'rgba(255, 255, 255, 0.2)',
    frame: 'rgba(89, 61, 19, 0.55)',
    line: 'rgba(89, 61, 19, 0.5)',
  },
  platinum: {
    gradient: ['#ECEEF2', '#C5CBD5', '#8A95A5'],
    border: 'rgba(255, 255, 255, 0.64)',
    highlight: 'rgba(255, 255, 255, 0.35)',
    frame: 'rgba(86, 96, 114, 0.58)',
    line: 'rgba(86, 96, 114, 0.52)',
  },
};

export function CardPreview({
  style,
  holderName = 'MOPARA PAIR AYAT',
  issuerLabel = 'NoorFi',
  brand = 'mastercard',
  cardNumber,
  expiryDate = '12/29',
  cvv = '847',
  maskCardNumber = true,
  theme = 'islamic',
  chipStyle = 'gold',
  orientation = 'portrait',
  side = 'front',
  showChip = false,
}: CardPreviewProps) {
  const palette = themePalette[theme];
  const chip = chipPalette[chipStyle];
  const safeHolder = holderName.trim().length > 0 ? holderName.trim().toUpperCase() : 'CARD HOLDER';
  const safeIssuer = issuerLabel.trim().length > 0 ? issuerLabel.trim() : 'NoorFi';
  const rawCardNumber = cardNumber?.trim() ?? '';
  const digitsOnlyCardNumber = rawCardNumber.replace(/\D/g, '');
  const visibleCardNumber = digitsOnlyCardNumber.match(/.{1,4}/g)?.join(' ') ?? rawCardNumber;
  const expiryDigits = expiryDate.trim().replace(/\D/g, '');
  const safeExpiry =
    expiryDigits.length >= 4
      ? `${expiryDigits.slice(0, 2)}/${expiryDigits.slice(2, 4)}`
      : expiryDate.trim() || '12/29';
  const rawCvv = cvv.trim();
  const cvvDigits = rawCvv.replace(/\D/g, '');
  const safeCvvRaw = cvvDigits.length >= 3 ? cvvDigits.slice(0, 4) : rawCvv || '847';
  const safeCvv = maskCardNumber ? '*'.repeat(Math.max(safeCvvRaw.length, 3)) : safeCvvRaw;
  const safeCardNumber =
    digitsOnlyCardNumber.length >= 12
      ? maskCardNumber
        ? `${digitsOnlyCardNumber.slice(0, 4)} **** **** ${digitsOnlyCardNumber.slice(-4)}`
        : visibleCardNumber
      : rawCardNumber;
  const isLandscape = orientation === 'landscape';
  const isBack = isLandscape && side === 'back';

  return (
    <LinearGradient
      colors={palette.gradient}
      locations={[0, 0.36, 0.72, 1]}
      start={{ x: 0.1, y: 0.05 }}
      end={{ x: 0.95, y: 0.95 }}
      style={[styles.card, isLandscape ? styles.cardLandscape : styles.cardPortrait, style]}
    >
      <View
        style={[
          styles.glowOne,
          isLandscape ? styles.glowOneLandscape : styles.glowOnePortrait,
          { backgroundColor: palette.glowOne },
        ]}
      />
      <View
        style={[
          styles.glowTwo,
          isLandscape ? styles.glowTwoLandscape : styles.glowTwoPortrait,
          { backgroundColor: palette.glowTwo },
        ]}
      />

      {isBack ? (
        <>
          <View pointerEvents="none" style={styles.backStripeLandscape} />

          <View pointerEvents="none" style={styles.backAuthRowLandscape}>
            <View style={styles.backSignatureLandscape}>
              <Text numberOfLines={1} style={styles.backSignatureTextLandscape}>
                {safeHolder}
              </Text>
            </View>

            <View style={styles.backCvvColLandscape}>
              <Text style={styles.backCvvLabelLandscape}>CVV</Text>
              <View style={styles.backCvvValueWrapLandscape}>
                <Text style={styles.backCvvValueLandscape}>{safeCvv}</Text>
              </View>
            </View>
          </View>

          <Text pointerEvents="none" style={styles.backHintLandscape}>
            CVV is available on back side
          </Text>
        </>
      ) : null}

      {!isBack ? (
        <View
          pointerEvents="none"
          style={
            isLandscape
              ? styles.contactlessWrapLandscape
              : showChip
                ? styles.contactlessWrapPortraitWithChip
                : styles.contactlessWrapPortrait
          }
        >
          <Ionicons
            color="rgba(248, 252, 255, 0.86)"
            name="wifi-outline"
            size={isLandscape ? 18 : 16}
            style={isLandscape ? styles.contactlessIconLandscape : styles.contactlessIconPortrait}
          />
        </View>
      ) : null}

      {!isBack && isLandscape && safeCardNumber ? (
        <View pointerEvents="none" style={styles.cardNumberWrapLandscape}>
          <Text numberOfLines={1} style={styles.cardNumberLandscape}>
            {safeCardNumber}
          </Text>
        </View>
      ) : null}
      {!isBack && isLandscape ? (
        <View pointerEvents="none" style={styles.securityMetaLandscape}>
          <View style={styles.securityMetaItemLandscape}>
            <Text style={styles.securityMetaLabelLandscape}>EXP</Text>
            <Text style={styles.securityMetaValueLandscape}>{safeExpiry}</Text>
          </View>
          <View style={styles.securityMetaItemLandscape}>
            <Text style={styles.securityMetaLabelLandscape}>CVV</Text>
            <Text style={[styles.securityMetaValueLandscape, styles.securityMetaHintLandscape]}>
              BACK SIDE
            </Text>
          </View>
        </View>
      ) : null}

      {!isBack ? (
        <View pointerEvents="none" style={isLandscape ? styles.shariahBadgeLandscape : styles.shariahBadgePortrait}>
          <Ionicons color="#D4B46A" name="moon" size={isLandscape ? 10 : 9} />
          <Text style={isLandscape ? styles.shariahBadgeTextLandscape : styles.shariahBadgeTextPortrait}>
            Shariah
          </Text>
        </View>
      ) : null}

      {!isBack && showChip ? (
        <LinearGradient
          colors={chip.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.chip,
            isLandscape ? styles.chipLandscape : styles.chipPortrait,
            { borderColor: chip.border },
          ]}
        >
          <View style={[styles.chipReflection, { backgroundColor: chip.highlight }]} />
          <View style={[styles.chipFrame, { borderColor: chip.frame }]} />
          <View style={[styles.chipLineHorizontal, { backgroundColor: chip.line }]} />
          <View style={[styles.chipLineVerticalLeft, { backgroundColor: chip.line }]} />
          <View style={[styles.chipLineVerticalCenter, { backgroundColor: chip.line }]} />
          <View style={[styles.chipLineVerticalRight, { backgroundColor: chip.line }]} />
        </LinearGradient>
      ) : null}

      {!isBack ? (
        <View style={[styles.holderWrap, isLandscape ? styles.holderWrapLandscape : styles.holderWrapPortrait]}>
          <Text style={[styles.holderLabel, isLandscape && styles.holderLabelLandscape]}>CARD HOLDER</Text>
          <Text numberOfLines={1} style={[styles.holderName, isLandscape && styles.holderNameLandscape]}>
            {safeHolder}
          </Text>
        </View>
      ) : null}

      {!isBack ? (
        isLandscape ? (
          <Text numberOfLines={1} style={[styles.brand, styles.brandLandscape]}>
            {safeIssuer}
          </Text>
        ) : (
          <View style={styles.brandPortraitWrap}>
            <Text numberOfLines={1} style={[styles.brand, styles.brandPortrait]}>
              {safeIssuer}
            </Text>
          </View>
        )
      ) : null}
      {brand === 'visa' ? (
        <>
          <Text numberOfLines={1} style={[styles.visa, isLandscape ? styles.visaLandscape : styles.visaPortrait]}>
            VISA
          </Text>
          <View style={[styles.markWrap, isLandscape ? styles.markWrapLandscape : styles.markWrapPortrait]}>
            <View style={styles.markLeft} />
            <View style={styles.markRight} />
          </View>
        </>
      ) : (
        <View style={[styles.mastercardWrap, isLandscape ? styles.mastercardWrapLandscape : styles.mastercardWrapPortrait]}>
          <View style={styles.mastercardLogo}>
            <View style={[styles.mastercardCircle, styles.mastercardCircleLeft]} />
            <View style={[styles.mastercardCircle, styles.mastercardCircleRight]} />
          </View>
          <Text style={[styles.mastercardText, isLandscape ? styles.mastercardTextLandscape : styles.mastercardTextPortrait]}>
            mastercard
          </Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    maxWidth: 420,
    overflow: 'hidden',
    width: '100%',
    ...shadows.heavy,
  },
  cardPortrait: {
    aspectRatio: 0.64,
  },
  cardLandscape: {
    aspectRatio: 1.58,
  },
  glowOne: {
    position: 'absolute',
    width: 252,
    height: 252,
    borderRadius: 252,
  },
  glowOnePortrait: {
    top: 142,
    left: -118,
  },
  glowOneLandscape: {
    top: -100,
    left: 120,
  },
  glowTwo: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 214,
  },
  glowTwoPortrait: {
    bottom: -46,
    right: -30,
  },
  glowTwoLandscape: {
    bottom: -130,
    left: -74,
  },
  contactlessWrapLandscape: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 94,
    top: 16,
    width: 26,
    height: 26,
  },
  contactlessIconLandscape: {
    transform: [{ rotate: '90deg' }],
  },
  contactlessWrapPortrait: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 24,
    top: 24,
    width: 24,
    height: 24,
  },
  contactlessWrapPortraitWithChip: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 56,
    top: 138,
    width: 24,
    height: 24,
  },
  contactlessIconPortrait: {
    transform: [{ rotate: '90deg' }],
  },
  cardNumberWrapLandscape: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardNumberLandscape: {
    color: '#F8FCFF',
    fontFamily: typography.bodyBold,
    fontSize: 18,
    letterSpacing: 2.8,
    textAlign: 'center',
    textShadowColor: 'rgba(4, 16, 12, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.4,
  },
  securityMetaLandscape: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 24,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 46,
    justifyContent: 'center',
  },
  securityMetaItemLandscape: {
    alignItems: 'center',
  },
  securityMetaLabelLandscape: {
    color: 'rgba(245, 250, 255, 0.72)',
    fontFamily: typography.bodyMedium,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  securityMetaValueLandscape: {
    color: '#F8FCFF',
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.1,
    marginTop: 1,
  },
  securityMetaHintLandscape: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  shariahBadgeLandscape: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 18, 14, 0.28)',
    borderColor: 'rgba(212, 180, 106, 0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 8,
    position: 'absolute',
    right: 18,
    top: 16,
  },
  shariahBadgeTextLandscape: {
    color: '#F5E8C5',
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  shariahBadgePortrait: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 18, 14, 0.28)',
    borderColor: 'rgba(212, 180, 106, 0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 24,
    paddingHorizontal: 8,
    position: 'absolute',
    left: 24,
    top: 82,
  },
  shariahBadgeTextPortrait: {
    color: '#F5E8C5',
    fontFamily: typography.bodyMedium,
    fontSize: 8,
    letterSpacing: 0.45,
  },
  backStripeLandscape: {
    backgroundColor: 'rgba(4, 8, 11, 0.84)',
    height: 38,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 16,
  },
  backAuthRowLandscape: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 20,
    position: 'absolute',
    right: 20,
    top: 66,
  },
  backSignatureLandscape: {
    backgroundColor: 'rgba(247, 251, 255, 0.94)',
    borderRadius: 4,
    flex: 1,
    height: 34,
    justifyContent: 'center',
    marginRight: 10,
    paddingHorizontal: 10,
  },
  backSignatureTextLandscape: {
    color: '#4D5F5A',
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  backCvvColLandscape: {
    alignItems: 'flex-start',
  },
  backCvvLabelLandscape: {
    color: 'rgba(243, 249, 255, 0.78)',
    fontFamily: typography.bodyMedium,
    fontSize: 8,
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  backCvvValueWrapLandscape: {
    alignItems: 'center',
    backgroundColor: '#F7FBFF',
    borderColor: 'rgba(14, 29, 23, 0.18)',
    borderRadius: 4,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    minWidth: 54,
    paddingHorizontal: 8,
  },
  backCvvValueLandscape: {
    color: '#1A2F29',
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.1,
  },
  backHintLandscape: {
    color: 'rgba(236, 245, 250, 0.7)',
    fontFamily: typography.body,
    fontSize: 9,
    left: 20,
    letterSpacing: 0.5,
    position: 'absolute',
    top: 110,
  },
  chip: {
    position: 'absolute',
    borderRadius: 9,
    borderWidth: 1,
    overflow: 'hidden',
    width: 64,
    height: 46,
  },
  chipPortrait: {
    top: 28,
    left: 24,
  },
  chipLandscape: {
    top: 20,
    left: 20,
    width: 60,
    height: 42,
  },
  chipReflection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
  },
  chipFrame: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipLineHorizontal: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 22,
    height: 2,
    borderRadius: 2,
  },
  chipLineVerticalLeft: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 19,
    width: 2,
    borderRadius: 2,
  },
  chipLineVerticalCenter: {
    position: 'absolute',
    top: 9,
    bottom: 9,
    left: 31,
    width: 2,
    borderRadius: 2,
  },
  chipLineVerticalRight: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 43,
    width: 2,
    borderRadius: 2,
  },
  holderWrap: {
    position: 'absolute',
  },
  holderWrapPortrait: {
    left: 52,
    bottom: 20,
    width: '52%',
  },
  holderWrapLandscape: {
    left: 20,
    bottom: 12,
    width: '62%',
  },
  holderLabel: {
    color: 'rgba(245, 250, 255, 0.7)',
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  holderLabelLandscape: {
    fontSize: 8,
    letterSpacing: 0.9,
  },
  holderName: {
    color: '#F9FCFF',
    fontFamily: typography.bodyBold,
    fontSize: 13,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  holderNameLandscape: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  brand: {
    color: '#F9FCFF',
    fontFamily: typography.bodyBold,
  },
  brandPortraitWrap: {
    position: 'absolute',
    right: 12,
    top: 72,
    bottom: 18,
    width: 42,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  brandPortrait: {
    fontSize: 34,
    letterSpacing: 0.35,
    textAlign: 'center',
    transform: [{ rotate: '90deg' }],
    width: 170,
  },
  brandLandscape: {
    position: 'absolute',
    fontSize: 18,
    left: 40,
    top: 18,
    maxWidth: '42%',
    textAlign: 'left',
    letterSpacing: 0.2,
  },
  visa: {
    color: '#F6FBFF',
    fontFamily: typography.bodyBold,
    position: 'absolute',
  },
  visaPortrait: {
    fontSize: 40,
    left: -6,
    bottom: 74,
    transform: [{ rotate: '90deg' }],
  },
  visaLandscape: {
    fontSize: 22,
    right: 20,
    bottom: 12,
    letterSpacing: 0.8,
  },
  markWrap: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
  },
  markWrapPortrait: {
    right: 24,
    bottom: 24,
  },
  markWrapLandscape: {
    right: 22,
    bottom: 46,
  },
  markLeft: {
    width: 20,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#F6FBFF',
  },
  markRight: {
    width: 20,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.surface,
    opacity: 0.72,
  },
  mastercardWrap: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  mastercardWrapPortrait: {
    right: 22,
    bottom: 22,
  },
  mastercardWrapLandscape: {
    right: 18,
    bottom: 10,
  },
  mastercardLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mastercardCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  mastercardCircleLeft: {
    backgroundColor: '#EB001B',
  },
  mastercardCircleRight: {
    backgroundColor: '#F79E1B',
    marginLeft: -7,
  },
  mastercardText: {
    color: '#F6FBFF',
    fontFamily: typography.bodyBold,
    letterSpacing: 0.2,
    marginTop: 2,
    textTransform: 'lowercase',
  },
  mastercardTextPortrait: {
    fontSize: 8,
  },
  mastercardTextLandscape: {
    fontSize: 9,
  },
});

