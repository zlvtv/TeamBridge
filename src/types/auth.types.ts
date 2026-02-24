export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  description: string | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  isEmailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    username: string,
    fullName: string
  ) => Promise<{
    data: { user: UserProfile } | null;
    error: { message: string } | null;
  }>;
  resetPassword: (email: string) => Promise<{
    success: boolean;
    message: string;
  }>;
  signInAnonymously: () => Promise<void>;
}
