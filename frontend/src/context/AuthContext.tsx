import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabase';
import { authService, profileService } from '../services/supabaseService';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  user: null, 
  loading: true,
  signUp: authService.signUp,
  signIn: authService.signIn,
  signOut: authService.signOut,
  resetPassword: authService.resetPassword
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        // Create user profile if it doesn't exist
        if (session?.user) {
          const profile = await profileService.getProfile(session.user.id);
          if (!profile) {
            await profileService.createUserProfile(session.user.id, session.user.email!);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      // Create profile on sign up
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await profileService.getProfile(session.user.id);
        if (!profile) {
          await profileService.createUserProfile(session.user.id, session.user.email!);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    return await authService.signUp(email, password);
  };

  const signIn = async (email: string, password: string) => {
    return await authService.signIn(email, password);
  };

  const signOut = async () => {
    await authService.signOut();
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user: session?.user ?? null, 
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
