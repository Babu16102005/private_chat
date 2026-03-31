import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { InviteScreen } from '../screens/InviteScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RootStackParamList } from './types';

import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const Stack = createNativeStackNavigator<RootStackParamList>();

const LoadingScreen = () => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['rgba(210, 118, 25, 0.2)', 'transparent'] as any} style={{ position: 'absolute', top: -100, right: -50, width: 350, height: 350, borderRadius: 175 }} />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.text }]}>Preparing your space...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  }
});

export const AppNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Invite" component={InviteScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
