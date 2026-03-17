import { useState, useEffect, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/supabaseService';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const responseListener = useRef<Notifications.Subscription>(null!);
  const notificationListener = useRef<Notifications.Subscription>(null!);

  // Memoize isExpoGo and add safety checks
  const isExpoGo = useMemo(() => {
    try {
      return Constants?.executionEnvironment === (ExecutionEnvironment?.StoreClient ?? 'storeClient');
    } catch (e) {
      return false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const setupNotifications = async () => {
      // Skip setup entirely if in Expo Go to avoid SDK 53+ runtime error
      if (isExpoGo) {
        console.info('[PushNotifications] Skipping registration: Remote notifications are not supported in Expo Go.');
        return;
      }

      try {
        const token = await registerForPushNotificationsAsync(isExpoGo);
        if (token && user) {
          setExpoPushToken(token);
          profileService.updateProfile(user.id, { push_token: token });
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
          // Logic for foreground notification
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
          // Logic for tapped notification
        });
      } catch (error) {
        console.warn('[PushNotifications] Error during setup:', error);
      }
    };

    setupNotifications();

    return () => {
      try {
        if (notificationListener.current) notificationListener.current.remove();
        if (responseListener.current) responseListener.current.remove();
      } catch (e) {
        // Ignore removal errors
      }
    };
  }, [user, isExpoGo]);

  return { expoPushToken };
};

async function registerForPushNotificationsAsync(isExpoGo: boolean) {
  if (Platform.OS === 'web' || !Device.isDevice || isExpoGo) {
    return undefined;
  }

  try {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D81B60',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return undefined;
    
    // Safety check for getExpoPushTokenAsync as it can still throw in some edge cases
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) {
      console.warn('[PushNotifications] getExpoPushTokenAsync failed:', e);
      return undefined;
    }
    
    return token;
  } catch (error) {
    console.warn('[PushNotifications] Registration failed:', error);
    return undefined;
  }
}
