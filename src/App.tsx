// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { OrganizationProvider } from './contexts/OrganizationContext'; // Опечатка? Возможно, ProjectProvider должен быть здесь
import { ProjectProvider } from './contexts/ProjectContext';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Confirm from './pages/Confirm/Confirm';
import LoadingState from './components/ui/loading/LoadingState';
import SignUp from './pages/SignUp/SignUp';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import RecoveryCallback from './pages/RecoveryCallback/RecoveryCallback';

// Приватный маршрут: только для авторизованных
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();

  if (!isInitialized || isLoading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Публичный маршрут: только для НЕавторизованных
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Для обработки колбэков: показываем только если НЕ авторизован, иначе редирект
const AuthCallbackRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Фолбэк: 404 + редирект по авторизации
const FallbackRoute: React.FC = () => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  return <Navigate to={user ? '/' : '/login'} replace />;
};

// Только для авторизованных — например, смена пароля
const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuth();
  if (!isInitialized || isLoading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Основные маршруты
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/password-recovery" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/recovery/callback" element={<AuthCallbackRoute><RecoveryCallback /></AuthCallbackRoute>} />
      <Route path="/reset-password" element={<RedirectIfAuthenticated><ResetPassword /></RedirectIfAuthenticated>} />
      <Route path="/confirm" element={<AuthCallbackRoute><Confirm /></AuthCallbackRoute>} />
      <Route path="/" element={<PrivateRoute><OrganizationProvider><ProjectProvider><Dashboard /></ProjectProvider></OrganizationProvider></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><OrganizationProvider><ProjectProvider><Dashboard /></ProjectProvider></OrganizationProvider></PrivateRoute>} />
      <Route path="*" element={<FallbackRoute />} />
    </Routes>
  );
};

// Основной компонент
const App: React.FC = () => {
  return (
    <AuthProvider>
      <UIProvider>
        <Router>
          <AppRoutes />
        </Router>
      </UIProvider>
    </AuthProvider>
  );
};

export default App;
