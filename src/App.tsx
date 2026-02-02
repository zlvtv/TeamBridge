import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ProjectProvider } from './contexts/ProjectContext';
import Login from './pages/Login/Login';
import SignUp from './pages/SignUp/SignUp';
import Dashboard from './pages/Dashboard/Dashboard';
import Confirm from './pages/Confirm/Confirm';
import InvitePage from './pages/InvitePage/InvitePage';
import Landing from './pages/Landing/Landing';
import LoadingState from './components/ui/loading/LoadingState';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import AuthCallback from './pages/AuthCallback/AuthCallback';
import RecoveryCallback from './pages/RecoveryCallback/RecoveryCallback';

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();

  if (!isInitialized || isLoading) return <LoadingState />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isEmailVerified, isInitialized, isLoading } = useAuth();

  if (!isInitialized || isLoading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isEmailVerified) return <Navigate to="/confirm" replace />;

  return <>{children}</>;
};

const UnprotectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized, isLoading } = useAuth();
  if (!isInitialized && isLoading) return <LoadingState />;
  return <>{children}</>;
};

const VerifyEmailRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isEmailVerified, isInitialized, isLoading } = useAuth();

  if (!isInitialized || isLoading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (isEmailVerified) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const handleAuthRedirects = () => {
  if (window.location.pathname === '/' && window.location.hash) {
    const hash = window.location.hash;

    if (hash.includes('access_token')) {
      if (hash.includes('type=recovery')) {
        window.location.replace(`/recovery/callback${hash}`);
        return true;
      }
      if (hash.includes('type=signup')) {
        window.location.replace(`/confirm${hash}`);
        return true;
      }
    }
  }
  return false;
};

const AppRoutes: React.FC = () => {
  useEffect(() => {
    if (handleAuthRedirects()) {
      return;
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<UnprotectedRoute><Login /></UnprotectedRoute>} />
      <Route path="/signup" element={<UnprotectedRoute><SignUp /></UnprotectedRoute>} />
      <Route path="/password-recovery" element={<UnprotectedRoute><ForgotPassword /></UnprotectedRoute>} />

      <Route path="/auth/callback" element={<UnprotectedRoute><AuthCallback /></UnprotectedRoute>} />
      <Route path="/recovery/callback" element={<UnprotectedRoute><RecoveryCallback /></UnprotectedRoute>} />

      <Route path="/reset-password" element={<VerifyEmailRoute><ResetPassword /></VerifyEmailRoute>} />

      <Route path="/confirm" element={<VerifyEmailRoute><Confirm /></VerifyEmailRoute>} />

      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

      <Route path="/invite/:token" element={<UnprotectedRoute><InvitePage /></UnprotectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <UIProvider>
        <OrganizationProvider>
          <ProjectProvider>
            <Router>
              <AppRoutes />
            </Router>
          </ProjectProvider>
        </OrganizationProvider>
      </UIProvider>
    </AuthProvider>
  );
};

export default App;
