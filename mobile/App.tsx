import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableFreeze, enableScreens } from 'react-native-screens';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts as useDmSans,
} from '@expo-google-fonts/dm-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts as useSpaceGrotesk,
} from '@expo-google-fonts/space-grotesk';

import { RootNavigator } from './src/navigation/RootNavigator';
import { WalletProvider } from './src/context/WalletContext';

enableScreens(true);
enableFreeze(true);
void SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F4F5F7',
    card: '#FFFFFF',
    text: '#11141A',
    border: '#DFE4EB',
    primary: '#E13D58',
  },
};

export default function App() {
  const [dmFontsLoaded] = useDmSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [spaceFontsLoaded] = useSpaceGrotesk({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (dmFontsLoaded && spaceFontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [dmFontsLoaded, spaceFontsLoaded]);

  if (!dmFontsLoaded || !spaceFontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WalletProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="dark" translucent={false} />
            <RootNavigator />
          </NavigationContainer>
        </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
