import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Shell } from './components/Shell';
import { PageSkeleton } from './components/ui';
import { useAuth } from './context/AuthContext';
import { Blog, BlogPost } from './pages/Blog';
import { Club } from './pages/Club';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { LogMeal } from './pages/LogMeal';
import { Login } from './pages/Login';
import { Nutritionist } from './pages/Nutritionist';
import { Profile } from './pages/Profile';
import { Suggestions } from './pages/Suggestions';

const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));

function Protected({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, ready, expired } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="page" role="status" aria-label="در حال بارگذاری">
        <PageSkeleton />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname, expired }} />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return (
    <Shell>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </Shell>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Routes>
      <Route path="/" element={ready && !user ? <Landing /> : <Protected><Dashboard /></Protected>} />
      <Route path="/login" element={<Login />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/log" element={<Protected><LogMeal /></Protected>} />
      <Route path="/club" element={<Protected><Club /></Protected>} />
      <Route path="/suggestions" element={<Protected><Suggestions /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/nutritionist" element={<Protected><Nutritionist /></Protected>} />
      <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
