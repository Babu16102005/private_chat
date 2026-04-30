import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { CallProvider } from './src/context/CallContext';
import { CallScreen } from './src/screens/CallScreen';
import { LockProvider } from './src/context/LockContext';
import { PinLockOverlay } from './src/components/PinLockOverlay';
import { navigationRef } from './src/navigation/navigationRef';
import { usePushNotifications } from './src/hooks/usePushNotifications';

const prefix = Linking.createURL('/');

const AppContent = () => {
  usePushNotifications();

  return (
    <>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <AppNavigator />
      </NavigationContainer>
      <CallScreen />
      <PinLockOverlay />
    </>
  );
};

const linking = {
  prefixes: [prefix, 'chatapp://'],
  config: {
    screens: {
      Invite: {
        path: 'accept',
        parse: {
          token: (token: string) => ({ token }),
        },
      },
    },
  },
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
          <LockProvider>
            <AppContent />
          </LockProvider>
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
