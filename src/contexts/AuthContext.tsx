import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  signInAnonymously as firebaseSignInAnonymously,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, AuthContextType } from '../types/auth.types';
import {
  validateUsername,
  validateFullName,
  validateProfileDescription,
} from '../utils/profileValidation';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  isEmailVerified: boolean;
}

const translateAuthError = (message: string): string => {
  const map: Record<string, string> = {
    'auth/user-not-found': 'Пользователь с таким email не найден',
    'auth/wrong-password': 'Неверный email или пароль',
    'auth/invalid-email': 'Неверный формат email',
    'auth/email-already-in-use': 'Пользователь с таким email уже существует',
    'auth/weak-password': 'Пароль должен быть не менее 6 символов',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
    'auth/email-not-verified': 'Требуется подтверждение email',
  };

  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }

  return 'Произошла ошибка. Попробуйте снова';
};

const profileFromUser = (user: FirebaseUser, username: string): UserProfile => ({
  id: user.uid,
  email: user.email || '',
  username,
  full_name: username,
  avatar_url: null,
  description: null,
});

const normalizeUsername = (username: string) => username.trim().toLowerCase();
const AVATAR_MAX_SIDE = 192;
const AVATAR_JPEG_QUALITY = 0.68;

const normalizeDateValue = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return null;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось загрузить изображение'));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Не удалось подготовить аватар'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать аватар'));
    reader.readAsDataURL(blob);
  });

const prepareAvatarDataUrl = async (file: File): Promise<string> => {
  const image = await loadImageFromFile(file);
  const side = Math.min(image.width, image.height);
  const cropX = Math.max(0, Math.round((image.width - side) / 2));
  const cropY = Math.max(0, Math.round((image.height - side) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_MAX_SIDE;
  canvas.height = AVATAR_MAX_SIDE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Не удалось обработать аватар');
  }

  context.drawImage(
    image,
    cropX,
    cropY,
    side,
    side,
    0,
    0,
    AVATAR_MAX_SIDE,
    AVATAR_MAX_SIDE
  );

  const blob = await canvasToBlob(canvas, 'image/jpeg', AVATAR_JPEG_QUALITY);
  return await blobToDataUrl(blob);
};

const USERNAME_RESERVATIONS_COLLECTION = 'usernames';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isInitialized: false,
    isEmailVerified: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user) {
        await user.reload();
        const isVerified = user.emailVerified;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        const profile: UserProfile = {
          id: user.uid,
          email: user.email || '',
          username: userData?.username || user.email?.split('@')[0] || 'user',
          full_name: userData?.full_name || user.displayName || userData?.username || 'User',
          avatar_url: userData?.avatar_url || user.photoURL || null,
          description: userData?.description || null,
          last_seen_at: normalizeDateValue(userData?.last_seen_at),
        };

        setState({
          user: profile,
          isLoading: false,
          isInitialized: true,
          isEmailVerified: isVerified,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isInitialized: true,
          isEmailVerified: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!state.user?.id) return;

    const userRef = doc(db, 'users', state.user.id);
    let lastPersistedAt = 0;

    const persistPresence = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastPersistedAt < 45_000) {
        return;
      }

      lastPersistedAt = now;

      try {
        await updateDoc(userRef, {
          last_seen_at: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error('Не удалось обновить last_seen_at:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void persistPresence(true);
      }
    };

    const handleFocus = () => {
      void persistPresence(true);
    };

    const handleActivity = () => {
      if (document.visibilityState === 'visible') {
        void persistPresence();
      }
    };

    void persistPresence(true);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void persistPresence();
      }
    }, 60_000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.clearInterval(intervalId);
    };
  }, [state.user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(translateAuthError(error.message));
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    const trimmed = username.trim();
    const validationError = validateUsername(trimmed);
    const normalized = normalizeUsername(trimmed);

    if (validationError) {
      return {
        available: false,
        message: validationError,
      };
    }

    const usernameRef = doc(db, USERNAME_RESERVATIONS_COLLECTION, normalized);
    const usersRef = collection(db, 'users');
    const [usernameReservationSnapshot, normalizedSnapshot, exactSnapshot] = await Promise.all([
      getDoc(usernameRef),
      getDocs(query(usersRef, where('username_lowercase', '==', normalized))),
      getDocs(query(usersRef, where('username', '==', trimmed))),
    ]);

    if (usernameReservationSnapshot.exists() || !normalizedSnapshot.empty || !exactSnapshot.empty) {
      return { available: false, message: 'Имя пользователя уже занято' };
    }

    return { available: true };
  };

  const updateCurrentUserProfile = async (payload: {
    username: string;
    fullName: string;
    description?: string;
    avatarFile?: File | null;
    removeAvatar?: boolean;
  }) => {
    try {
      const currentAuthUser = auth.currentUser;
      const currentUser = state.user;

      if (!currentAuthUser || !currentUser) {
        return { success: false, message: 'Пользователь не найден' };
      }

      const trimmedUsername = payload.username.trim();
      const trimmedFullName = payload.fullName.trim();
      const trimmedDescription = (payload.description || '').trim();

      const usernameError = validateUsername(trimmedUsername);
      if (usernameError) {
        return { success: false, message: usernameError };
      }

      const fullNameError = validateFullName(trimmedFullName);
      if (fullNameError) {
        return { success: false, message: fullNameError };
      }

      const descriptionError = validateProfileDescription(trimmedDescription);
      if (descriptionError) {
        return { success: false, message: descriptionError };
      }

      const normalizedUsername = normalizeUsername(trimmedUsername);
      const currentNormalizedUsername = normalizeUsername(currentUser.username || '');

      if (normalizedUsername !== currentNormalizedUsername) {
        const availability = await checkUsernameAvailability(trimmedUsername);
        if (!availability.available) {
          return {
            success: false,
            message: availability.message || 'Имя пользователя уже занято',
          };
        }
      }

      let avatarUrl = currentUser.avatar_url || null;

      if (payload.removeAvatar) {
        avatarUrl = null;
      }

      if (payload.avatarFile) {
        avatarUrl = await withTimeout(
          prepareAvatarDataUrl(payload.avatarFile),
          5000,
          'Слишком долго обрабатывается аватар'
        );
      }

      const nextFullName = trimmedFullName || trimmedUsername;
      const currentUsernameReservationRef = doc(db, USERNAME_RESERVATIONS_COLLECTION, currentNormalizedUsername);
      const nextUsernameReservationRef = doc(db, USERNAME_RESERVATIONS_COLLECTION, normalizedUsername);
      const userRef = doc(db, 'users', currentUser.id);

      await withTimeout(
        runTransaction(db, async (transaction) => {
          if (normalizedUsername !== currentNormalizedUsername) {
            const nextUsernameReservationSnapshot = await transaction.get(nextUsernameReservationRef);
            const reservedFor = nextUsernameReservationSnapshot.data()?.user_id;

            if (nextUsernameReservationSnapshot.exists() && reservedFor !== currentUser.id) {
              throw new Error('Имя пользователя уже занято');
            }
          }

          transaction.update(userRef, {
            username: trimmedUsername,
            username_lowercase: normalizedUsername,
            full_name: nextFullName,
            description: trimmedDescription || null,
            avatar_url: avatarUrl,
            updatedAt: new Date(),
            last_seen_at: new Date(),
          });

          transaction.set(nextUsernameReservationRef, {
            user_id: currentUser.id,
            username: trimmedUsername,
            username_lowercase: normalizedUsername,
            updatedAt: new Date(),
          });

          if (normalizedUsername !== currentNormalizedUsername && currentNormalizedUsername) {
            transaction.delete(currentUsernameReservationRef);
          }
        }),
        5000,
        'Слишком долго сохраняются данные профиля'
      );

      await withTimeout(
        updateProfile(currentAuthUser, {
          displayName: nextFullName,
        }),
        4000,
        'Слишком долго обновляется профиль авторизации'
      );

      setState((prev) => ({
        ...prev,
        user: prev.user
          ? {
              ...prev.user,
              username: trimmedUsername,
              full_name: nextFullName,
              description: trimmedDescription || null,
              avatar_url: avatarUrl,
            }
          : prev.user,
      }));

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Не удалось обновить профиль',
      };
    }
  };

  const deleteCurrentUserAccount = async () => {
    const currentAuthUser = auth.currentUser;
    const currentUser = state.user;

    if (!currentAuthUser || !currentUser) {
      return { success: false, message: 'Пользователь не найден' };
    }

    try {
      await withTimeout(
        deleteUser(currentAuthUser),
        7000,
        'Слишком долго удаляется аккаунт'
      );

      setState({
        user: null,
        isLoading: false,
        isInitialized: true,
        isEmailVerified: false,
      });

      try {
        await Promise.all([
          deleteDoc(doc(db, 'users', currentUser.id)),
          currentUser.username
            ? deleteDoc(doc(db, USERNAME_RESERVATIONS_COLLECTION, normalizeUsername(currentUser.username)))
            : Promise.resolve(),
        ]);
      } catch (firestoreError) {
        console.error('Не удалось удалить документ пользователя после удаления auth-профиля:', firestoreError);
      }

      localStorage.removeItem('currentProjectId');
      localStorage.removeItem('currentOrgId');
      localStorage.removeItem('emailVerificationSent');
      return { success: true };
    } catch (error: any) {
      const code = String(error?.code || error?.message || '');
      if (code.includes('requires-recent-login')) {
        return {
          success: false,
          message: 'Для удаления аккаунта нужно заново войти в систему',
        };
      }

      return {
        success: false,
        message: 'Не удалось удалить аккаунт',
      };
    }
  };

  const signUp = async (email: string, password: string, username: string, fullName: string) => {
    try {
      const trimmedUsername = username.trim();
      const normalizedUsername = normalizeUsername(trimmedUsername);
      const trimmedFullName = fullName.trim();
      const usernameError = validateUsername(trimmedUsername);
      const fullNameError = validateFullName(trimmedFullName);

      if (usernameError || fullNameError) {
        return {
          data: null,
          error: { message: usernameError || fullNameError || 'Некорректные данные профиля' },
        };
      }

      const availability = await checkUsernameAvailability(trimmedUsername);

      if (!availability.available) {
        return {
          data: null,
          error: { message: availability.message || 'Имя пользователя уже занято' },
        };
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const actionCodeSettings = {
        url: window.location.origin + '/auth/callback', 
        handleCodeInApp: true, 
      };

      await updateProfile(user, { displayName: trimmedFullName || trimmedUsername });

      try {
        await runTransaction(db, async (transaction) => {
          const usernameReservationRef = doc(db, USERNAME_RESERVATIONS_COLLECTION, normalizedUsername);
          const usernameReservationSnapshot = await transaction.get(usernameReservationRef);
          const reservedFor = usernameReservationSnapshot.data()?.user_id;

          if (usernameReservationSnapshot.exists() && reservedFor !== user.uid) {
            throw new Error('Имя пользователя уже занято');
          }

          transaction.set(usernameReservationRef, {
            user_id: user.uid,
            username: trimmedUsername,
            username_lowercase: normalizedUsername,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          transaction.set(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            username: trimmedUsername,
            username_lowercase: normalizedUsername,
            full_name: trimmedFullName || trimmedUsername,
            avatar_url: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            last_seen_at: new Date(),
            description: null,
          });
        });
      } catch (transactionError: any) {
        try {
          await deleteUser(user);
        } catch (deleteAuthError) {
          console.error('Не удалось откатить auth-пользователя после конфликта username:', deleteAuthError);
        }

        return {
          data: null,
          error: { message: transactionError?.message || 'Имя пользователя уже занято' },
        };
      }

      await sendEmailVerification(user, actionCodeSettings);
      localStorage.setItem('emailVerificationSent', 'true');

      return { data: { user: profileFromUser(user, trimmedUsername) }, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: translateAuthError(error.message) },
      };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('emailVerificationSent');
    window.location.href = '/login';
  };

  const refreshEmailVerificationStatus = async () => {
    const currentAuthUser = auth.currentUser;
    if (!currentAuthUser) {
      setState((prev) => ({
        ...prev,
        isEmailVerified: false,
      }));
      return false;
    }

    await currentAuthUser.reload();
    const verified = currentAuthUser.emailVerified;

    setState((prev) => ({
      ...prev,
      isEmailVerified: verified,
      user: prev.user
        ? {
            ...prev.user,
            email: currentAuthUser.email || prev.user.email,
          }
        : prev.user,
    }));

    return verified;
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'Письмо для восстановления отправлено' };
    } catch (error: any) {
      return { success: false, message: translateAuthError(error.message) };
    }
  };

  const signInAnonymously = async () => {
    try {
      await firebaseSignInAnonymously(auth);
    } catch (err: any) {
      throw err;
    }
  };

  const value: AuthContextType = {
    user: state.user,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    isEmailVerified: state.isEmailVerified,
    signIn,
    signOut,
    signUp,
    resetPassword,
    checkUsernameAvailability,
    updateCurrentUserProfile,
    deleteCurrentUserAccount,
    refreshEmailVerificationStatus,
    signInAnonymously,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
