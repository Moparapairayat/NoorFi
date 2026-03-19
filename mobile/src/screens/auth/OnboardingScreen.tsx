import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '../../components/AppButton';
import { CardPreview } from '../../components/CardPreview';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

type OnboardingSlide = {
  id: string;
  title: string;
  visual: 'card' | 'flow' | 'security';
  theme: 'islamic' | 'emerald' | 'midnight';
  chipStyle: 'gold' | 'platinum';
  showChip: boolean;
};

const slides: OnboardingSlide[] = [
  {
    id: 'faithful-finance',
    title: 'Shariah-first wallet and cards for daily life',
    visual: 'card',
    theme: 'islamic',
    chipStyle: 'gold',
    showChip: false,
  },
  {
    id: 'money-movement',
    title: 'Send, withdraw and exchange from one place',
    visual: 'flow',
    theme: 'emerald',
    chipStyle: 'platinum',
    showChip: false,
  },
  {
    id: 'safety-controls',
    title: 'Security controls with trusted verification',
    visual: 'security',
    theme: 'midnight',
    chipStyle: 'platinum',
    showChip: false,
  },
];
const AUTO_SLIDE_INTERVAL_MS = 3200;

export function OnboardingScreen() {
  const navigation = useNavigation<NavProp>();
  const isFocused = useIsFocused();
  const { height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const cardFlip = useRef(new Animated.Value(0)).current;
  const cardDrift = useRef(new Animated.Value(0)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const slideEnter = useRef(new Animated.Value(1)).current;
  const autoProgress = useRef(new Animated.Value(0)).current;
  const flowFloat = useRef(new Animated.Value(0)).current;
  const flowGlow = useRef(new Animated.Value(0)).current;
  const securityFloat = useRef(new Animated.Value(0)).current;
  const securityGlow = useRef(new Animated.Value(0)).current;
  const routingLockedRef = useRef(false);
  const slide = slides[activeIndex];
  const isLast = activeIndex === slides.length - 1;
  const isCompact = height <= 760;
  const isVeryCompact = height <= 700;
  const horizontalInset = isVeryCompact ? spacing.md : spacing.lg;
  const verticalInset = isVeryCompact ? spacing.md : isCompact ? spacing.lg : spacing.xxl;
  const cardWidth = isVeryCompact ? '64%' : isCompact ? '70%' : '76%';
  const cardMaxWidth = isVeryCompact ? 230 : isCompact ? 260 : 296;

  const goToIndex = (nextIndex: number) => {
    const total = slides.length;
    const normalized = ((nextIndex % total) + total) % total;

    if (normalized === activeIndex) {
      return;
    }

    const isForward =
      normalized > activeIndex || (activeIndex === total - 1 && normalized === 0);

    setSlideDirection(isForward ? 1 : -1);
    setActiveIndex(normalized);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isNavigatingAway &&
          Math.abs(gestureState.dx) > 14 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (isNavigatingAway) {
            return;
          }

          if (gestureState.dx <= -55 && activeIndex < slides.length - 1) {
            goToIndex(activeIndex + 1);
            return;
          }

          if (gestureState.dx >= 55 && activeIndex > 0) {
            goToIndex(activeIndex - 1);
          }
        },
      }),
    [activeIndex, isNavigatingAway]
  );

  const stopAllAnimations = () => {
    autoProgress.stopAnimation();
    slideEnter.stopAnimation();
    cardFlip.stopAnimation();
    cardDrift.stopAnimation();
    cardFloat.stopAnimation();
    flowFloat.stopAnimation();
    flowGlow.stopAnimation();
    securityFloat.stopAnimation();
    securityGlow.stopAnimation();
  };

  const goToAuth = (target: 'Login' | 'Register') => {
    if (routingLockedRef.current || isNavigatingAway) {
      return;
    }

    routingLockedRef.current = true;
    setIsNavigatingAway(true);
    stopAllAnimations();

    try {
      navigation.reset({
        index: 0,
        routes: [{ name: target }],
      });
    } catch {
      routingLockedRef.current = false;
      setIsNavigatingAway(false);
    }
  };

  const onNext = () => {
    goToAuth('Register');
  };

  const onLogin = () => {
    goToAuth('Login');
  };

  useEffect(() => {
    if (!isFocused || isNavigatingAway) {
      autoProgress.stopAnimation();
      return;
    }

    if (isLast) {
      autoProgress.stopAnimation();
      autoProgress.setValue(1);
      return;
    }

    autoProgress.stopAnimation();
    autoProgress.setValue(0);
    const progressAnim = Animated.timing(autoProgress, {
      toValue: 1,
      duration: AUTO_SLIDE_INTERVAL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnim.start();

    const autoTimer = setTimeout(() => {
      setSlideDirection(1);
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, AUTO_SLIDE_INTERVAL_MS);

    return () => {
      clearTimeout(autoTimer);
      progressAnim.stop();
    };
  }, [activeIndex, isLast, autoProgress, isFocused, isNavigatingAway]);

  useEffect(() => {
    if (!isFocused || isNavigatingAway) {
      return;
    }

    slideEnter.stopAnimation();
    slideEnter.setValue(0);
    const enterAnim = Animated.timing(slideEnter, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    enterAnim.start();

    return () => enterAnim.stop();
  }, [activeIndex, slideDirection, slideEnter, isFocused, isNavigatingAway]);

  useEffect(() => {
    if (!isFocused || isNavigatingAway || slide.visual !== 'card') {
      cardFlip.stopAnimation();
      cardDrift.stopAnimation();
      cardFloat.stopAnimation();
      cardFlip.setValue(0);
      cardDrift.setValue(0);
      cardFloat.setValue(0);
      return;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardDrift, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardDrift, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloat, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const flipLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1700),
        Animated.timing(cardFlip, {
          toValue: 1,
          duration: 980,
          easing: Easing.bezier(0.35, 0.05, 0.2, 0.95),
          useNativeDriver: true,
        }),
        Animated.delay(1700),
        Animated.timing(cardFlip, {
          toValue: 0,
          duration: 980,
          easing: Easing.bezier(0.35, 0.05, 0.2, 0.95),
          useNativeDriver: true,
        }),
      ])
    );

    driftLoop.start();
    floatLoop.start();
    flipLoop.start();

    return () => {
      driftLoop.stop();
      floatLoop.stop();
      flipLoop.stop();
    };
  }, [slide.visual, cardFlip, cardDrift, cardFloat, isFocused, isNavigatingAway]);

  useEffect(() => {
    if (!isFocused || isNavigatingAway || slide.visual !== 'flow') {
      flowFloat.stopAnimation();
      flowGlow.stopAnimation();
      flowFloat.setValue(0);
      flowGlow.setValue(0);
      return;
    }

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flowFloat, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flowFloat, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flowGlow, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flowGlow, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    glowLoop.start();

    return () => {
      floatLoop.stop();
      glowLoop.stop();
    };
  }, [slide.visual, flowFloat, flowGlow, isFocused, isNavigatingAway]);

  useEffect(() => {
    if (!isFocused || isNavigatingAway || slide.visual !== 'security') {
      securityFloat.stopAnimation();
      securityGlow.stopAnimation();
      securityFloat.setValue(0);
      securityGlow.setValue(0);
      return;
    }

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(securityFloat, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(securityFloat, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(securityGlow, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(securityGlow, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    glowLoop.start();

    return () => {
      floatLoop.stop();
      glowLoop.stop();
    };
  }, [slide.visual, securityFloat, securityGlow, isFocused, isNavigatingAway]);

  const flowImageTranslateY = flowFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const flowImageRotate = flowFloat.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-1deg'],
  });
  const flowGlowOpacity = flowGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.9],
  });
  const securityImageTranslateY = securityFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const securityImageRotate = securityFloat.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-1deg'],
  });
  const securityGlowOpacity = securityGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.9],
  });
  const cardTranslateX = cardDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });
  const cardRotateZ = cardDrift.interpolate({
    inputRange: [0, 1],
    outputRange: ['-1deg', '1deg'],
  });
  const cardTranslateY = cardFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -8],
  });
  const cardScale = cardFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0.996, 1.016],
  });
  const cardFrontRotateY = cardFlip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const cardBackRotateY = cardFlip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const cardFrontOpacity = cardFlip.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const cardBackOpacity = cardFlip.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });
  const slideOpacity = slideEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const slideTitleTranslateX = slideEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDirection === 1 ? 24 : -24, 0],
  });
  const slideVisualTranslateX = slideEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDirection === 1 ? 34 : -34, 0],
  });
  const slideVisualTranslateY = slideEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const autoProgressWidth = autoProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 118],
  });

  const renderVisual = () => {
    if (slide.visual === 'card') {
      return (
        <Animated.View
          style={[
            styles.cardMotionWrap,
            {
              transform: [
                { translateX: cardTranslateX },
                { translateY: cardTranslateY },
                { rotateZ: cardRotateZ },
                { scale: cardScale },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.card,
              styles.cardFlipStage,
              isCompact && styles.cardCompact,
              { maxWidth: cardMaxWidth, width: cardWidth },
            ]}
          >
            <Animated.View
              style={[
                styles.cardFaceLayer,
                {
                  opacity: cardFrontOpacity,
                  transform: [{ perspective: 1200 }, { rotateY: cardFrontRotateY }],
                },
              ]}
            >
              <CardPreview
                orientation="portrait"
                style={styles.cardFaceContent}
                theme={slide.theme}
                chipStyle={slide.chipStyle}
                showChip={slide.showChip}
                holderName="MOPARA PAIR AYAT"
                issuerLabel="NoorFi"
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.cardFaceLayer,
                {
                  opacity: cardBackOpacity,
                  transform: [{ perspective: 1200 }, { rotateY: cardBackRotateY }],
                },
              ]}
            >
              <LinearGradient
                colors={['#061E17', '#0C3A2C', '#175C45', '#D4B46A']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.cardBackSurface}
              >
                <View style={styles.cardBackStripe} />
                <View style={styles.cardBackAuthRow}>
                  <View style={styles.cardBackSignature}>
                    <Text numberOfLines={1} style={styles.cardBackSignatureText}>
                      MOPARA PAIR AYAT
                    </Text>
                  </View>
                  <View style={styles.cardBackCvvWrap}>
                    <Text style={styles.cardBackCvvLabel}>CVV</Text>
                    <View style={styles.cardBackCvvValueWrap}>
                      <Text style={styles.cardBackCvvValue}>***</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.cardBackHint}>NoorFi secure virtual card</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>
      );
    }

    if (slide.visual === 'flow') {
      return (
        <View style={[styles.photoVisualCard, isCompact && styles.photoVisualCardCompact]}>
          <LinearGradient
            colors={['#EEF7F1', '#DDEFE4', '#CEE4D6']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.photoVisualGradient}
          >
            <View style={styles.photoFrameEdge} />
            <Animated.View style={[styles.photoFrameAccent, { opacity: flowGlowOpacity }]} />
            <View style={styles.photoGlowOne} />
            <View style={styles.photoGlowTwo} />
            <View style={styles.photoGlowThree} />
          </LinearGradient>
          <Animated.View
            style={[
              styles.photoVisualImageFloating,
              isCompact && styles.photoVisualImageFloatingCompact,
              { transform: [{ translateY: flowImageTranslateY }, { rotate: flowImageRotate }] },
            ]}
          >
            <Image
              source={require('../../../assets/4i5wouU81730110950.png')}
              resizeMode="contain"
              style={styles.photoVisualImageAsset}
            />
          </Animated.View>
        </View>
      );
    }

    return (
      <View style={[styles.securityPhotoCard, isCompact && styles.securityPhotoCardCompact]}>
        <LinearGradient
          colors={['#ECF6F0', '#DDEFE4', '#CDE3D5']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.securityPhotoGradient}
        >
          <View style={styles.securityPhotoEdge} />
          <Animated.View style={[styles.securityPhotoAccent, { opacity: securityGlowOpacity }]} />
          <View style={styles.securityPhotoGlow} />
        </LinearGradient>
        <Animated.View
          style={[
            styles.securityPhotoImage,
            isCompact && styles.securityPhotoImageCompact,
            { transform: [{ translateY: securityImageTranslateY }, { rotate: securityImageRotate }] },
          ]}
        >
          <Image
            source={require('../../../assets/N611S45a1730095738.png')}
            resizeMode="contain"
            style={styles.securityPhotoImageAsset}
          />
        </Animated.View>
      </View>
    );
  };

  return (
    <Screen withPadding={false}>
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: horizontalInset,
            paddingTop: verticalInset,
            paddingBottom: isVeryCompact ? spacing.lg : spacing.xxl,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View>
          <Animated.View style={{ opacity: slideOpacity, transform: [{ translateX: slideTitleTranslateX }] }}>
            <Text style={styles.brand}>NOORFI</Text>
            <Text
              style={[styles.title, isCompact && styles.titleCompact, isVeryCompact && styles.titleVeryCompact]}
            >
              {slide.title}
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: slideOpacity,
            transform: [{ translateX: slideVisualTranslateX }, { translateY: slideVisualTranslateY }],
          }}
        >
          {renderVisual()}
        </Animated.View>

        <View style={[styles.dotRow, isCompact && styles.dotRowCompact]}>
          {slides.map((item, index) => (
            <View key={item.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.autoProgressTrack}>
          <Animated.View style={[styles.autoProgressFill, { width: autoProgressWidth }]} />
        </View>

        {isLast ? (
          <View style={[styles.buttonWrap, isCompact && styles.buttonWrapCompact]}>
            <AppButton disabled={isNavigatingAway} title="Create account" onPress={onNext} />
            <AppButton disabled={isNavigatingAway} title="Login" variant="ghost" onPress={onLogin} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.primary,
    fontFamily: typography.heading,
    fontSize: 14,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.display,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
    marginTop: spacing.md,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 32,
    marginTop: spacing.sm,
  },
  titleVeryCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  card: {
    alignSelf: 'center',
    maxWidth: 296,
    width: '76%',
  },
  cardCompact: {
    maxWidth: 260,
    width: '70%',
  },
  cardMotionWrap: {
    alignSelf: 'center',
  },
  cardFlipStage: {
    aspectRatio: 0.64,
    overflow: 'visible',
    position: 'relative',
  },
  cardFaceLayer: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  cardFaceContent: {
    height: '100%',
    width: '100%',
  },
  cardBackSurface: {
    borderColor: 'rgba(212, 180, 106, 0.38)',
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  cardBackStripe: {
    backgroundColor: 'rgba(3, 9, 7, 0.82)',
    height: '10%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: '11%',
  },
  cardBackAuthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    left: '7%',
    position: 'absolute',
    right: '7%',
    top: '28%',
  },
  cardBackSignature: {
    backgroundColor: 'rgba(245, 250, 255, 0.95)',
    borderRadius: 7,
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cardBackSignatureText: {
    color: '#48655B',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  cardBackCvvWrap: {
    marginLeft: 10,
  },
  cardBackCvvLabel: {
    color: 'rgba(244, 250, 255, 0.82)',
    fontFamily: typography.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  cardBackCvvValueWrap: {
    alignItems: 'center',
    backgroundColor: '#F7FBFF',
    borderColor: 'rgba(10, 35, 28, 0.2)',
    borderRadius: 7,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    minWidth: 58,
    paddingHorizontal: 8,
  },
  cardBackCvvValue: {
    color: '#163128',
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  cardBackHint: {
    bottom: '11%',
    color: 'rgba(230, 241, 236, 0.86)',
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    left: '7%',
    letterSpacing: 0.7,
    position: 'absolute',
  },
  visualCard: {
    alignSelf: 'center',
    backgroundColor: '#F6FAF7',
    borderColor: '#D4E2DA',
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: 296,
    minHeight: 268,
    padding: spacing.lg,
    width: '88%',
  },
  visualCardCompact: {
    minHeight: 232,
    padding: spacing.md,
  },
  photoVisualCard: {
    alignSelf: 'center',
    backgroundColor: '#E3EFE8',
    borderColor: '#9EBEAD',
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 6,
    marginHorizontal: spacing.xs,
    maxWidth: 344,
    shadowColor: '#154634',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    width: '94%',
    aspectRatio: 702 / 671,
    overflow: 'visible',
    position: 'relative',
  },
  photoVisualCardCompact: {
    maxWidth: 304,
  },
  photoVisualGradient: {
    borderRadius: radius.lg,
    flex: 1,
    overflow: 'hidden',
  },
  photoFrameEdge: {
    borderColor: 'rgba(20, 84, 61, 0.12)',
    borderRadius: radius.lg,
    borderWidth: 1,
    bottom: 8,
    left: 8,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  photoFrameAccent: {
    backgroundColor: 'rgba(196, 154, 74, 0.22)',
    borderRadius: radius.pill,
    height: 5,
    left: 18,
    position: 'absolute',
    top: 14,
    width: 84,
  },
  photoGlowOne: {
    backgroundColor: 'rgba(28, 138, 96, 0.2)',
    borderRadius: radius.pill,
    height: 180,
    position: 'absolute',
    right: -44,
    top: -56,
    width: 180,
  },
  photoGlowTwo: {
    backgroundColor: 'rgba(196, 154, 74, 0.17)',
    borderRadius: radius.pill,
    height: 140,
    left: -48,
    position: 'absolute',
    top: 118,
    width: 140,
  },
  photoGlowThree: {
    backgroundColor: 'rgba(20, 84, 61, 0.12)',
    borderRadius: radius.pill,
    bottom: -40,
    height: 120,
    position: 'absolute',
    right: 18,
    width: 120,
  },
  photoVisualImageFloating: {
    bottom: -22,
    height: undefined,
    left: -26,
    position: 'absolute',
    right: -30,
    shadowColor: '#0F2E22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    top: -44,
    width: undefined,
    zIndex: 4,
  },
  photoVisualImageAsset: {
    width: '100%',
    height: '100%',
  },
  photoVisualImageFloatingCompact: {
    bottom: -18,
    left: -20,
    right: -24,
    top: -36,
  },
  securityPhotoCard: {
    alignSelf: 'center',
    backgroundColor: '#E2EEE7',
    borderColor: '#9DBCAA',
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 6,
    marginHorizontal: spacing.xs,
    maxWidth: 332,
    overflow: 'visible',
    position: 'relative',
    shadowColor: '#154634',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    width: '92%',
    aspectRatio: 592 / 620,
  },
  securityPhotoCardCompact: {
    maxWidth: 294,
  },
  securityPhotoGradient: {
    borderRadius: radius.lg,
    flex: 1,
    overflow: 'hidden',
  },
  securityPhotoEdge: {
    borderColor: 'rgba(20, 84, 61, 0.14)',
    borderRadius: radius.lg,
    borderWidth: 1,
    bottom: 8,
    left: 8,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  securityPhotoAccent: {
    backgroundColor: 'rgba(196, 154, 74, 0.24)',
    borderRadius: radius.pill,
    height: 5,
    left: 18,
    position: 'absolute',
    top: 14,
    width: 84,
  },
  securityPhotoGlow: {
    backgroundColor: 'rgba(28, 138, 96, 0.16)',
    borderRadius: radius.pill,
    height: 150,
    position: 'absolute',
    right: -42,
    top: -32,
    width: 150,
  },
  securityPhotoImage: {
    bottom: -14,
    height: undefined,
    left: -10,
    position: 'absolute',
    right: -12,
    shadowColor: '#0F2E22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    top: -30,
    width: undefined,
    zIndex: 4,
  },
  securityPhotoImageAsset: {
    width: '100%',
    height: '100%',
  },
  securityPhotoImageCompact: {
    bottom: -10,
    left: -8,
    right: -10,
    top: -24,
  },
  visualOverline: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  walletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  walletChip: {
    alignItems: 'center',
    backgroundColor: '#E6F0E9',
    borderColor: '#C9DACF',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  walletChipText: {
    color: colors.primaryDark,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  flowHub: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D3E1D9',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  flowHubText: {
    color: colors.textPrimary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionPill: {
    alignItems: 'center',
    backgroundColor: '#EDF4EF',
    borderRadius: radius.md,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  actionPillText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
  },
  securityVisual: {
    backgroundColor: '#0F2F24',
    borderColor: '#2E6E56',
  },
  securityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  shieldBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(243, 227, 192, 0.16)',
    borderColor: 'rgba(243, 227, 192, 0.4)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  securityHeaderTextWrap: {
    flex: 1,
  },
  securityTitle: {
    color: '#F3FAF6',
    fontFamily: typography.heading,
    fontSize: 17,
  },
  securitySubtitle: {
    color: 'rgba(232, 241, 236, 0.82)',
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2,
  },
  securityRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(202, 224, 212, 0.18)',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  securityRowText: {
    color: '#E4F0EA',
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  dotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  dotRowCompact: {
    marginTop: spacing.xs,
  },
  autoProgressTrack: {
    alignSelf: 'center',
    backgroundColor: 'rgba(21, 90, 65, 0.16)',
    borderRadius: radius.pill,
    height: 6,
    marginTop: spacing.xs,
    overflow: 'hidden',
    width: 118,
  },
  autoProgressFill: {
    backgroundColor: '#1E8760',
    borderRadius: radius.pill,
    height: '100%',
  },
  dot: {
    backgroundColor: '#D1DED5',
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  buttonWrap: {
    gap: spacing.sm,
  },
  buttonWrapCompact: {
    marginTop: spacing.sm,
  },
});

