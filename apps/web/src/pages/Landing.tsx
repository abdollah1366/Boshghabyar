import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'plate' as const, title: 'غذاهای ایرانی', text: 'پایگاهی از وعدههای رایج ایرانی، از چلوکباب تا آشرشته و دلمه تبریزی.' },
  { icon: 'chart' as const, title: 'محاسبه شفاف', text: 'کالری و درشت مغذیها با موتور عددی محاسبه میشود، نه حدس زدن مدل زبانی.' },
  { icon: 'spark' as const, title: 'پیشنهاد متعادل', text: 'جایگزینی متناسب با هدف تغذیهای و بودجه روزانه شما.' },
];

export function Landing() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const demo = async () => {
    await login('demo@boshghabyar.ir', 'Demo@12345');
    navigate('/');
  };

  return (
    <div className="main">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="plate" size={22} /></span> بشقاب‌یار</div>
        <div className="row">
          <Link className="btn btn-secondary btn-sm" to="/login">ورود</Link>
          <Link className="btn btn-sm" to="/login?mode=register">ثبتنام</Link>
        </div>
      </header>

      <section className="hero stack">
        <h1>بدانید بشقابتان چقدر ارزش دارد</h1>
        <p>وعدهتان را در چند ثانیه ثبت کنید، کالری و پروتئین آن را ببینید و پیشنهادی متعادل و اقتصادی دریافت کنید — به فارسی و بر پایه غذاهای ایرانی.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" to="/login?mode=register">شروع رایگان</Link>
          <button className="btn btn-secondary" type="button" onClick={demo}>ورود آزمایشی</button>
        </div>
        <p className="tiny muted">برگزیده استارتاپ ویکند غذا و تغذیه تبریز — ۱۴۰۵</p>
      </section>

      <div className="grid grid-3" style={{ marginBlockStart: 'var(--space-4)' }}>
        {FEATURES.map((feature) => (
          <div className="card" key={feature.title}>
            <span className="feature-icon"><Icon name={feature.icon} size={24} /></span>
            <h3>{feature.title}</h3>
            <p className="small muted">{feature.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
