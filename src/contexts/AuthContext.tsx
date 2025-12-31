// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, AuthContextType } from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const cacheKey = `profile_${userId}`;
  
  // Попробуем кэш
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      // Кэш на 5 минут
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        console.log('🟡 [Auth] Используем кэш профиля');
        return data;
      }
    } catch (e) {
      // Ошибка парсинга — игнорируем
    }
  }

  console.log('📥 [Auth] Загружаем профиль из Supabase:', userId);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('⚠️ [Auth] Профиль не найден:', error.message);
      return null;
    }

    // Сохраняем в кэш
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));

    console.log('✅ [Auth] Профиль загружен и закэширован:', data.username);
    return data as UserProfile;
  } catch (error) {
    console.error('❌ [Auth] Ошибка получения профиля:', error);
    return null;
  }
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

  // Используем ref для защиты от повторной инициализации
  const initializedRef = useRef(false);
  const isSettingStateRef = useRef(false);

  useEffect(() => {
    // Защита от двойного вызова в StrictMode
    if (initializedRef.current) {
      console.log('ℹ️ [Auth] Уже инициализирован, пропускаем');
      return;
    }
    
    initializedRef.current = true;
    console.log('🔐 [Auth] Начало инициализации');

    let isMounted = true;

    // Функция для установки состояния
    const updateAuthState = (user: UserProfile | null) => {
      if (!isMounted || isSettingStateRef.current) {
        console.log('⏭️ [Auth] Пропускаем установку состояния (уже в процессе)');
        return;
      }
      
      isSettingStateRef.current = true;
      console.log('🔄 [Auth] Устанавливаем состояние:', user ? user.email : 'null');
      
      setState({
        user,
        isLoading: false,
        isInitialized: true,
      });
      
      console.log('✅ [Auth] Состояние установлено!');
      isSettingStateRef.current = false;
    };

    // Функция для обработки сессии
    const processSession = async (session: any, source: string) => {
      console.log(`👤 [Auth] Обработка сессии (${source}):`, session ? 'есть' : 'нет');
      
      if (!isMounted) {
        console.log('🚫 [Auth] Компонент размонтирован, пропускаем');
        return;
      }
      
      if (session?.user) {
        console.log(`✅ [Auth] ${source}: Найден пользователь:`, session.user.email);
        
        let profile = null;
        
        try {
          const profilePromise = getUserProfile(session.user.id);
          const timeout = new Promise<null>((resolve) => 
            setTimeout(() => resolve(null), 1000)
          );
          
          profile = await Promise.race([profilePromise, timeout]);
        } catch (error) {
          console.warn(`⚠️ [Auth] Ошибка при загрузке профиля:`, error);
        }
        
        const userProfile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          username: profile?.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
          full_name: profile?.full_name || 
                    session.user.user_metadata?.full_name || 
                    session.user.user_metadata?.username || 
                    session.user.email?.split('@')[0] || 
                    'User', // ✅ Резервный цепочкой
          avatar_url: profile?.avatar_url || session.user.user_metadata?.avatar_url || null,
        };

        console.log(`🎉 [Auth] ${source}: Пользователь готов:`, userProfile.email);
        updateAuthState(userProfile);
      } else {
        console.log(`👤 [Auth] ${source}: Нет сессии`);
        updateAuthState(null);
      }
    };

    // Основная функция инициализации
    const initialize = async () => {
      try {
        // Подписываемся на изменения
        console.log('🔔 [Auth] Настраиваем слушатель auth state change');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log(`🔔 [Auth] Событие: ${event}`);
            
            // ⚠️ Закрытие модалок — уже не здесь!
            // → Перенесено в ProfileButton

            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
              await processSession(session, `event-${event}`);
            } else if (event === 'TOKEN_REFRESHED') {
              setState(prev => ({
                ...prev,
                isLoading: false,
                isInitialized: true,
              }));
            }
          }
        );

        // Получаем начальную сессию
        console.log('🔄 [Auth] Получаем начальную сессию...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [Auth] Ошибка получения сессии:', error);
          updateAuthState(null);
          return subscription;
        }

        console.log('🔄 [Auth] Начальная сессия получена:', session ? 'есть' : 'нет');

        // 🔥 ПРОВЕРКА: существует ли пользователь?
        if (session) {
          try {
            // Это вызывает /auth/v1/user → может вернуть 403
            const { data: userData, error: userError } = await supabase.auth.getUser();

            if (userError) {
              console.warn('⚠️ [Auth] Пользователь не существует:', userError.message);
              await supabase.auth.signOut();
              updateAuthState(null);
              window.location.href = '/login'; // ✅ Безопасный редирект
              return subscription;
            }

            await processSession(session, 'initial');
          } catch (err: any) {
            console.error('❌ [Auth] Ошибка при проверке пользователя:', err);
            
            if (err.message.includes('User from sub claim') || err.status === 403) {
              await supabase.auth.signOut();
              updateAuthState(null);
              window.location.href = '/login'; // ✅
              return subscription;
            }

            updateAuthState(null);
          }
        } else {
          updateAuthState(null);
        }

        return subscription;
      } catch (error) {
        console.error('❌ [Auth] Критическая ошибка инициализации:', error);
        updateAuthState(null);
        return null;
      }
    };

    const subscriptionPromise = initialize();

    return () => {
      console.log('🧹 [Auth] Очистка');
      isMounted = false;
      
      subscriptionPromise.then(subscription => {
        if (subscription) {
          subscription.unsubscribe();
          console.log('🔕 [Auth] Отписались от изменений');
        }
      });
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name: username, // ✅ Добавляем full_name = username
      },
    },
  });

  return { data, error };
};

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error('Ошибка входа:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Ошибка выхода:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user: state.user,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    signUp,
    signIn,
    signOut,
  };

  console.log('🎨 [AuthProvider] Ререндер:', { 
    user: state.user ? state.user.email : 'нет', 
    isLoading: state.isLoading,
    isInitialized: state.isInitialized 
  });

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
