import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DaySummary, MealEntry } from '@boshghabyar/core';

import { Coin, Icon } from '../components/Icon';
import { ConfirmDialog, EmptyState, ErrorState, PageHead, PageSkeleton, Progress, Ring } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { MEAL_LABELS, formatIRR, formatLongDate, formatNumber } from '../lib/format';
import { useApi, useDocumentTitle, useFoods } from '../lib/hooks';
import type { ClubState } from '../lib/types';

interface DailyResponse { report: DaySummary; meals: MealEntry[] }
interface CheckinResponse { awarded: number; alreadyDone: boolean; streak: number; bonus: number; balance: number }

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date())) % 24;
  if (hour < 5) return 'شب بخیر';
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  if (hour < 21) return 'عصر بخیر';
  return 'شب بخیر';
}

export function Dashboard() {
  useDocumentTitle('خانه');
  const { user, refresh } = useAuth();
  const toast = useToast();
  const daily = useApi<DailyResponse>('/api/reports/daily');
  const club = useApi<ClubState>('/api/club');
  const { nameOf } = useFoods();
  const [deleting, setDeleting] = useState<MealEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const checkin = async () => {
    setCheckingIn(true);
    try {
      const result = await api<CheckinResponse>('/api/club/checkin', { method: 'POST' });
      if (result.alreadyDone) toast.success('ورود امروز شما قبلاً ثبت شده است');
      else toast.token(`+${formatNumber(result.awarded)} ژتون${result.bonus ? ' (با پاداش ورود پیاپی)' : ''}`);
      club.reload();
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCheckingIn(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/meals/${deleting.id}`, { method: 'DELETE' });
      toast.success('وعده حذف شد');
      setDeleting(null);
      daily.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (daily.loading && !daily.data) return <PageSkeleton />;
  if (daily.error && !daily.data) return <ErrorState message={daily.error} onRetry={daily.reload} />;
  if (!daily.data) return null;

  const { report, meals } = daily.data;
  const spent = report.ratio.budget * report.goal.dailyBudgetIRR;
  const kcalLeft = report.remaining.kcal;
  const status = report.status === 'over'
    ? { label: 'بیش از هدف روزانه', cls: 'badge-error' }
    : report.status === 'below'
      ? { label: 'کمتر از هدف', cls: 'badge-warn' }
      : { label: 'متعادل', cls: 'badge-success' };
  const checkedIn = club.data?.checkedInToday ?? false;
  const streak = club.data?.streak ?? 0;

  return (
    <>
      <PageHead
        title={`${greeting()}، ${user?.name ?? ''}`}
        subtitle={formatLongDate(report.date)}
        actions={<Link className="btn" to="/log"><Icon name="plus" size={18} /> ثبت وعده</Link>}
      />

      <div className="grid grid-aside">
        <section className="card card-lg stack" aria-labelledby="today-title">
          <div className="card-head" style={{ marginBlockEnd: 0 }}>
            <h2 id="today-title">امروز چقدر خورده‌اید؟</h2>
            <span className={`badge ${report.entryCount === 0 ? '' : status.cls}`}>{report.entryCount === 0 ? 'بدون ثبت' : status.label}</span>
          </div>
          <div className="row" style={{ gap: 'var(--space-4)', justifyContent: 'center', alignItems: 'center' }}>
            <Ring value={report.ratio.kcal} size={150} stroke={13} color={report.ratio.kcal > 1.15 ? 'var(--accent)' : undefined} label={`کالری امروز ${formatNumber(report.totals.kcal)} از ${formatNumber(report.goal.calorieTarget)}`}>
              <strong style={{ fontSize: '1.6rem' }} className="num">{formatNumber(report.totals.kcal)}</strong>
              <span className="tiny muted">از {formatNumber(report.goal.calorieTarget)} کیلوکالری</span>
            </Ring>
            <div className="stack-sm grow" style={{ minWidth: 190 }}>
              <Progress label="پروتئین" value={report.totals.protein} target={report.goal.proteinTarget} unit=" گرم" tone="good" />
              <Progress label="کربوهیدرات" value={report.totals.carbs} target={report.goal.carbsTarget} unit=" گرم" />
              <Progress label="چربی" value={report.totals.fat} target={report.goal.fatTarget} unit=" گرم" />
            </div>
          </div>
          <p className="small muted center">
            {kcalLeft >= 0
              ? `${formatNumber(kcalLeft)} کیلوکالری تا هدف امروز باقی مانده است.`
              : `${formatNumber(-kcalLeft)} کیلوکالری از هدف امروز بیشتر شده است.`}
          </p>
          <Progress label="بودجهٔ امروز" value={Math.round(spent)} target={report.goal.dailyBudgetIRR} unit=" تومان" />
          <p className="tiny faint">{formatIRR(spent)} از {formatIRR(report.goal.dailyBudgetIRR)}</p>
        </section>

        <aside className="stack" aria-label="دسترسی سریع">
          <div className="card stack">
            <h2 style={{ fontSize: 'var(--text-md)' }}>دسترسی سریع</h2>
            <Link className="btn btn-block" to="/log"><Icon name="plus" size={18} /> ثبت وعدهٔ جدید</Link>
            <Link className="btn btn-secondary btn-block" to="/log"><Icon name="camera" size={18} /> تشخیص غذا با عکس</Link>
            <button className="btn btn-secondary btn-block" type="button" onClick={checkin} disabled={checkingIn || checkedIn}>
              <Icon name="gift" size={18} />
              {checkedIn ? 'ورود امروز ثبت شد' : 'ورود روزانه و ژتون هدیه'}
            </button>
            {streak > 0 && (
              <p className="small row" style={{ justifyContent: 'center' }}>
                <span className="streak"><Icon name="flame" size={18} /> {formatNumber(streak)} روز پیاپی</span>
              </p>
            )}
          </div>
          <Link className="card card-hero card-interactive row between" to="/club" style={{ textDecoration: 'none', color: '#fff' }}>
            <div>
              <p className="small muted">ژتون شما</p>
              <p className="stat-value num">{formatNumber(user?.tokenBalance ?? 0)}</p>
              <p className="tiny" style={{ color: 'rgb(255 255 255 / 80%)' }}>سطح {user?.level.labelFa}</p>
            </div>
            <Coin size={52} />
          </Link>
        </aside>
      </div>

      <section className="card" aria-labelledby="recent-title">
        <div className="card-head">
          <h2 id="recent-title">وعده‌های امروز</h2>
          <Link className="small" to="/suggestions">پیشنهادهای جایگزین</Link>
        </div>
        {meals.length === 0 ? (
          <EmptyState
            icon="bowl"
            title="هنوز وعده‌ای ثبت نکرده‌اید"
            text="نخستین وعدهٔ امروز را ثبت کنید یا از غذایتان عکس بگیرید تا کالری و پروتئین آن را ببینید."
            action={<div className="row" style={{ justifyContent: 'center' }}><Link className="btn" to="/log">ثبت نخستین وعده</Link></div>}
          />
        ) : (
          <ul className="list">
            {meals.map((meal) => (
              <li key={meal.id}>
                <div className="row row-nowrap grow">
                  <span className="meal-dot"><Icon name="plate" size={20} /></span>
                  <div className="grow">
                    <strong className="truncate" style={{ display: 'block' }}>{nameOf(meal.foodId)}</strong>
                    <span className="tiny muted">{MEAL_LABELS[meal.mealType] ?? meal.mealType} · {formatNumber(meal.grams)} گرم</span>
                  </div>
                </div>
                <button className="icon-btn" type="button" aria-label={`حذف ${nameOf(meal.foodId)}`} onClick={() => setDeleting(meal)}>
                  <Icon name="trash" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleting && (
        <ConfirmDialog title="حذف وعده" confirmLabel="حذف" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>«{nameOf(deleting.foodId)}» ({formatNumber(deleting.grams)} گرم) از وعده‌های امروز حذف شود؟</p>
        </ConfirmDialog>
      )}
    </>
  );
}
