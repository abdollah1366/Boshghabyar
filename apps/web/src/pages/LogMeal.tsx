import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { MealType, Suggestion } from '@boshghabyar/core';

import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, Notice, PageHead, Skeleton, SkeletonCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError, api, errorMessage, track } from '../lib/api';
import { MEAL_LABELS, formatDecimal, formatNumber, formatPercent } from '../lib/format';
import { useApi, useDocumentTitle, useFoods } from '../lib/hooks';
import { downscaleToJpeg } from '../lib/image';
import type { RecognitionDetection, RecognitionResponse, RecognitionStatus } from '../lib/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type Scan =
  | { state: 'idle' }
  | { state: 'analyzing'; preview: string }
  | { state: 'result'; preview: string; detection: RecognitionDetection | null; demo: boolean; message?: string }
  | { state: 'error'; message: string; tone: 'warn' | 'error' | 'info'; upgrade?: boolean };

function defaultMealType(): MealType {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date())) % 24;
  if (hour < 10) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function confidenceInfo(value: number): { label: string; cls: string } {
  if (value >= 0.8) return { label: `اطمینان بالا (${formatPercent(value * 100)})`, cls: 'badge-success' };
  if (value >= 0.5) return { label: `اطمینان متوسط (${formatPercent(value * 100)})`, cls: 'badge-warn' };
  return { label: `تشخیص نامطمئن (${formatPercent(value * 100)})`, cls: 'badge-error' };
}

export function LogMeal() {
  useDocumentTitle('ثبت وعده');
  const { refresh } = useAuth();
  const toast = useToast();
  const { foods, loading, error: foodsError, nameOf } = useFoods();
  const status = useApi<RecognitionStatus>('/api/recognize/status');

  const [foodId, setFoodId] = useState('');
  const [grams, setGrams] = useState(150);
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [source, setSource] = useState<'manual' | 'camera'>('manual');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [scan, setScan] = useState<Scan>({ state: 'idle' });
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    track('page.viewed', { page: 'log_meal' });
  }, []);

  useEffect(() => {
    if (!foodId && foods.length > 0) setFoodId(foods[0]!.id);
  }, [foods, foodId]);

  useEffect(
    () => () => {
      if (scan.state === 'analyzing' || scan.state === 'result') URL.revokeObjectURL(scan.preview);
    },
    [scan],
  );

  const filtered = useMemo(() => {
    const term = search.trim();
    if (!term) return foods;
    const list = foods.filter((f) => f.nameFa.includes(term));
    return foodId && !list.some((f) => f.id === foodId) ? [...list, ...foods.filter((f) => f.id === foodId)] : list;
  }, [foods, search, foodId]);

  const selected = foods.find((f) => f.id === foodId);
  const kcal = selected ? Math.round((selected.per100g.kcal * grams) / 100) : 0;
  const protein = selected ? Math.round(((selected.per100g.protein * grams) / 100) * 10) / 10 : 0;

  const pickFood = (id: string, nextGrams?: number, fromCamera = false) => {
    setFoodId(id);
    setSource(fromCamera ? 'camera' : 'manual');
    const food = foods.find((f) => f.id === id);
    if (nextGrams !== undefined) setGrams(nextGrams);
    else if (food && !fromCamera) setGrams(food.serving.grams);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScan({ state: 'error', tone: 'error', message: 'فایل انتخاب‌شده تصویر نیست؛ یک عکس انتخاب کنید.' });
      return;
    }
    let blob: Blob;
    try {
      blob = await downscaleToJpeg(file);
    } catch {
      setScan({ state: 'error', tone: 'error', message: 'تصویر خوانده نشد؛ یک عکس JPEG یا PNG انتخاب کنید.' });
      return;
    }
    const preview = URL.createObjectURL(blob);
    setScan({ state: 'analyzing', preview });
    try {
      const result = await api<RecognitionResponse>('/api/recognize', { method: 'POST', blob, timeoutMs: 45_000 });
      setScan({ state: 'result', preview: URL.createObjectURL(blob), detection: result.detection, demo: result.demo === true, message: result.messageFa });
      status.reload();
    } catch (err) {
      const api503 = err instanceof ApiError && err.status === 503;
      if (err instanceof ApiError && err.status === 429) {
        setScan({ state: 'error', tone: 'warn', upgrade: true, message: 'سهمیهٔ تشخیص با عکس برای امروز تمام شده است. فردا دوباره امتحان کنید یا نسخهٔ حرفه‌ای را فعال کنید؛ ثبت دستی همچنان در دسترس است.' });
      } else if (err instanceof ApiError && err.status === 400) {
        setScan({ state: 'error', tone: 'error', message: 'تصویر نامعتبر است؛ یک عکس واضح JPEG، PNG یا WebP بفرستید.' });
      } else if (api503 && err.manual) {
        setScan({ state: 'error', tone: 'info', message: 'تشخیص خودکار با عکس هنوز فعال نشده است؛ لطفاً غذا را از فهرست پایین انتخاب کنید.' });
      } else {
        setScan({ state: 'error', tone: 'error', message: errorMessage(err) });
      }
    } finally {
      URL.revokeObjectURL(preview);
    }
  };

  const useDetection = (id: string, gramsValue: number) => {
    pickFood(id, Math.max(1, Math.round(gramsValue)), true);
    toast.success(`«${nameOf(id)}» در فرم قرار گرفت؛ مقدار را بررسی و ثبت کنید`);
    document.getElementById('meal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!foodId) return;
    setBusy(true);
    setSuggestions(null);
    try {
      const created = await api<{ id: string; tokensEarned: number; balance: number }>('/api/meals', {
        method: 'POST',
        json: { foodId, grams: Math.round(grams), mealType, source },
      });
      setSaved(`وعده ثبت شد: ${nameOf(foodId)}، ${formatNumber(grams)} گرم و ${formatNumber(kcal)} کیلوکالری`);
      if (created.tokensEarned > 0) toast.token(`+${formatNumber(created.tokensEarned)} ژتون`);
      else toast.success('وعده ثبت شد');
      setSource('manual');
      setScan({ state: 'idle' });
      void refresh();
      try {
        const result = await api<{ suggestions: Suggestion[] }>(`/api/recommendations/${created.id}`);
        setSuggestions(result.suggestions);
      } catch {
        setSuggestions([]);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remaining = status.data ? Math.max(0, status.data.limit - status.data.used) : null;
  const cameraDisabled = status.data?.available === false || scan.state === 'analyzing' || remaining === 0;

  return (
    <>
      <PageHead title="ثبت وعده" subtitle="از غذایتان عکس بگیرید یا آن را از فهرست انتخاب کنید." />

      <section className="card camera-box" aria-labelledby="camera-title">
        <span className="stat-icon" style={{ width: 56, height: 56, borderRadius: 18 }}><Icon name="camera" size={30} /></span>
        <h2 id="camera-title" style={{ fontSize: 'var(--text-md)' }}>تشخیص غذا با عکس</h2>
        <div className="row" style={{ justifyContent: 'center', width: '100%' }}>
          <button className="btn btn-lg" type="button" disabled={cameraDisabled} onClick={() => cameraInput.current?.click()}>
            <Icon name="camera" size={22} /> عکس بگیر
          </button>
          <button className="btn btn-secondary btn-lg" type="button" disabled={cameraDisabled} onClick={() => galleryInput.current?.click()}>
            <Icon name="image" size={22} /> از گالری
          </button>
        </div>
        <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={onFile} tabIndex={-1} aria-label="گرفتن عکس از غذا" />
        <input ref={galleryInput} className="sr-only" type="file" accept="image/*" onChange={onFile} tabIndex={-1} aria-label="انتخاب عکس از گالری" />
        <div className="tiny muted">
          {status.loading && !status.data ? <Skeleton width={160} /> : status.data?.available === false
            ? 'تشخیص با عکس فعلاً در دسترس نیست؛ می‌توانید دستی ثبت کنید.'
            : remaining !== null
              ? `${formatNumber(remaining)} تشخیص از ${formatNumber(status.data!.limit)} تشخیص امروز باقی مانده است.`
              : ''}
        </div>

        {scan.state === 'analyzing' && (
          <div className="stack" style={{ width: '100%' }} role="status" aria-live="polite">
            <img className="camera-preview" src={scan.preview} alt="عکس غذا در حال بررسی" />
            <div className="row" style={{ justifyContent: 'center' }}><span className="spinner" /> در حال تشخیص غذا…</div>
          </div>
        )}
        {scan.state === 'error' && (
          <div className="stack" style={{ width: '100%', textAlign: 'start' }}>
            <Notice tone={scan.tone === 'info' ? 'info' : scan.tone}>{scan.message}</Notice>
            {scan.upgrade && <Link className="btn btn-secondary btn-sm" to="/club" style={{ alignSelf: 'center' }}>فعال‌سازی با ژتون</Link>}
          </div>
        )}
        {scan.state === 'result' && (
          <div className="card stack" style={{ width: '100%', textAlign: 'start' }} aria-live="polite">
            <img className="camera-preview" src={scan.preview} alt="عکس غذای شما" style={{ maxHeight: 160 }} />
            {scan.detection ? (
              <>
                <div className="row between">
                  <h3>{scan.detection.foodNameFa}</h3>
                  <span className={`badge ${confidenceInfo(scan.detection.confidence).cls}`}>{confidenceInfo(scan.detection.confidence).label}</span>
                </div>
                <p className="small muted">مقدار پیشنهادی: {formatNumber(scan.detection.suggestedGrams)} گرم</p>
                {scan.detection.confidence < 0.5 && <Notice tone="error">تشخیص نامطمئن است؛ یکی از گزینه‌های جایگزین را بررسی کنید یا دستی انتخاب کنید.</Notice>}
                <button className="btn btn-block" type="button" onClick={() => useDetection(scan.detection!.foodId, scan.detection!.suggestedGrams)}>
                  <Icon name="check" size={18} /> استفاده از این تشخیص
                </button>
                {scan.detection.alternatives.length > 0 && (
                  <div className="stack-sm">
                    <span className="small muted">یا یکی از این‌ها:</span>
                    <div className="alt-chips">
                      {scan.detection.alternatives.map((alt) => (
                        <button
                          key={alt.foodId}
                          className="chip"
                          type="button"
                          onClick={() => useDetection(alt.foodId, foods.find((f) => f.id === alt.foodId)?.serving.grams ?? scan.detection!.suggestedGrams)}
                        >
                          {alt.foodNameFa} <span className="tiny muted">{formatPercent(alt.confidence * 100)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Notice tone="warn">{scan.message ?? 'غذا شناسایی نشد؛ لطفاً دستی انتخاب کنید.'}</Notice>
            )}
            {scan.demo && <p className="tiny muted">نتیجهٔ آزمایشی: تشخیص واقعی پس از فعال‌سازی سرویس بینایی انجام می‌شود.</p>}
          </div>
        )}
      </section>

      <div className="grid grid-aside">
        <form id="meal-form" className="card card-lg stack" onSubmit={submit}>
          <div className="card-head" style={{ marginBlockEnd: 0 }}>
            <h2 style={{ fontSize: 'var(--text-md)' }}>اطلاعات وعده</h2>
            {source === 'camera' && <span className="badge badge-primary"><Icon name="camera" size={12} /> از روی عکس</span>}
          </div>

          {loading ? (
            <div className="stack"><Skeleton height={46} radius={12} /><Skeleton height={46} radius={12} /><Skeleton height={46} radius={12} /></div>
          ) : foodsError ? (
            <ErrorState message={foodsError} />
          ) : foods.length === 0 ? (
            <EmptyState text="فهرست غذاها خالی است." />
          ) : (
            <>
              <div className="field">
                <label htmlFor="food-search">جستجوی غذا</label>
                <input id="food-search" className="input" type="search" placeholder="مثلاً قورمه‌سبزی" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="food">غذا</label>
                <select id="food" className="select" value={foodId} onChange={(e) => pickFood(e.target.value)} required>
                  {filtered.map((food) => <option key={food.id} value={food.id}>{food.nameFa}</option>)}
                </select>
                {filtered.length === 0 && <span className="field-hint">غذایی با این نام پیدا نشد.</span>}
              </div>

              {selected && (
                <div className="notice">
                  <Icon name="info" size={18} />
                  <div className="notice-body small">
                    سهم معمول: {formatNumber(selected.serving.grams)} گرم ({selected.serving.labelFa})
                    <div className="tiny muted">هر ۱۰۰ گرم: {formatNumber(selected.per100g.kcal)} کیلوکالری و {formatDecimal(selected.per100g.protein)} گرم پروتئین</div>
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="grams">مقدار (گرم)</label>
                <input
                  id="grams"
                  className="input input-lg num"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={3000}
                  value={grams}
                  onChange={(e) => setGrams(Math.max(0, Math.min(3000, Number(e.target.value) || 0)))}
                  required
                />
                <div className="row">
                  <button className="chip" type="button" onClick={() => setGrams(100)}>۱۰۰ گرم</button>
                  {selected && <button className="chip" type="button" onClick={() => setGrams(selected.serving.grams)}>یک سهم</button>}
                  {selected && <button className="chip" type="button" onClick={() => setGrams(selected.serving.grams * 2)}>دو سهم</button>}
                </div>
                <span className="field-hint">حدود {formatNumber(kcal)} کیلوکالری و {formatDecimal(protein)} گرم پروتئین</span>
              </div>

              <div className="field">
                <span className="label" id="meal-type-label">نوع وعده</span>
                <div className="segmented" role="group" aria-labelledby="meal-type-label">
                  {MEAL_TYPES.map((type) => (
                    <button key={type} type="button" aria-pressed={mealType === type} onClick={() => setMealType(type)}>{MEAL_LABELS[type]}</button>
                  ))}
                </div>
              </div>

              <button className="btn btn-lg btn-block" type="submit" disabled={busy || !foodId || grams < 1}>
                <Icon name="plus" size={20} /> {busy ? 'در حال ثبت…' : 'ثبت وعده'}
              </button>
            </>
          )}
        </form>

        <div className="stack">
          {saved && <Notice tone="success">{saved}</Notice>}
          {saved && suggestions === null && <SkeletonCard lines={2} height={60} />}
          {suggestions && (
            <section className="card stack" aria-labelledby="alt-title">
              <h2 id="alt-title" style={{ fontSize: 'var(--text-md)' }}>پیشنهاد جایگزین</h2>
              {suggestions.length === 0 ? (
                <p className="small muted">برای این وعده جایگزین بهتری پیدا نشد.</p>
              ) : (
                <ul className="list">
                  {suggestions.map((s, index) => (
                    <li key={`${s.toFoodId}-${index}`}>
                      <div>
                        <strong>{s.titleFa}</strong>
                        <p className="small muted">{s.reasonFa}</p>
                      </div>
                      <span className={`badge ${s.kind === 'cheaper' ? 'badge-success' : 'badge-primary'}`}>
                        {s.kind === 'cheaper' ? 'ارزان‌تر' : s.kind === 'higher-protein' ? 'پروتئین بیشتر' : s.kind === 'lower-calorie' ? 'کم‌کالری‌تر' : 'متعادل‌تر'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="tiny faint">اعداد را موتور محاسبهٔ بشقاب‌یار تعیین می‌کند.</p>
            </section>
          )}
          {!saved && (
            <div className="card empty">
              <span className="empty-art"><Icon name="spark" size={30} /></span>
              <p>پس از ثبت وعده، پیشنهادهای متعادل و اقتصادی اینجا نمایش داده می‌شود.</p>
            </div>
          )}
          {saved && <Link className="btn btn-secondary" to="/">بازگشت به خانه</Link>}
        </div>
      </div>
    </>
  );
}
