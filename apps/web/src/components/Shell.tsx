import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../lib/format';
import { Coin, Icon } from './Icon';
import type { IconName } from './Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  admin?: boolean;
  mobile?: boolean;
  fab?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'خانه', icon: 'home', mobile: true },
  { to: '/club', label: 'باشگاه', icon: 'trophy', mobile: true },
  { to: '/log', label: 'ثبت وعده', icon: 'plus', mobile: true, fab: true },
  { to: '/reports', label: 'گزارش‌ها', icon: 'chart', mobile: true },
  { to: '/suggestions', label: 'پیشنهادها', icon: 'spark' },
  { to: '/profile', label: 'پروفایل', icon: 'user', mobile: true },
  { to: '/admin', label: 'مدیریت', icon: 'admin', admin: true },
];

const linkClass = ({ isActive }: { isActive: boolean }): string => (isActive ? 'nav-link active' : 'nav-link');

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = NAV.filter((item) => !item.admin || user?.role === 'admin');

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">پرش به محتوا</a>

      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark"><Icon name="bowl" size={22} /></span>
          بشقاب‌یار
        </Link>
        <nav className="stack-sm" aria-label="منوی اصلی">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="card stack-sm" style={{ padding: 12 }}>
          <div className="row between row-nowrap">
            <strong className="truncate">{user?.name}</strong>
            <span className={`badge ${user?.plan === 'pro' ? 'badge-pro' : ''}`}>{user?.plan === 'pro' ? 'حرفه‌ای' : 'رایگان'}</span>
          </div>
          <button className="btn btn-secondary btn-sm btn-block" type="button" onClick={doLogout}>
            <Icon name="logout" size={16} /> خروج
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <Link className="brand topbar-mobile-brand" to="/">
            <span className="brand-mark" style={{ width: 32, height: 32 }}><Icon name="bowl" size={18} /></span>
            بشقاب‌یار
          </Link>
          <span className="topbar-user small muted">سلام، {user?.name}</span>
          <div className="row row-nowrap">
            <span className={`badge ${user?.plan === 'pro' ? 'badge-pro' : ''}`}>{user?.plan === 'pro' ? 'حرفه‌ای' : 'رایگان'}</span>
            <Link className="chip chip-token" to="/club" aria-label={`ژتون‌های شما: ${formatNumber(user?.tokenBalance ?? 0)}`}>
              <Coin size={20} />
              <span className="num">{formatNumber(user?.tokenBalance ?? 0)}</span>
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page" key={pathname}>{children}</div>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="منوی پایین">
        {NAV.filter((item) => item.mobile).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={(state) => `${linkClass(state)} ${item.fab ? 'nav-fab' : ''}`}>
            {item.fab ? <span className="fab-disc"><Icon name={item.icon} size={22} /></span> : <Icon name={item.icon} size={22} />}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
