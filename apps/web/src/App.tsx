import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Shell } from './components/Shell';
import { useAuth } from './context/AuthContext';
import { Admin } from './pages/Admin';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { LogMeal } from './pages/LogMeal';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { Reports } from './pages/Reports';
import { Suggestions } from './pages/Suggestions';

function Protected({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="main"><p className="muted">در حال بارگذاری…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Protected><Dashboard /></Protected> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/log" element={<Protected><LogMeal /></Protected>} />
      <Route path="/suggestions" element={<Protected><Suggestions /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
