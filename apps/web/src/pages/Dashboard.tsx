import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DaySummary, Food, MealEntry } from '@boshghabyar/core';

import { Icon } from '../components/Icon';
import { EmptyState, Notice, Progress, SectionTitle, StatCard } from '../components/ui';
import { api, track } from '../lib/api';
import { formatDate, formatIRR, formatNumber } from '../lib/format';

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میانوعده',
};

interface DailyResponse { report: DaySummary; meals: MealEntry[] }
interface MealsResponse { meals: MealEntry[]; foods: Food[] }

export function Dashboard() {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [meals, setMeals] = useState<MealsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'dashboard' });
    void Promise.all([
      api<DailyResponse>('/api/reports/daily'),
      api<MealsResponse>('/api/meals'),
    ]).then(([daily, all]) => {
      setData(daily);
      setMeals(all);
    }).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <Notice warn>{error}</Notice>;
  if (!data || !meals) return <p className="muted">در حال بارگذاری…</p>;

  const { report } = data;
  const foodName = (id: string) => meals.foods.find((f) => f.id === id)?.nameFa ?? id;
  const status = report.status === 'over'
    ? { label: 'بیش از هدف روزانه', cls: 'badge-error' }
    : report.status === 'below'
      ? { label: 'کمتر از هدف', cls: 'badge-warn' }
      : { label: 'متعادل', cls: 'badge-success' };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>سلام، امروز چطور است؟</h1>
          <p className="small muted">{formatDate(report.date)} · خلاصه وعدههای ثبتشده</p>
        </div>
        <Link className="btn" to="/log"><Icon name="plus" size={18} /> ثبت وعده</Link>
      </div>

      <div className="grid grid-4">
        <StatCard label="کالری" value={formatNumber(report.totals.kcal)} hint={`هدف ${formatNumber(report.goal.calorieTarget)}`} />
        <StatCard label="پروتئین" value={`${formatNumber(report.totals.protein)} گرم`} hint={`هدف ${formatNumber(report.goal.proteinTarget)} گرم`} />
        <StatCard label="هزینه امروز" value={formatIRR(report.ratio.budget * report.goal.dailyBudgetIRR)} hint={`بودجه ${formatIRR(report.goal.dailyBudgetIRR)}`} />
        <StatCard label="تعداد وعده" value={formatNumber(report.entryCount)} hint={<span className={`badge ${status.cls}`}>{status.label}</span>} />
      </div>

      <div className="card stack">
        <SectionTitle title="پیشرفت اهداف" />
        <Progress label="کالری" value={report.totals.kcal} target={report.goal.calorieTarget} unit=" کیلوکالوری" />
        <Progress label="پروتئین" value={report.totals.protein} target={report.goal.proteinTarget} unit=" گرم" />
        <Progress label="کربوهیدرات" value={report.totals.carbs} target={report.goal.carbsTarget} unit=" گرم" />
        <Progress label="چربی" value={report.totals.fat} target={report.goal.fatTarget} unit=" گرم" />
        <Progress label="فیبر" value={report.totals.fiber} target={report.goal.fiberTarget} unit=" گرم" />
        <Progress label="بودجه" value={Math.round(report.ratio.budget * report.goal.dailyBudgetIRR)} target={report.goal.dailyBudgetIRR} />
      </div>

      <div className="card">
        <SectionTitle title="وعدههای اخیر" action={<Link className="small" to="/suggestions">مشاهده پیشنهادها</Link>} />
        {data.meals.length === 0 ? (
          <EmptyState
            text="هنوز وعدهای ثبت نکردهاید."
            action={<Link className="btn btn-sm" to="/log">ثبت نخستین وعده</Link>}
          />
        ) : (
          <ul className="list">
            {data.meals.slice(0, 5).map((meal) => (
              <li className="list-item" key={meal.id}>
                <div>
                  <strong>{foodName(meal.foodId)}</strong>
                  <div className="tiny muted">{MEAL_LABELS[meal.mealType] ?? meal.mealType} · {formatNumber(meal.grams)} گرم</div>
                </div>
                <Link className="small" to="/suggestions">پیشنهادها</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
