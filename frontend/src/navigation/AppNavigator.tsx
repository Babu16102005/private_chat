import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { InviteScreen } from '../screens/InviteScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChatSettingsScreen } from '../screens/ChatSettingsScreen';
import { RootStackParamList } from './types';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const logoSource = require('../../assets/kiba-entry.png');

const LoadingScreen = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}> 
      <LinearGradient colors={colors.gradientPrimary as [string, string, ...string[]]} start={{ x: 0.08, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(100,243,255,0.12)', 'rgba(233,199,255,0.07)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0.16, y: 0.76 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', 'rgba(141,255,213,0.08)', 'rgba(5,7,18,0.22)']} start={{ x: 0, y: 0.24 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Image source={logoSource} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator size="large" color={colors.primary} style={styles.indicator} />
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
  logo: {
    width: 180,
    height: 180,
  },
  indicator: {
    marginTop: 28,
  },
  loadingText: {
    marginTop: 18,
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
          <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
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
