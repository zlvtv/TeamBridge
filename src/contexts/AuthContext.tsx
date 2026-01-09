import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, AuthContextType } from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const cacheKey = `profile_${userId}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    } catch {}
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;

  localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  return data as UserProfile;
}

const translateAuthError = (message: string): string => {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Неверный email или пароль',
    'Email not confirmed': 'Email не подтверждён. Проверьте почту',
    'Email rate limit exceeded': 'Слишком много попыток. Попробуйте позже',
    'User already registered': 'Пользователь с таким email уже существует',
    'Password should be at least 6 characters': 'Пароль должен быть не менее 6 символов',
    'The email address is invalid': 'Неверный формат email',
    'User not found': 'Пользователь с таким email не найден',
    'Invalid confirmation token': 'Неверная или устаревшая ссылка',
    'Token has expired': 'Ссылка устарела',
  };

  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }

  return 'Произошла ошибка. Попробуйте снова';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    user: UserProfile | null;
    isLoading: boolean;
    isInitialized: boolean;
  }>({
    user: null,
    isLoading: true,
    isInitialized: false,
  });

  const initializedRef = useRef(false);
  const isSettingStateRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    const updateAuthState = (user: UserProfile | null) => {
      if (!isMounted || isSettingStateRef.current) return;
      isSettingStateRef.current = true;
      setState({ user, isLoading: false, isInitialized: true });
      isSettingStateRef.current = false;

      if (user) {
        const savedToken = localStorage.getItem('invite_token');
        if (savedToken) {
          localStorage.removeItem('invite_token');
          window.dispatchEvent(new CustomEvent('invite_after_login', { detail: savedToken }));
        }
      }
    };

    const processSession = async (session: any, source: string) => {
      if (!isMounted) return;

      if (session?.user) {
        let profile = null;
        try {
          const profilePromise = getUserProfile(session.user.id);
          const timeout = new Promise<null>((resolve) => setTimeout(resolve, 1000));
          profile = await Promise.race([profilePromise, timeout]);
        } catch {}

        const { user: sessionUser } = session;
        const userProfile: UserProfile = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          username: profile?.username || sessionUser.user_metadata?.username || sessionUser.email?.split('@')[0] || 'user',
          full_name: profile?.full_name || sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.username || sessionUser.email?.split('@')[0] || 'User',
          avatar_url: profile?.avatar_url || sessionUser.user_metadata?.avatar_url || null,
        };

        updateAuthState(userProfile);
      } else {
        updateAuthState(null);
      }
    };

    const initialize = async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          processSession(session, `event-${event}`);
        } else if (event === 'TOKEN_REFRESHED') {
          setState((prev) => ({ ...prev, isLoading: false, isInitialized: true }));
        }
      });

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        updateAuthState(null);
        return subscription;
      }

      if (session) {
        try {
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            await supabase.auth.signOut();
            updateAuthState(null);
            window.location.href = '/login';
            return subscription;
          }
          await processSession(session, 'initial');
        } catch (err: any) {
          if (err.message.includes('User from sub claim') || err.status === 403) {
            await supabase.auth.signOut();
            updateAuthState(null);
            window.location.href = '/login';
            return subscription;
          }
          updateAuthState(null);
        }
      } else {
        updateAuthState(null);
      }

      return subscription;
    };

    const subscriptionPromise = initialize();

    return () => {
      isMounted = false;
      subscriptionPromise.then((sub) => sub?.unsubscribe());
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name: username },
      },
    });

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = {
    user: state.user,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
