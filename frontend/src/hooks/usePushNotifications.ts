import { useState, useEffect, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { inviteService, profileService } from '../services/supabaseService';
import { navigate } from '../navigation/navigationRef';

type NotificationData = {
  type?: string;
  pairId?: string;
  senderId?: string;
  callerId?: string;
  callerName?: string;
  isVideo?: boolean;
};

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
  const handledNotificationIdRef = useRef<string | null>(null);

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

        notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
          handleNotificationResponse(response, handledNotificationIdRef);
        });

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          handleNotificationResponse(lastResponse, handledNotificationIdRef);
        }
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

const handleNotificationResponse = async (
  response: Notifications.NotificationResponse,
  handledNotificationIdRef: { current: string | null }
) => {
  const notificationId = response.notification.request.identifier;
  if (handledNotificationIdRef.current === notificationId) return;
  handledNotificationIdRef.current = notificationId;

  const data = response.notification.request.content.data as NotificationData;
  const pairId = data?.pairId;

  if (!pairId) return;

  try {
    const pair = await inviteService.getPairById(pairId);
    if (!pair) {
      navigate('Home', undefined);
      return;
    }

    const senderId = data.senderId || data.callerId;
    const partner = senderId
      ? senderId === pair.user_a_id ? pair.user_a : pair.user_b
      : pair.user_a || pair.user_b;

    navigate('Chat', { pairId, partner });
  } catch (error) {
    console.warn('[PushNotifications] Failed to open notification target:', error);
    navigate('Home', undefined);
  }
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
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
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
