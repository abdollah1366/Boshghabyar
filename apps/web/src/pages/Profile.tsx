import { useEffect, useState } from 'react';
import type { GoalType, UserGoal } from '@boshghabyar/core';

import { Icon } from '../components/Icon';
import { Notice, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError, track } from '../lib/api';
import { formatIRR } from '../lib/format';

const GOAL_TYPES: Array<{ value: GoalType; label: string }> = [
  { value: 'balance', label: 'تعادل' },
  { value: 'weight-loss', label: 'کاهش وزن' },
  { value: 'muscle-gain', label: 'افزایش عضله' },
  { value: 'budget', label: 'صرفهجویی' },
];

export function Profile() {
  const { user, updateGoal, upgrade } = useAuth();
  const [form, setForm] = useState<UserGoal | null>(user?.goal ?? null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('page.viewed', { page: 'profile' });
  }, []);

  if (!user || !form) return <p className="muted">در حال بارگذاری…</p>;

  const change = (key: keyof UserGoal, value: number | GoalType) => setForm({ ...form, [key]: value });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateGoal(form);
      setMessage('اهداف ذخیره شد.');
      track('goal.updated_from_ui');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در ذخیره اهداف');
    } finally {
      setBusy(false);
    }
  };

  const doUpgrade = async () => {
    setBusy(true);
    setError('');
    try {
      await upgrade();
      setMessage('نسخه حرفهای فعال شد (پرداخت آزمایشی).');
      track('plan.upgrade_pressed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در ارتقا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>نمایه و اهداف</h1>
          <p className="small muted">{user.name} · {user.email}</p>
        </div>
        <span className={`badge ${user.plan === 'pro' ? 'badge-pro' : ''}`}>{user.plan === 'pro' ? 'نسخه حرفهای' : 'نسخه رایگان'}</span>
      </div>

      {(message || error) && <Notice warn={Boolean(error)}>{message || error}</Notice>}

      <div className="grid grid-2">
        <form className="card stack" onSubmit={save}>
          <SectionTitle title="اهداف تغذیهای و بودجه" />
          <div className="field">
            <label htmlFor="goal-type">هدف</label>
            <select id="goal-type" className="select" value={form.goalType} onChange={(e) => change('goalType', e.target.value as GoalType)}>
              {GOAL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          {([
            ['calorieTarget', 'کالری روزانه', 'کیلوکالوری'],
            ['proteinTarget', 'پروتئین', 'گرم'],
            ['carbsTarget', 'کربوهیدرات', 'گرم'],
            ['fatTarget', 'چربی', 'گرم'],
            ['fiberTarget', 'فیبر', 'گرم'],
            ['dailyBudgetIRR', 'بودجه روزانه', 'تومان'],
          ] as Array<[keyof UserGoal, string, string]>).map(([key, label, unit]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label} ({unit})</label>
              <input id={key} className="input" type="number" min={0} value={Number(form[key])} onChange={(e) => change(key, Number(e.target.value))} />
            </div>
          ))}
          <button className="btn btn-block" type="submit" disabled={busy}>ذخیره اهداف</button>
        </form>

        <div className="stack">
          <div className="card stack">
            <SectionTitle title="نسخه حرفهای" action={<Icon name="spark" size={20} />} />
            <ul className="list">
              <li className="list-item"><span>همه غذاها و غذای سفارشی</span><Icon name={user.plan === 'pro' ? 'check' : 'shield'} size={18} /></li>
              <li className="list-item"><span>تاریخچه نامحدود</span><Icon name={user.plan === 'pro' ? 'check' : 'shield'} size={18} /></li>
              <li className="list-item"><span>گزارش پیشرفته و تحلیلها</span><Icon name={user.plan === 'pro' ? 'check' : 'shield'} size={18} /></li>
              <li className="list-item"><span>توضیح هوشمند پیشنهادها</span><Icon name={user.plan === 'pro' ? 'check' : 'shield'} size={18} /></li>
              <li className="list-item"><span>پنل متخصص تغذیه</span><Icon name={user.plan === 'pro' ? 'check' : 'shield'} size={18} /></li>
            </ul>
            <p className="tiny muted">قیمتگذاری نهایی پس از اعتبارسنجی بازار تعیین میشود. پرداخت فعلی آزمایشی است.</p>
            {user.plan !== 'pro' && <button className="btn btn-accent btn-block" type="button" onClick={doUpgrade} disabled={busy}>ارتقا به حرفهای</button>}
          </div>

          <div className="card">
            <SectionTitle title="حریم خصوصی" />
            <p className="small muted">دادههای وعدهها و اهداف شما محرمانهاند و فقط برای محاسبات داخل حساب شما استفاده میشوند. انتقال و حذف حساب در نسخه بعدی اضافه میشود.</p>
            <p className="tiny muted">بودجه فعلی: {formatIRR(form.dailyBudgetIRR)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
