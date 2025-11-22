import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login/Login';
import AuthCallback from './pages/AuthCallback/AuthCallback';
import RecoveryCallback from './pages/RecoveryCallback/RecoveryCallback';
import Dashboard from './pages/Dashboard/Dashboard';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import styles from './App.module.css';

/**
 * Компонент для отображения состояния загрузки
 */
const LoadingState: React.FC = () => (
  <div className={styles.loadingContainer}>
    <div className={styles.loadingSpinner}></div>
    <div>Loading...</div>
  </div>
);

/**
 * Защищает маршруты, требующие аутентификации
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized } = useAuth();
  
  if (!isInitialized) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

/**
 * Маршруты для неаутентифицированных пользователей
 */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized } = useAuth();
  
  if (!isInitialized) return <LoadingState />;
  if (user) return <Navigate to="/dashboard" replace />;
  
  return <>{children}</>;
};

const RecoveryRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();
  
  if (!isInitialized) return <LoadingState />;
  
  // RecoveryRoute не проверяет user, но может проверять другие условия
  // если нужно, можно добавить дополнительную проверку
  return <>{children}</>;
};

const EmailConfirmationRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();
  
  if (!isInitialized) return <LoadingState />;
  
  // Можно добавить дополнительную проверку, что это действительно callback подтверждения
  // но обычно это безопасно, так как без валидного токена ничего не произойдет
  return <>{children}</>;
};

/**
 * Основной компонент маршрутизации
 */
function AppContent() {
  const { user } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Публичные маршруты */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login key={user ? 'authenticated' : 'unauthenticated'} />
            </PublicRoute>
          } 
        />

        <Route 
          path="/reset-password" 
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          } 
        />

        {/* Callback маршруты - открытые для всех */}
        <Route 
          path="/auth/callback" 
          element={
            <EmailConfirmationRoute>
              <AuthCallback />
            </EmailConfirmationRoute>
          } 
        />

        <Route 
          path="/recovery-callback" 
          element={
            <RecoveryRoute>
              <RecoveryCallback />
            </RecoveryRoute>
          } 
        />  

        <Route 
          path="/password-recovery" 
          element={
            <RecoveryRoute>
              <ResetPassword />
            </RecoveryRoute>
          } 
        />

        {/* Защищенные маршруты */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;