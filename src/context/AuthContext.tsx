import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, AuthContextType } from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
        }

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
            full_name: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          });
        } else {
          setUser(null);
        }
        
        setIsInitialized(true);
        setIsLoading(false);
        
      } catch (err) {
        console.error('Auth initialization error:', err);
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
            full_name: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          });
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      // Валидация пароля
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      if (!username.trim()) {
        throw new Error('Username is required.');
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        // Детальная обработка ошибок существующего пользователя
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('already registered') || 
            errorMsg.includes('user exists') ||
            errorMsg.includes('email already') ||
            errorMsg.includes('already in use') ||
            errorMsg.includes('user already exists') ||
            errorMsg.includes('duplicate key') ||
            error.code === 'user_already_exists' ||
            errorMsg.includes('already been registered')) {
          throw new Error('This email address is already registered. Please sign in or use a different email.');
        } else {
          throw new Error(`Registration failed: ${error.message}`);
        }
      }

      // Проверяем, был ли пользователь создан
      if (!data.user) {
        throw new Error('Registration failed: No user data received');
      }

      // Проверяем "тихое" создание пользователя (когда email уже существует)
      if (data.user && !data.session && data.user.identities && data.user.identities.length === 0) {
        throw new Error('This email address is already registered. Please sign in or use a different email.');
      }

      const needsEmailConfirmation = !data.session;

      return {
        user: data.user,
        session: data.session,
        needsEmailConfirmation: needsEmailConfirmation
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Signin error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      console.error('Signout error:', error);
      throw error;
    }
  };

  const value = {
    user,
    isLoading,
    isInitialized,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};