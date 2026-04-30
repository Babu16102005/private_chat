import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { authService, profileService } from '../services/supabaseService';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  user: null, 
  loading: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updateProfileName: async () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const clearStoredAuth = async () => {
    try {
      // Remove all supabase auth keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(k => k.includes('supabase') || k.includes('sb-'));
      if (supabaseKeys.length > 0) await AsyncStorage.multiRemove(supabaseKeys);
    } catch (e) {
      // Ignore errors during cleanup
    }
  };

  const clearStaleSession = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore sign-out errors for invalid/expired sessions.
    } finally {
      await clearStoredAuth();
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          const msg = error.message?.toLowerCase() || '';
          if (msg.includes('refresh token') || msg.includes('invalid') || msg.includes('expired')) {
            console.warn('Stale session detected, clearing...', error.message);
            await clearStaleSession();
            if (isMounted) setSession(null);
            return;
          }
        }

        if (!isMounted) return;
        setSession(session);

        if (session?.user) {
          try {
            const profile = await profileService.getProfile(session.user.id);
            if (!profile) {
              await profileService.createUserProfile(session.user.id, session.user.email!);
            }
          } catch (e) {
            console.error('Profile error:', e);
          }
        }
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        // If it looks like a bad token, clear it so the user sees the login screen
        const msg = error?.message?.toLowerCase() || '';
        if (msg.includes('refresh token') || msg.includes('invalid') || msg.includes('not found')) {
          await clearStaleSession();
          if (isMounted) setSession(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // TOKEN_REFRESH_FAILED means the stored refresh token is invalid — force sign out
      if ((event as string) === 'TOKEN_REFRESH_FAILED' || event === 'SIGNED_OUT') {
        await clearStoredAuth();
        if (isMounted) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const profile = await profileService.getProfile(session.user.id);
          if (!profile) {
            await profileService.createUserProfile(session.user.id, session.user.email!);
          }
        } catch (e) {}
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const result = await authService.signUp(email, password);
    if (name && result?.user) {
      await profileService.updateProfile(result.user.id, { name });
    }
    return result;
  };

  const signIn = async (email: string, password: string) => {
    return await authService.signIn(email, password);
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
    } catch (error) {
      console.warn('Sign out request failed; clearing local session anyway:', error);
    } finally {
      await clearStoredAuth();
      setSession(null);
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  const updateProfileName = async (name: string) => {
    if (session?.user) {
      await profileService.updateProfile(session.user.id, { name });
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user: session?.user ?? null, 
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfileName
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
