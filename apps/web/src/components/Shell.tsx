import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../context/AuthContext';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'خانه', icon: 'home' },
  { to: '/log', label: 'ثبت وعده', icon: 'plus' },
  { to: '/suggestions', label: 'پیشنهادها', icon: 'spark' },
  { to: '/reports', label: 'گزارشها', icon: 'chart' },
  { to: '/profile', label: 'نمایه', icon: 'user' },
  { to: '/admin', label: 'مدیریت', icon: 'admin', admin: true },
];

const MOBILE_NAV = NAV.filter((item) => ['/', '/log', '/reports', '/profile'].includes(item.to));

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link active' : 'nav-link';
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Icon name="plate" size={22} /></span>
          بشقاب‌یار
        </div>
        {NAV.filter((item) => !item.admin || user?.role === 'admin').map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <Icon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="row">
            <strong className="brand-mark"><Icon name="plate" size={22} /></strong>
            <span className="small muted">همراه هوشمند وعدههای ایرانی</span>
          </div>
          <div className="row">
            <span className={`badge ${user?.plan === 'pro' ? 'badge-pro' : ''}`}>
              {user?.plan === 'pro' ? 'حرفهای' : 'رایگان'}
            </span>
            <span className="small muted">{user?.name}</span>
            <button className="btn btn-secondary btn-sm" onClick={doLogout} type="button">
              <Icon name="logout" size={18} /> خروج
            </button>
          </div>
        </header>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="ناوبری اصلی">
        {MOBILE_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <Icon name={item.icon} size={22} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
