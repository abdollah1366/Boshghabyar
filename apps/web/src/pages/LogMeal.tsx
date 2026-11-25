import { useEffect, useState } from 'react';
import type { Food, MealType, Suggestion } from '@boshghabyar/core';

import { Icon } from '../components/Icon';
import { Notice, SectionTitle } from '../components/ui';
import { api, track } from '../lib/api';
import { formatNumber } from '../lib/format';

interface FoodsResponse { foods: Food[]; plan: string }
interface SuggestionsResponse { suggestions: Suggestion[] }

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'صبحانه' },
  { value: 'lunch', label: 'ناهار' },
  { value: 'dinner', label: 'شام' },
  { value: 'snack', label: 'میانوعده' },
];

export function LogMeal() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodId, setFoodId] = useState('');
  const [grams, setGrams] = useState(150);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    track('page.viewed', { page: 'log_meal' });
    void api<FoodsResponse>('/api/foods').then((res) => {
      setFoods(res.foods);
      setFoodId(res.foods[0]?.id ?? '');
    }).catch((err: Error) => setError(err.message));
  }, []);

  const selected = foods.find((f) => f.id === foodId);
  const kcal = selected ? Math.round((selected.per100g.kcal * grams) / 100) : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuggestions(null);
    try {
      const created = await api<{ id: string }>('/api/meals', {
        method: 'POST',
        body: JSON.stringify({ foodId, grams, mealType, date }),
      });
      setSaved(`وعده ثبت شد (${formatNumber(grams)} گرم، ${formatNumber(kcal)} کیلوکالوری)`);
      const result = await api<SuggestionsResponse>(`/api/recommendations/${created.id}`);
      setSuggestions(result.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت وعده');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>ثبت وعده</h1>
          <p className="small muted">غذا، اندازه سهم و نوع وعده را انتخاب کنید.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <form className="card stack" onSubmit={submit}>
          <SectionTitle title="اطلاعات وعده" />
          <div className="field">
            <label htmlFor="food">غذا</label>
            <select id="food" className="select" value={foodId} onChange={(e) => setFoodId(e.target.value)} required>
              {foods.map((food) => <option key={food.id} value={food.id}>{food.nameFa}</option>)}
            </select>
          </div>

          {selected && (
            <div className="notice small">
              <strong>{selected.nameFa}</strong> · سهم معمولی {formatNumber(selected.serving.grams)} گرم ({selected.serving.labelFa})
              <div className="tiny muted">به ازای ۱۰۰ گرم: {formatNumber(selected.per100g.kcal)} کیلوکالوری · {selected.per100g.protein} گرم پروتئین</div>
            </div>
          )}

          <div className="field">
            <label htmlFor="grams">وزن (گرم) — حدود {formatNumber(kcal)} کیلوکالوری</label>
            <input id="grams" className="input" type="number" min={1} max={3000} value={grams} onChange={(e) => setGrams(Number(e.target.value))} required />
            <div className="row">
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setGrams(100)}>۱۰۰ گرم</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => selected && setGrams(selected.serving.grams)}>سهم معمولی</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setGrams(200)}>۲۰۰ گرم</button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="meal-type">نوع وعده</label>
            <select id="meal-type" className="select" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              {MEAL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="date">تاریخ</label>
            <input id="date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required dir="ltr" />
          </div>

          {error && <Notice warn>{error}</Notice>}
          <button className="btn btn-block" type="submit" disabled={busy || !foodId}>
            <Icon name="plus" size={18} /> {busy ? 'در حال ثبت…' : 'ثبت وعده'}
          </button>
        </form>

        <div className="stack">
          {saved && <Notice><strong>{saved}</strong></Notice>}
          {suggestions && (
            <div className="card stack">
              <SectionTitle title="پیشنهادهای جایگزین" />
              {suggestions.length === 0 ? (
                <p className="small muted">برای این وعده جایگزین مناسبی یافت نشد.</p>
              ) : (
                suggestions.map((s, index) => (
                  <div className="list-item" key={`${s.toFoodId}-${index}`}>
                    <div>
                      <strong>{s.titleFa}</strong>
                      <p className="small muted">{s.reasonFa}</p>
                    </div>
                    <span className={`badge ${s.delta.priceIRR < 0 ? 'badge-success' : ''}`}>
                      {s.kind === 'cheaper' ? 'اقتصادیتر' : s.kind === 'higher-protein' ? 'پروتئینبیشتر' : s.kind === 'lower-calorie' ? 'کالریکمتر' : 'متعادلتر'}
                    </span>
                  </div>
                ))
              )}
              <p className="tiny muted">اعداد توسط موتور محاسبه بشقاب‌یار بهدست آمدهاند.</p>
            </div>
          )}
          {!suggestions && !saved && (
            <div className="card center muted small">پس از ثبت وعده، پیشنهادهای متعادل و اقتصادی اینجا نمایش داده میشود.</div>
          )}
        </div>
      </div>
    </div>
  );
}
