import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { track } from '../lib/api';

export function Login() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(name, email, password);
      else await login(email, password);
      track(mode === 'register' ? 'ui.register_completed' : 'ui.login_completed');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در ارتباط با سرور');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main">
      <header className="topbar">
        <Link className="brand" to="/"><span className="brand-mark"><Icon name="plate" size={22} /></span> بشقاب‌یار</Link>
      </header>

      <div className="card auth-card stack">
        <h1>{mode === 'login' ? 'خوش آمدید' : 'ثبتنام'}</h1>
        <p className="small muted">{mode === 'login' ? 'با حساب خود وارد شوید.' : 'حساب رایگان خود را بسازید.'}</p>

        <form onSubmit={submit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">نام</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">ایمیل</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" dir="ltr" />
          </div>
          <div className="field">
            <label htmlFor="password">رمز عبور</label>
            <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} dir="ltr" />
            {mode === 'register' && <span className="tiny muted">حداقل ۸ کاراکتر</span>}
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy ? 'لطفاً صبر کنید…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}
          </button>
        </form>

        <div className="row between small">
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'حساب ندارید؟ ثبتنام' : 'حساب دارید؟ ورود'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={async () => {
              setBusy(true);
              try {
                await login('demo@boshghabyar.ir', 'Demo@12345');
                navigate('/', { replace: true });
              } catch {
                setError('ورود آزمایشی در دسترس نیست');
              } finally {
                setBusy(false);
              }
            }}
          >
            ورود آزمایشی
          </button>
        </div>
      </div>
    </div>
  );
}
