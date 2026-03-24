export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  description: string | null;
  last_seen_at?: string | null;
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
  checkUsernameAvailability: (username: string) => Promise<{
    available: boolean;
    message?: string;
  }>;
  updateCurrentUserProfile: (payload: {
    username: string;
    fullName: string;
    description?: string;
    avatarFile?: File | null;
    removeAvatar?: boolean;
  }) => Promise<{
    success: boolean;
    message?: string;
  }>;
  deleteCurrentUserAccount: () => Promise<{
    success: boolean;
    message?: string;
  }>;
  refreshEmailVerificationStatus: () => Promise<boolean>;
  signInAnonymously: () => Promise<void>;
}
