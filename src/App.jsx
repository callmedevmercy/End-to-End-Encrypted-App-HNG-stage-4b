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
    return <div className="min-h-screen flex items-center justify-center bg-[var(--color-dark-bg)] text-white">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

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
      // Validate token and fetch user profile
      api.get('/auth/me')
        .then((res) => {
          setAuth(res.data, token);
        })
        .catch(() => {
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
