import { useEffect, useState } from 'react';
import type { Food, MealEntry, Suggestion } from '@boshghabyar/core';

import { EmptyState, Notice, SectionTitle } from '../components/ui';
import { api, track } from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';

interface MealsResponse { meals: MealEntry[]; foods: Food[] }
type SuggestionWithPrompt = Suggestion & { prompt: string | null };
interface SuggestionsResponse { suggestions: SuggestionWithPrompt[]; deterministic: boolean }

export function Suggestions() {
  const [data, setData] = useState<MealsResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestionsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'suggestions' });
    void api<MealsResponse>('/api/meals').then(setData).catch((err: Error) => setError(err.message));
  }, []);

  const load = async (mealId: string) => {
    setSelected(mealId);
    setResult(null);
    try {
      setResult(await api<SuggestionsResponse>(`/api/recommendations/${mealId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت پیشنهادها');
    }
  };

  const nameOf = (id: string) => data?.foods.find((f) => f.id === id)?.nameFa ?? id;

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>پیشنهادها</h1>
          <p className="small muted">برای هر وعده ثبتشده، جایگزینی متناسب با هدف و بودجه بیابید.</p>
        </div>
      </div>

      {error && <Notice warn>{error}</Notice>}
      {!data ? <p className="muted">در حال بارگذاری…</p> : data.meals.length === 0 ? (
        <EmptyState text="ابتدا یک وعده ثبت کنید تا پیشنهادی برای آن ساخته شود." />
      ) : (
        <div className="grid grid-2">
          <div className="card">
            <SectionTitle title="وعدههای ثبتشده" />
            <ul className="list">
              {data.meals.map((meal) => (
                <li className="list-item" key={meal.id}>
                  <div>
                    <strong>{nameOf(meal.foodId)}</strong>
                    <div className="tiny muted">{formatDate(meal.date)} · {formatNumber(meal.grams)} گرم</div>
                  </div>
                  <button className={`btn ${selected === meal.id ? '' : 'btn-secondary'} btn-sm`} type="button" onClick={() => load(meal.id)}>
                    پیشنهادها
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card stack">
            <SectionTitle title="نتیجه" />
            {!result && <p className="small muted">یک وعده را انتخاب کنید.</p>}
            {result && result.suggestions.length === 0 && <p className="small muted">جایگزین مناسبی پیدا نشد.</p>}
            {result?.suggestions.map((s, i) => (
              <div className="list-item" key={`${s.toFoodId}-${i}`}>
                <div>
                  <strong>{s.titleFa}</strong>
                  <p className="small muted">{s.reasonFa}</p>
                  {s.prompt && <details className="tiny muted"><summary>پرامپت توضیح هوشمند</summary>{s.prompt}</details>}
                </div>
              </div>
            ))}
            {result && <p className="tiny muted">محاسبات عددی توسط موتور بشقاب‌یار انجام شده و قطعی است.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
