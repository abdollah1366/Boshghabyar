import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Coin, Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import type { AppUser } from '../lib/types';

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'camera', title: 'تشخیص غذا با عکس', text: 'از بشقابتان عکس بگیرید؛ نام غذا و مقدار پیشنهادی را در چند ثانیه می‌بینید.' },
  { icon: 'plate', title: 'غذاهای ایرانی', text: 'پایگاهی از غذاهای رایج ایرانی، از چلو کباب و قورمه سبزی تا آش رشته و دلمهٔ تبریزی.' },
  { icon: 'chart', title: 'گزارش شفاف', text: 'کالری و درشت‌مغذی‌ها را موتور محاسبه می‌کند، نه حدس یک مدل زبانی.' },
  { icon: 'trophy', title: 'باشگاه مشتریان', text: 'با ثبت وعده‌ها و دعوت دوستان ژتون بگیرید و نسخهٔ حرفه‌ای را رایگان فعال کنید.' },
  { icon: 'calendar', title: 'برنامهٔ غذایی هفتگی', text: 'برنامهٔ هر روز با دستور پخت، انرژی و هزینهٔ تقریبی تا راحت تصمیم بگیرید.' },
  { icon: 'heart', title: 'ردگیری سلامتی', text: 'قند، وزن، فشار خون و HbA1c را ثبت کنید و روند هفتگی و ماهانه ببینید.' },
  { icon: 'scan', title: 'بارکد محصولات', text: 'بارکد محصول را اسکن کنید و با ثبت انرژی آن، به پایگاه دادهٔ همه کمک کنید.' },
  { icon: 'doctor', title: 'پنل متخصص تغذیه', text: 'گزارش مراجعان را یک‌جا ببینید و پایش‌شان کنید.' },
];

export function Landing() {
  useDocumentTitle('بشقاب‌یار — تغذیهٔ هوشمند ایرانی');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ token: string; user: AppUser }>('/api/auth/demo', { method: 'POST' });
      signIn(result.token, result.user);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand" to="/" style={{ padding: 0 }}>
          <span className="brand-mark"><Icon name="bowl" size={22} /></span>
          بشقاب‌یار
        </Link>
        <nav style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Link className="nav-link" to="/blog">وبلاگ</Link>
          <Link className="btn btn-secondary btn-sm" to="/login">ورود</Link>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">بدانید بشقابتان چقدر ارزش دارد</h1>
          <p>وعده‌تان را در چند ثانیه ثبت کنید یا از آن عکس بگیرید، کالری و پروتئینش را ببینید و پیشنهادی متعادل و اقتصادی بگیرید؛ به فارسی و بر پایهٔ غذاهای ایرانی.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-light btn-lg" to="/login">شروع رایگان با شمارهٔ موبایل</Link>
            <button className="btn btn-lg" type="button" onClick={demo} disabled={busy} style={{ background: 'rgb(255 255 255 / 16%)', border: '1px solid rgb(255 255 255 / 35%)' }}>
              {busy ? 'در حال ورود…' : 'ورود آزمایشی'}
            </button>
          </div>
          {error && <div style={{ maxWidth: 420, width: '100%', textAlign: 'start' }}><Notice tone="error">{error}</Notice></div>}
          <p className="tiny">بدون رمز عبور؛ فقط یک کد پیامکی.</p>
        </section>

        <div className="landing-body">
          <section aria-labelledby="what-title" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <h2 id="what-title">بشقاب‌یار چیست؟</h2>
            <p className="muted">
              بشقاب‌یار یک همراه هوشمند برای تغذیهٔ ایرانی است: وعده را ثبت کنید، ارزش غذایی و هزینهٔ آن را ببینید و جایگزین متعادل‌تر و مقرون‌به‌صرفه‌تر پیدا کنید.
              محاسبات ما کاملاً تعیین‌پذیر و قابل توضیح است؛ هیچ مدل زبانی عددی تولید نمی‌کند و همهٔ اعداد از موتور محاسبهٔ خود بشقاب‌یار می‌آید.
              این محصول در استارتاپ ویکند غذا و تغذیهٔ تبریز ۱۴۰۵ (از میان ۲۲ طرح منتخب) شکل گرفت.
            </p>
          </section>

          <div className="grid grid-4">
            {FEATURES.map((feature) => (
              <div className="card" key={feature.title}>
                <span className="feature-icon"><Icon name={feature.icon} size={24} /></span>
                <h2 style={{ fontSize: 'var(--text-md)' }}>{feature.title}</h2>
                <p className="small muted">{feature.text}</p>
              </div>
            ))}
          </div>

          <section className="card card-hero card-lg row between" aria-labelledby="club-title" style={{ gap: 'var(--space-3)' }}>
            <div className="stack-sm" style={{ maxWidth: 560 }}>
              <h2 id="club-title">با هر وعده، ژتون بگیرید</h2>
              <p className="small">ورود روزانه، ثبت وعده و دعوت دوستان به شما ژتون می‌دهد؛ با ژتون، گزارش‌های تکمیلی و امکانات حرفه‌ای را بدون پرداخت پول فعال کنید.</p>
            </div>
            <Coin size={72} />
          </section>

          <p className="footer-note">
            بشقاب‌یار؛ ساخته‌شده برای تغذیهٔ ایرانی · <Link to="/blog" className="muted">مطالب وبلاگ</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
