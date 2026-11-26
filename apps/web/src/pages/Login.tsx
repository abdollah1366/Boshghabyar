import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError, api, errorMessage } from '../lib/api';
import { digitsOnly, formatClock, normalizePhone, toLatinDigits, toPersianDigits } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import type { AppUser } from '../lib/types';

const REF_KEY = 'boshghabyar_ref';
const CODE_LENGTH = 5;

interface OtpRequestResponse { ok: boolean; expiresInSec: number; resendInSec: number; devCode?: string }
interface AuthResponse { token: string; user: AppUser; isNew?: boolean }

function readSavedRef(): string {
  try {
    return localStorage.getItem(REF_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveRef(code: string): void {
  try {
    if (code) localStorage.setItem(REF_KEY, code);
    else localStorage.removeItem(REF_KEY);
  } catch {
    /* بدون حافظه */
  }
}

const cleanRef = (value: string): string => toLatinDigits(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export function Login() {
  useDocumentTitle('ورود');
  const { user, signIn, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [name, setName] = useState('');
  const [referral, setReferral] = useState('');
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const sessionEnded = expired || (location.state as { expired?: boolean } | null)?.expired === true;

  useEffect(() => {
    const fromUrl = cleanRef(params.get('ref') ?? '');
    if (fromUrl) saveRef(fromUrl);
    setReferral(fromUrl || readSavedRef());
  }, [params]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
    else phoneRef.current?.focus();
  }, [step]);

  const finish = useCallback(
    (result: AuthResponse) => {
      saveRef('');
      signIn(result.token, result.user);
      navigate(from, { replace: true });
    },
    [from, navigate, signIn],
  );

  if (user) return <Navigate to={from} replace />;

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = normalizePhone(phoneInput || phone);
    if (!normalized) {
      setError('شمارهٔ موبایل معتبر نیست؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹');
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const result = await api<OtpRequestResponse>('/api/auth/otp/request', { method: 'POST', json: { phone: normalized } });
      setPhone(normalized);
      setCode('');
      setDevCode(result.devCode ?? '');
      setCountdown(result.resendInSec ?? 60);
      setStep('code');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && err.retryAfterSec && err.retryAfterSec <= 120) {
        setPhone(normalized);
        setCountdown(err.retryAfterSec);
        setDevCode('');
        setInfo('کد پیش‌تر برای شما ارسال شده است؛ همان را وارد کنید.');
        setStep('code');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError('کد ۵ رقمی را کامل وارد کنید');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = { phone, code };
      const trimmed = name.trim();
      if (trimmed.length >= 2) body.name = trimmed;
      if (referral) body.referralCode = referral;
      body.researchConsent = consent;
      finish(await api<AuthResponse>('/api/auth/otp/verify', { method: 'POST', json: body }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      finish(await api<AuthResponse>('/api/auth/demo', { method: 'POST' }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const passwordLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      finish(await api<AuthResponse>('/api/auth/login', { method: 'POST', json: { email: email.trim(), password } }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const onCode = (value: string) => {
    setCode(digitsOnly(value).slice(0, CODE_LENGTH));
    setError('');
  };

  return (
    <div className="auth-wrap">
      <main className="card auth-card" aria-labelledby="login-title">
        <div className="auth-head">
          <span className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16 }}><Icon name="bowl" size={28} /></span>
          <h1 id="login-title" style={{ fontSize: 'var(--text-lg)' }}>
            {step === 'phone' ? 'ورود یا ثبت‌نام' : 'کد تأیید را وارد کنید'}
          </h1>
          <p className="small muted">
            {step === 'phone'
              ? 'فقط با شمارهٔ موبایل؛ بدون رمز عبور'
              : <>کد ۵ رقمی به <bdi className="ltr">{toPersianDigits(phone)}</bdi> ارسال شد</>}
          </p>
        </div>

        {sessionEnded && step === 'phone' && (
          <Notice tone="warn" icon="clock">نشست شما به پایان رسیده است؛ لطفاً دوباره وارد شوید.</Notice>
        )}
        {info && <Notice>{info}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        {step === 'phone' ? (
          <>
            <form className="stack" onSubmit={requestCode} noValidate>
              <div className="field">
                <label htmlFor="phone">شمارهٔ موبایل</label>
                <input
                  id="phone"
                  ref={phoneRef}
                  className="input input-lg ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={phoneInput}
                  onChange={(e) => { setPhoneInput(e.target.value); setError(''); }}
                  maxLength={20}
                  required
                />
                <span className="field-hint">با ۰۹… یا ۹۸+ وارد کنید؛ ارقام فارسی و انگلیسی هر دو پذیرفته می‌شود.</span>
              </div>
              <button className="btn btn-lg btn-block" type="submit" disabled={busy || phoneInput.trim().length < 10}>
                {busy ? 'در حال ارسال…' : 'دریافت کد ورود'}
              </button>
            </form>

            <div className="divider">یا</div>
            <button className="btn btn-secondary btn-lg btn-block" type="button" onClick={demo} disabled={busy}>
              <Icon name="spark" size={20} /> ورود آزمایشی
            </button>
            <p className="tiny faint center">بدون ثبت‌نام و با داده‌های نمونه، برنامه را امتحان کنید.</p>

            <details className="disclosure">
              <summary>ورود با ایمیل (مدیر/قدیمی)</summary>
              <form className="stack" onSubmit={passwordLogin} style={{ marginBlockStart: 'var(--space-2)' }}>
                <div className="field">
                  <label htmlFor="email">ایمیل</label>
                  <input id="email" className="input ltr" type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="password">رمز عبور</label>
                  <input id="password" className="input ltr" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-secondary btn-block" type="submit" disabled={busy || !email || !password}>ورود</button>
              </form>
            </details>
          </>
        ) : (
          <form className="stack" onSubmit={verify} noValidate>
            {devCode && (
              <Notice tone="accent" icon="spark" onClose={() => setDevCode('')}>
                <div className="stack-sm">
                  <span>حالت آزمایشی: کد شما <strong className="ltr">{toPersianDigits(devCode)}</strong> است</span>
                  <div>
                    <button className="btn btn-sm" type="button" onClick={() => { setCode(devCode); setDevCode(''); setError(''); }}>
                      پر کردن خودکار
                    </button>
                  </div>
                </div>
              </Notice>
            )}

            <div className="field">
              <label htmlFor="code">کد تأیید</label>
              <input
                id="code"
                ref={codeRef}
                className="input input-code ltr"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                pattern="[0-9۰-۹٠-٩]*"
                maxLength={12}
                placeholder="• • • • •"
                value={toPersianDigits(code)}
                onChange={(e) => onCode(e.target.value)}
                aria-describedby="code-hint"
                required
              />
              <span id="code-hint" className="field-hint center">کد ۵ رقمی پیامک‌شده را وارد کنید.</span>
            </div>

            <details className="disclosure" open={Boolean(referral)}>
              <summary>اولین بار است؟ اطلاعات اختیاری</summary>
              <div className="stack" style={{ marginBlockStart: 'var(--space-2)' }}>
                <div className="field">
                  <label htmlFor="name">نام شما (اختیاری)</label>
                  <input id="name" className="input" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="ref">کد معرف (اختیاری)</label>
                  <input id="ref" className="input ltr" dir="ltr" maxLength={12} autoCapitalize="characters" value={referral} onChange={(e) => setReferral(cleanRef(e.target.value))} />
                  <span className="field-hint">با کد دوستتان، ۲۰ ژتون هدیه می‌گیرید.</span>
                </div>
                <label className="check">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    <strong>مشارکت در پژوهش</strong> با داده‌های ناشناس؛ ۱۰ ژتون هدیه.
                    <span className="tiny muted" style={{ display: 'block' }}>نام و شمارهٔ شما هرگز همراه داده‌ها نمی‌ماند و هر زمان می‌توانید آن را از پروفایل لغو کنید.</span>
                  </span>
                </label>
              </div>
            </details>

            <button className="btn btn-lg btn-block" type="submit" disabled={busy || code.length !== CODE_LENGTH}>
              {busy ? 'در حال بررسی…' : 'ورود'}
            </button>

            <div className="row between">
              <button className="btn-link small" type="button" onClick={() => { setStep('phone'); setError(''); setInfo(''); setDevCode(''); }}>
                تغییر شماره
              </button>
              <button className="btn-link small otp-countdown" type="button" disabled={countdown > 0 || busy} onClick={() => requestCode()} style={countdown > 0 ? { opacity: 0.6, textDecoration: 'none', cursor: 'default' } : undefined}>
                {countdown > 0 ? `ارسال دوباره تا ${formatClock(countdown)}` : 'ارسال دوبارهٔ کد'}
              </button>
            </div>
          </form>
        )}

        <p className="tiny faint center">
          نشست شما پس از ورود ۳۰ روز معتبر می‌ماند.
        </p>
      </main>
    </div>
  );
}
