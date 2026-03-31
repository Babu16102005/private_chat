import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';

const prefix = Linking.createURL('/');

export default function App() {
  const linking = {
    prefixes: [prefix, 'couplechat://'],
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

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
