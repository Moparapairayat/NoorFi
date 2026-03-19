import { useEffect, useRef } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';

export function useAuthLayout() {
  const { height } = useWindowDimensions();

  return {
    isCompact: height < 780,
    isVeryCompact: height < 700,
  };
}

export function useAuthEntrance(baseDelay = 0) {
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(18)).current;

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(14)).current;

  const footerOpacity = useRef(new Animated.Value(0)).current;
  const footerTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    heroOpacity.setValue(0);
    heroTranslateY.setValue(18);
    contentOpacity.setValue(0);
    contentTranslateY.setValue(14);
    footerOpacity.setValue(0);
    footerTranslateY.setValue(10);

    const animation = Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 220,
        delay: baseDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroTranslateY, {
        toValue: 0,
        duration: 260,
        delay: baseDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 220,
        delay: baseDelay + 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 260,
        delay: baseDelay + 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 200,
        delay: baseDelay + 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerTranslateY, {
        toValue: 0,
        duration: 240,
        delay: baseDelay + 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    baseDelay,
    contentOpacity,
    contentTranslateY,
    footerOpacity,
    footerTranslateY,
    heroOpacity,
    heroTranslateY,
  ]);

  return {
    heroStyle: {
      opacity: heroOpacity,
      transform: [{ translateY: heroTranslateY }],
    },
    contentStyle: {
      opacity: contentOpacity,
      transform: [{ translateY: contentTranslateY }],
    },
    footerStyle: {
      opacity: footerOpacity,
      transform: [{ translateY: footerTranslateY }],
    },
  };
}
