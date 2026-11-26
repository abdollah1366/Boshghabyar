import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GoalType, UserGoal } from '@boshghabyar/core';

import { Icon } from '../components/Icon';
import { ConfirmDialog, Notice, PageHead, Switch } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError, errorMessage } from '../lib/api';
import { GOAL_LABELS, countdownText, digitsOnly, formatFullDate, formatNumber, toPersianDigits } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

type GoalForm = Record<'calorieTarget' | 'proteinTarget' | 'carbsTarget' | 'fatTarget' | 'fiberTarget' | 'dailyBudgetIRR', string>;

const GOAL_FIELDS: Array<{ key: keyof GoalForm; label: string; unit: string; min: number; max: number }> = [
  { key: 'calorieTarget', label: 'کالری روزانه', unit: 'کیلوکالری', min: 800, max: 6000 },
  { key: 'proteinTarget', label: 'پروتئین', unit: 'گرم', min: 10, max: 400 },
  { key: 'carbsTarget', label: 'کربوهیدرات', unit: 'گرم', min: 10, max: 800 },
  { key: 'fatTarget', label: 'چربی', unit: 'گرم', min: 5, max: 300 },
  { key: 'fiberTarget', label: 'فیبر', unit: 'گرم', min: 0, max: 100 },
  { key: 'dailyBudgetIRR', label: 'بودجهٔ روزانه', unit: 'تومان', min: 0, max: 100_000_000 },
];

const GOAL_TYPES: GoalType[] = ['balance', 'weight-loss', 'muscle-gain', 'budget'];

const toForm = (goal: UserGoal): GoalForm => ({
  calorieTarget: String(goal.calorieTarget),
  proteinTarget: String(goal.proteinTarget),
  carbsTarget: String(goal.carbsTarget),
  fatTarget: String(goal.fatTarget),
  fiberTarget: String(goal.fiberTarget),
  dailyBudgetIRR: String(goal.dailyBudgetIRR),
});

export function Profile() {
  useDocumentTitle('پروفایل');
  const { user, updateGoal, updateProfile, upgrade, logout, deleteAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [goalForm, setGoalForm] = useState<GoalForm | null>(user ? toForm(user.goal) : null);
  const [goalType, setGoalType] = useState<GoalType>(user?.goal.goalType ?? 'balance');
  const [busy, setBusy] = useState('');
  const [goalError, setGoalError] = useState('');
  const [dialog, setDialog] = useState<'logout-all' | 'delete' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [upgradeError, setUpgradeError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setGoalForm(toForm(user.goal));
      setGoalType(user.goal.goalType);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !goalForm) return null;
  const proLeft = countdownText(user.proUntil);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('نام باید دست‌کم ۲ نویسه باشد');
      return;
    }
    setBusy('name');
    try {
      await updateProfile({ name: trimmed });
      toast.success('نام شما به‌روزرسانی شد');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const saveGoals = async (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, number | string> = { goalType };
    for (const field of GOAL_FIELDS) {
      const value = Number(goalForm[field.key]);
      if (!goalForm[field.key] || !Number.isFinite(value) || value < field.min || value > field.max) {
        setGoalError(`«${field.label}» باید بین ${formatNumber(field.min)} و ${formatNumber(field.max)} باشد`);
        return;
      }
      payload[field.key] = Math.round(value);
    }
    setGoalError('');
    setBusy('goal');
    try {
      await updateGoal(payload as Partial<UserGoal>);
      toast.success('هدف‌های شما ذخیره شد');
    } catch (err) {
      setGoalError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const toggleConsent = async (value: boolean) => {
    setBusy('consent');
    const before = user.tokenBalance;
    try {
      const next = await updateProfile({ researchConsent: value });
      const gained = next.tokenBalance - before;
      if (gained > 0) toast.token(`+${formatNumber(gained)} ژتون؛ از مشارکت شما سپاسگزاریم`);
      else toast.success(value ? 'مشارکت در پژوهش فعال شد' : 'مشارکت در پژوهش لغو شد');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const doUpgrade = async () => {
    setBusy('upgrade');
    setUpgradeError('');
    try {
      await upgrade();
      toast.success('نسخهٔ حرفه‌ای فعال شد');
    } catch (err) {
      setUpgradeError(err instanceof ApiError && err.status === 501 ? 'پرداخت آنلاین هنوز فعال نشده است؛ فعلاً می‌توانید با ژتون باشگاه آن را فعال کنید.' : errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const doLogout = async (everywhere: boolean) => {
    setBusy('logout');
    await logout(everywhere);
    navigate('/login', { replace: true });
  };

  const doDelete = async () => {
    setBusy('delete');
    try {
      await deleteAccount();
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 403 ? 'حساب مدیر را نمی‌توان حذف کرد' : errorMessage(err));
      setDialog(null);
      setBusy('');
    }
  };

  const closeDialog = () => { setDialog(null); setConfirmText(''); };

  return (
    <>
      <PageHead title="پروفایل" subtitle="حساب، هدف‌ها و حریم خصوصی شما" />

      <section className="card card-lg row" style={{ gap: 'var(--space-3)', flexWrap: 'nowrap' }} aria-label="خلاصهٔ حساب">
        <span className="brand-mark" style={{ width: 64, height: 64, borderRadius: 20, fontSize: '1.6rem', fontWeight: 700 }} aria-hidden="true">{user.name.slice(0, 1)}</span>
        <div className="grow stack-sm">
          <h2 className="truncate">{user.name}</h2>
          <p className="small muted ltr">{user.phone ? toPersianDigits(user.phone) : user.email ?? ''}</p>
          <div className="row">
            <span className={`badge ${user.plan === 'pro' ? 'badge-pro' : ''}`}>{user.plan === 'pro' ? 'نسخهٔ حرفه‌ای' : 'نسخهٔ رایگان'}</span>
            <span className="badge badge-gold">سطح {user.level.labelFa}</span>
            <span className="small muted">عضویت از {formatFullDate(user.createdAt)}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <form className="card stack" onSubmit={saveName}>
            <h2 style={{ fontSize: 'var(--text-md)' }}>نام نمایشی</h2>
            <div className="field">
              <label htmlFor="name">نام</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required />
            </div>
            <button className="btn" type="submit" disabled={busy === 'name' || name.trim() === user.name}>{busy === 'name' ? 'در حال ذخیره…' : 'ذخیره نام'}</button>
          </form>

          <section className="card stack" aria-labelledby="plan-title">
            <h2 id="plan-title" style={{ fontSize: 'var(--text-md)' }}>وضعیت اشتراک</h2>
            {user.plan === 'pro' ? (
              <Notice tone="success" icon="crown">
                {proLeft ? <>نسخهٔ حرفه‌ای شما <strong>{proLeft}</strong> دیگر فعال است.</> : 'نسخهٔ حرفه‌ای شما فعال است.'}
              </Notice>
            ) : (
              <>
                <p className="small muted">گزارش‌های تکمیلی، خروجی CSV، غذای سفارشی و سهمیهٔ بیشتر تشخیص با عکس در نسخهٔ حرفه‌ای باز می‌شود.</p>
                {upgradeError && <Notice tone="warn">{upgradeError}</Notice>}
                <div className="row">
                  <button className="btn" type="button" onClick={doUpgrade} disabled={busy === 'upgrade'}><Icon name="crown" size={18} /> ارتقا به حرفه‌ای</button>
                  <Link className="btn btn-secondary" to="/club">با ژتون فعال کن</Link>
                </div>
              </>
            )}
          </section>

          <section className="card stack" aria-labelledby="privacy-title">
            <h2 id="privacy-title" style={{ fontSize: 'var(--text-md)' }}>حریم خصوصی</h2>
            <Switch
              checked={user.researchConsent}
              disabled={busy === 'consent'}
              onChange={toggleConsent}
              label="مشارکت در پژوهش"
              description="داده‌های تغذیهٔ شما به‌صورت ناشناس برای پژوهش به کار می‌رود و ۱۰ ژتون هدیه می‌گیرید. هر زمان می‌توانید آن را لغو کنید."
            />
          </section>
        </div>

        <form className="card stack" onSubmit={saveGoals} aria-labelledby="goal-title">
          <h2 id="goal-title" style={{ fontSize: 'var(--text-md)' }}>هدف‌های روزانه</h2>
          <div className="field">
            <span className="label" id="goal-type-label">نوع هدف</span>
            <div className="segmented" role="group" aria-labelledby="goal-type-label">
              {GOAL_TYPES.map((type) => (
                <button key={type} type="button" aria-pressed={goalType === type} onClick={() => setGoalType(type)}>{GOAL_LABELS[type]}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-2">
            {GOAL_FIELDS.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={`goal-${field.key}`}>{field.label} ({field.unit})</label>
                <input
                  id={`goal-${field.key}`}
                  className="input num"
                  inputMode="numeric"
                  autoComplete="off"
                  value={toPersianDigits(goalForm[field.key])}
                  onChange={(e) => { setGoalForm({ ...goalForm, [field.key]: digitsOnly(e.target.value).slice(0, 9) }); setGoalError(''); }}
                />
              </div>
            ))}
          </div>
          {goalError && <Notice tone="error">{goalError}</Notice>}
          <button className="btn" type="submit" disabled={busy === 'goal'}>{busy === 'goal' ? 'در حال ذخیره…' : 'ذخیرهٔ هدف‌ها'}</button>
        </form>
      </div>

      {user.role === 'admin' && (
        <Link className="card card-interactive row between" to="/admin" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="row"><Icon name="admin" size={20} /> <strong>پنل مدیریت</strong></span>
          <Icon name="forward" size={20} />
        </Link>
      )}

      <section className="card stack" aria-labelledby="account-title">
        <h2 id="account-title" style={{ fontSize: 'var(--text-md)' }}>حساب کاربری</h2>
        <div className="row">
          <button className="btn btn-secondary" type="button" onClick={() => doLogout(false)} disabled={busy === 'logout'}><Icon name="logout" size={18} /> خروج</button>
          <button className="btn btn-secondary" type="button" onClick={() => setDialog('logout-all')}>خروج از همهٔ دستگاه‌ها</button>
          <button className="btn btn-danger" type="button" onClick={() => setDialog('delete')}><Icon name="trash" size={18} /> حذف حساب</button>
        </div>
      </section>

      {dialog === 'logout-all' && (
        <ConfirmDialog title="خروج از همهٔ دستگاه‌ها" confirmLabel="خروج از همه" danger={false} busy={busy === 'logout'} onConfirm={() => doLogout(true)} onClose={closeDialog}>
          <p className="small">نشست شما در همهٔ دستگاه‌ها، از جمله همین دستگاه، پایان می‌یابد و باید دوباره وارد شوید.</p>
        </ConfirmDialog>
      )}
      {dialog === 'delete' && (
        <ConfirmDialog title="حذف حساب" confirmLabel="حذف همیشگی حساب" busy={busy === 'delete'} disabled={confirmText.trim() !== 'حذف'} onConfirm={doDelete} onClose={closeDialog}>
          <Notice tone="error">با حذف حساب، همهٔ وعده‌ها، ژتون‌ها و اطلاعات شما برای همیشه پاک می‌شود و بازگشت‌پذیر نیست.</Notice>
          <div className="field">
            <label htmlFor="confirm-delete">برای تأیید، کلمهٔ «حذف» را بنویسید</label>
            <input id="confirm-delete" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
