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
} from 'firebase/auth';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, AuthContextType } from '../types/auth.types';

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
});

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
        const isVerified = user.emailVerified;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        const profile: UserProfile = {
          id: user.uid,
          email: user.email || '',
          username: userData?.username || user.email?.split('@')[0] || 'user',
          full_name: userData?.full_name || user.displayName || userData?.username || 'User',
          avatar_url: user.photoURL || userData?.avatar_url || null,
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

  const signIn = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      if (!user.emailVerified) {
        throw new Error('email not confirmed');
      }
    } catch (error: any) {
      throw new Error(translateAuthError(error.message));
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const actionCodeSettings = {
        url: 'https://teambridge-c991.onrender.com/confirm',
        handleCodeInApp: true,
      };

      await updateProfile(user, { displayName: username });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        username,
        full_name: username,
        avatar_url: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await sendEmailVerification(user, actionCodeSettings);
      localStorage.setItem('emailVerificationSent', 'true');

      return { data: { user: profileFromUser(user, username) }, error: null };
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
    signInAnonymously,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
