import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './app/store';
import './App.css';

const HomePage    = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage   = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ChatPage    = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const JoinPage    = lazy(() => import('./pages/JoinPage').then(m => ({ default: m.JoinPage })));

function App() {
  const theme = useAppStore(s => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div id="app-root">
      <Suspense fallback={null}>
        <Routes>
          <Route path="/"           element={<HomePage />} />
          <Route path="/login"      element={<LoginPage />} />
          <Route path="/register"   element={<RegisterPage />} />
          <Route path="/chat/:chatId" element={<ChatPage />} />
          <Route path="/join/:chatId"  element={<JoinPage />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
