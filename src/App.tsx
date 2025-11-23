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
 * Специальный маршрут для восстановления пароля
 * Разрешает доступ даже при временной recovery сессии
 */
const RecoveryProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();
  
  if (!isInitialized) return <LoadingState />;
  
  return <>{children}</>;
};

/**
 * Основной компонент маршрутизации
 */
function AppContent() {
  const { user, isInitialized } = useAuth();

  if (!isInitialized) {
    return <LoadingState />;
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/recovery-callback" element={<RecoveryCallback />} />
          <Route 
            path="/password-recovery" 
            element={
              <RecoveryProtectedRoute>
                <ResetPassword />
              </RecoveryProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
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

        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/recovery-callback" element={<RecoveryCallback />} />
        <Route 
          path="/password-recovery" 
          element={
            <RecoveryProtectedRoute>
              <ResetPassword />
            </RecoveryProtectedRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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