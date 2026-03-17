import React from 'react';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) return null;

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
