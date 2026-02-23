import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { ThemeProvider } from './contexts/ThemeProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ToastContainer from './components/ui/toast/ToastContainer';

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

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isEmailVerified, isInitialized } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  if (oobCode && mode === 'resetPassword') {
    return <Navigate to={`/reset-password?oobCode=${oobCode}`} replace />;
  }

  if (!isInitialized) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isEmailVerified) return <Navigate to="/confirm" replace />;

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isEmailVerified, isInitialized } = useAuth();

  if (!isInitialized) return <LoadingState />;
  if (user && isEmailVerified) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const ConfirmRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isEmailVerified, isInitialized } = useAuth();

  if (!isInitialized) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (isEmailVerified) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const ResetPasswordRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const oobCodeFromUrl = searchParams.get('oobCode');
  const oobCodeFromStorage = localStorage.getItem('reset_password_oobCode');
  const hasOobCode = oobCodeFromUrl || oobCodeFromStorage;

  if (!isInitialized && !hasOobCode) return <LoadingState />;
  if (!hasOobCode) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const AuthCallbackRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();
  if (!isInitialized) return <LoadingState />;
  return <>{children}</>;
};

const InviteRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();
  if (!isInitialized) return <LoadingState />;
  return <>{children}</>;
};

const HomeRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isEmailVerified, isInitialized } = useAuth();
  if (!isInitialized) return <LoadingState />;
  if (user && isEmailVerified) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <UIProvider>
        <AuthProvider>
          <NotificationProvider>
            <OrganizationProvider>
              <ProjectProvider>
                <Router>
                  <Routes>
                    <Route path="/" element={<HomeRoute><Landing /></HomeRoute>} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
                    <Route path="/password-recovery" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                    <Route path="/reset-password" element={<ResetPasswordRoute><ResetPassword /></ResetPasswordRoute>} />

                    <Route path="/recovery/callback" element={<AuthCallbackRoute><RecoveryCallback /></AuthCallbackRoute>} />
                    <Route path="/auth/callback" element={<AuthCallbackRoute><AuthCallback /></AuthCallbackRoute>} />

                    <Route path="/confirm" element={<ConfirmRoute><Confirm /></ConfirmRoute>} />

                    <Route
                      path="/dashboard"
                      element={
                        <PrivateRoute>
                          <Dashboard />
                        </PrivateRoute>
                      }
                    />

                    <Route
                      path="/invite/:token"
                      element={
                        <InviteRoute>
                          <InvitePage />
                        </InviteRoute>
                      }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  <ToastContainer />
                </Router>
              </ProjectProvider>
            </OrganizationProvider>
          </NotificationProvider>
        </AuthProvider>
      </UIProvider>
    </ThemeProvider>
  );
};

export default App;
