import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ProjectProvider } from './contexts/ProjectContext';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Confirm from './pages/Confirm/Confirm';
import InvitePage from './pages/InvitePage/InvitePage';
import LoadingState from './components/ui/loading/LoadingState';
import SignUp from './pages/SignUp/SignUp';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import RecoveryCallback from './pages/RecoveryCallback/RecoveryCallback';

const EventListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleInvite = (e: CustomEvent) => {
      navigate(`/invite/${e.detail}`, { replace: true });
    };

    window.addEventListener('invite_after_login', handleInvite as any);
    return () => window.removeEventListener('invite_after_login', handleInvite as any);
  }, [navigate]);

  return null;
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AuthCallbackRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const UnprotectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  return <>{children}</>;
};

const FallbackRoute: React.FC = () => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  return <Navigate to={user ? '/' : '/login'} replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <>
      <EventListener />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
        <Route path="/password-recovery" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/recovery/callback" element={<AuthCallbackRoute><RecoveryCallback /></AuthCallbackRoute>} />
        <Route path="/confirm" element={<AuthCallbackRoute><Confirm /></AuthCallbackRoute>} />

        <Route
        path="/"
        element={<PrivateRoute><Dashboard /></PrivateRoute>}
      />
      
      <Route
        path="/dashboard"
        element={<PrivateRoute><Dashboard /></PrivateRoute>}
      />

        <Route
        path="/invite/:token"
        element={<UnprotectedRoute><InvitePage /></UnprotectedRoute>}
      />

        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </>
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
