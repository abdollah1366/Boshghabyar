import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MealEntry, Suggestion } from '@boshghabyar/core';

import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, Notice, PageHead, SkeletonCard } from '../components/ui';
import { api, errorMessage, track } from '../lib/api';
import { MEAL_LABELS, formatDate, formatIRR, formatNumber } from '../lib/format';
import { useApi, useDocumentTitle, useFoods } from '../lib/hooks';

interface MealsResponse { meals: MealEntry[]; historyLimited: boolean }
type SuggestionWithPrompt = Suggestion & { prompt: string | null };
interface SuggestionsResponse { suggestions: SuggestionWithPrompt[]; deterministic: boolean }

const KIND_LABELS: Record<string, string> = {
  cheaper: 'ارزان‌تر',
  balanced: 'متعادل‌تر',
  'lower-calorie': 'کم‌کالری‌تر',
  'higher-protein': 'پروتئین بیشتر',
};

export function Suggestions() {
  useDocumentTitle('پیشنهادها');
  const meals = useApi<MealsResponse>('/api/meals');
  const { nameOf } = useFoods();
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'suggestions' });
  }, []);

  const load = async (mealId: string) => {
    setSelected(mealId);
    setResult(null);
    setError('');
    setLoading(true);
    try {
      setResult(await api<SuggestionsResponse>(`/api/recommendations/${mealId}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const list = meals.data?.meals ?? [];

  return (
    <>
      <PageHead title="پیشنهادها" subtitle="برای هر وعدهٔ ثبت‌شده، جایگزینی متناسب با هدف و بودجه‌تان ببینید." />

      {meals.loading && !meals.data ? (
        <div className="grid grid-2"><SkeletonCard lines={4} height={40} /><SkeletonCard lines={2} height={80} /></div>
      ) : meals.error ? (
        <ErrorState message={meals.error} onRetry={meals.reload} />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState icon="spark" title="هنوز وعده‌ای ندارید" text="ابتدا یک وعده ثبت کنید تا برایش پیشنهاد جایگزین بسازیم." action={<Link className="btn" to="/log">ثبت وعده</Link>} />
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <section className="card" aria-labelledby="meals-title">
            <div className="card-head"><h2 id="meals-title">وعده‌های ثبت‌شده</h2></div>
            <ul className="list">
              {list.slice(0, 30).map((meal) => (
                <li key={meal.id}>
                  <div className="grow">
                    <strong className="truncate" style={{ display: 'block' }}>{nameOf(meal.foodId)}</strong>
                    <span className="tiny muted">{formatDate(meal.date)} · {MEAL_LABELS[meal.mealType] ?? meal.mealType} · {formatNumber(meal.grams)} گرم</span>
                  </div>
                  <button className={`btn btn-sm ${selected === meal.id ? '' : 'btn-secondary'}`} type="button" onClick={() => load(meal.id)} aria-pressed={selected === meal.id}>
                    پیشنهاد
                  </button>
                </li>
              ))}
            </ul>
            {meals.data?.historyLimited && <p className="tiny faint" style={{ marginBlockStart: 12 }}>در نسخهٔ رایگان فقط وعده‌های هفتهٔ اخیر نمایش داده می‌شود.</p>}
          </section>

          <section className="card stack" aria-labelledby="result-title" aria-live="polite">
            <div className="card-head" style={{ marginBlockEnd: 0 }}><h2 id="result-title">جایگزین‌ها</h2></div>
            {!selected && <EmptyState icon="spark" text="یک وعده را انتخاب کنید تا جایگزین‌های مناسب را ببینید." />}
            {loading && <div className="stack"><div className="skeleton" style={{ height: 64 }} /><div className="skeleton" style={{ height: 64 }} /></div>}
            {error && <Notice tone="error">{error}</Notice>}
            {result && result.suggestions.length === 0 && <EmptyState icon="check" text="این انتخاب از قبل مناسب است؛ جایگزین بهتری پیدا نشد." />}
            {result?.suggestions.map((s, i) => (
              <div className="card" key={`${s.toFoodId}-${i}`} style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
                <div className="row between">
                  <strong>{s.titleFa}</strong>
                  <span className="badge badge-primary">{KIND_LABELS[s.kind] ?? 'پیشنهاد'}</span>
                </div>
                <p className="small muted">{s.reasonFa}</p>
                <p className="tiny faint row">
                  <Icon name="chart" size={14} />
                  {s.delta.kcal !== 0 && `${formatNumber(Math.abs(s.delta.kcal))} کیلوکالری ${s.delta.kcal < 0 ? 'کمتر' : 'بیشتر'}`}
                  {s.delta.priceIRR !== 0 && ` · ${formatIRR(Math.abs(s.delta.priceIRR))} ${s.delta.priceIRR < 0 ? 'ارزان‌تر' : 'گران‌تر'}`}
                </p>
                {s.prompt && <details className="tiny muted"><summary>متن توضیح هوشمند</summary>{s.prompt}</details>}
              </div>
            ))}
            {result && <p className="tiny faint">محاسبات عددی را موتور بشقاب‌یار انجام داده و قطعی است.</p>}
          </section>
        </div>
      )}
    </>
  );
}
