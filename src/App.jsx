import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import api from './services/api';

import Login from './pages/Login';
import Register from './pages/Register';
import SessionUnlock from './pages/SessionUnlock';
import ChatDashboard from './pages/ChatDashboard';

function ProtectedRoute({ children }) {
  const { isAuthenticated, privateKey, isInitializing } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-dark-bg)]">
        <div className="flex flex-col items-center gap-4 text-white/60">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Private key was lost on page reload — prompt password to re-derive it
  if (!privateKey) {
    return <SessionUnlock />;
  }

  return children;
}

export default function App() {
  const { setAuth, setInitializing, logout } = useAuthStore();

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      // Validate token by fetching the current user profile
      api.get('/auth/me')
        .then((res) => {
          // Pass refresh token too — it may already be in sessionStorage
          const refreshToken = sessionStorage.getItem('refresh_token');
          setAuth(res.data, token, refreshToken);
        })
        .catch(() => {
          // Token invalid or expired and refresh also failed — clean up
          logout();
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
