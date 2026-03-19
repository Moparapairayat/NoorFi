import React from 'react';
import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityScreen } from '../screens/activity/ActivityScreen';
import { CardsScreen } from '../screens/cards/CardsScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors, radius, typography } from '../theme';
import { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const iconMap: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home-outline', 'home'],
  Cards: ['card-outline', 'card'],
  Activity: ['time-outline', 'time'],
  Profile: ['person-circle-outline', 'person-circle'],
};

const labelMap: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Cards: 'Card',
  Activity: 'Activity',
  Profile: 'Profile',
};

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(12, insets.bottom + 6);
  const tabBarHeight = 58 + insets.bottom;
  const tabBarPaddingBottom = Math.max(4, insets.bottom);

  const renderTabButton = (props: BottomTabBarButtonProps) => {
    const focused = Boolean(props.accessibilityState?.selected);
    const delayLongPress = typeof props.delayLongPress === 'number' ? props.delayLongPress : undefined;
    const disabled = typeof props.disabled === 'boolean' ? props.disabled : undefined;
    const onLongPress = typeof props.onLongPress === 'function' ? props.onLongPress : undefined;
    const onPressIn = typeof props.onPressIn === 'function' ? props.onPressIn : undefined;
    const onPressOut = typeof props.onPressOut === 'function' ? props.onPressOut : undefined;

    return (
      <TouchableOpacity
        accessibilityHint={props.accessibilityHint}
        accessibilityLabel={props.accessibilityLabel}
        accessibilityLanguage={props.accessibilityLanguage}
        accessibilityRole={props.accessibilityRole}
        accessibilityState={props.accessibilityState}
        accessibilityValue={props.accessibilityValue}
        delayLongPress={delayLongPress}
        disabled={disabled}
        hitSlop={props.hitSlop}
        onLongPress={onLongPress}
        onPress={props.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID={props.testID}
        activeOpacity={0.88}
        style={[props.style, styles.tabButton, focused && styles.tabButtonFocused]}
      >
        {props.children}
      </TouchableOpacity>
    );
  };

  return (
    <Tab.Navigator
      detachInactiveScreens
      screenOptions={({ route }) => ({
        freezeOnBlur: true,
        headerShown: false,
        lazy: true,
        sceneStyle: styles.scene,
        tabBarHideOnKeyboard: true,
        tabBarLabel: labelMap[route.name],
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: '#60746A',
        tabBarLabelStyle: {
          fontFamily: typography.bodyBold,
          fontSize: 10,
          marginTop: 1,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderRadius: 24,
          borderTopWidth: 0,
          bottom: tabBarBottom,
          height: tabBarHeight,
          left: 16,
          overflow: 'hidden',
          paddingBottom: tabBarPaddingBottom + 1,
          paddingTop: 4,
          position: 'absolute',
          right: 16,
          shadowColor: '#0B2B20',
          shadowOpacity: 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['#EEF6F0', '#E0ECE4', '#D3E3D8']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.tabSurfaceGlow} />
            <View style={styles.tabSurfaceTopLine} />
          </View>
        ),
        tabBarButton: renderTabButton,
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 3,
          marginVertical: 2,
          overflow: 'hidden',
          paddingVertical: 2,
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarIcon: ({ color, size, focused }) => (
          <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
            {focused ? (
              <LinearGradient
                colors={['#2A7F5E', '#14543D']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.iconFocusGradient}
              />
            ) : null}
            <Ionicons
              color={focused ? '#F4E7C7' : color}
              name={focused ? iconMap[route.name][1] : iconMap[route.name][0]}
              style={styles.iconGlyph}
              size={focused ? size : size - 1}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cards" component={CardsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: '#F4F5F7',
  },
  tabButton: {
    borderRadius: 18,
  },
  tabButtonFocused: {
    backgroundColor: 'rgba(20, 84, 61, 0.08)',
  },
  tabSurfaceGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    borderRadius: radius.pill,
    height: 18,
    left: 10,
    position: 'absolute',
    right: 10,
    top: 4,
  },
  tabSurfaceTopLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    height: 1,
    left: 24,
    position: 'absolute',
    right: 24,
    top: 0,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 24,
  },
  iconFocusGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  iconGlyph: {
    zIndex: 1,
  },
  iconWrapFocused: {
    borderColor: 'rgba(216, 189, 132, 0.55)',
    borderWidth: 1,
    height: 28,
    shadowColor: '#14543D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 4,
    width: 28,
  },
});
