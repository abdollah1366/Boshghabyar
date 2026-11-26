import { useState } from 'react';
import type { FormEvent } from 'react';

import { Icon } from '../components/Icon';
import { EmptyState, Notice, Skeleton, StatCard } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api, downloadFile, errorMessage, query } from '../lib/api';
import { CATEGORY_LABELS, GOAL_LABELS, formatDecimal, formatNumber, formatPercent, weekdayFa } from '../lib/format';

interface Stats { n: number; mean: number | null; median: number | null; p25: number | null; p75: number | null; min: number | null; max: number | null }
type Group =
  | { key: string | number; suppressed: true; users: number }
  | { key: string | number; suppressed: false; users: number; meals: number; kcal: Stats; protein: Stats; grams: Stats };

interface Summary {
  scope: 'consented' | 'all';
  from: string | null;
  to: string | null;
  minGroup: number;
  users: number;
  meals: number;
  kcal: Stats;
  protein: Stats;
  fiber: Stats;
  priceIRR: Stats;
  cameraShare: number;
  byMealType: Group[];
  byGoalType: Group[];
  byCategory: Group[];
  byWeekday: Group[];
  byFood: Group[];
}

interface Filters { from: string; to: string; scope: 'consented' | 'all'; minGroup: number; anonymize: boolean; reason: string }

const num = (value: number | null | undefined): string => (value === null || value === undefined ? '—' : formatDecimal(value));

function GroupTable({ title, groups, label, minGroup }: { title: string; groups: Group[]; label: (key: string | number) => string; minGroup: number }) {
  return (
    <section className="card stack" aria-label={title}>
      <h3>{title}</h3>
      {groups.length === 0 ? <p className="small muted">دادهای وجود ندارد.</p> : (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 480 }}>
            <thead>
              <tr><th>گروه</th><th className="num-cell">کاربر</th><th className="num-cell">وعده</th><th className="num-cell">کالری (میانه)</th><th className="num-cell">کالری (میانگین)</th><th className="num-cell">پروتئین (میانگین)</th></tr>
            </thead>
            <tbody>
              {groups.map((g) => g.suppressed ? (
                <tr key={String(g.key)}>
                  <td>{label(g.key)}</td>
                  <td colSpan={5} className="muted small">پنهان‌شده (کمتر از {formatNumber(minGroup)} کاربر)</td>
                </tr>
              ) : (
                <tr key={String(g.key)}>
                  <td>{label(g.key)}</td>
                  <td className="num-cell">{formatNumber(g.users)}</td>
                  <td className="num-cell">{formatNumber(g.meals)}</td>
                  <td className="num-cell">{num(g.kcal.median)}</td>
                  <td className="num-cell">{num(g.kcal.mean)}</td>
                  <td className="num-cell">{num(g.protein.mean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AdminResearch() {
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>({ from: '', to: '', scope: 'consented', minGroup: 3, anonymize: true, reason: '' });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const needsReason = filters.scope === 'all' || !filters.anonymize;
  const reasonOk = filters.reason.trim().length >= 10;
  const summaryNeedsReason = filters.scope === 'all';

  const params = (format?: 'csv' | 'json') => query({
    from: filters.from,
    to: filters.to,
    scope: filters.scope,
    minGroup: filters.minGroup,
    anonymize: format ? String(filters.anonymize) : undefined,
    format,
    reason: (format ? needsReason : summaryNeedsReason) ? filters.reason.trim() : undefined,
  });

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    if (summaryNeedsReason && !reasonOk) {
      setError('برای دسترسی به داده‌های همهٔ کاربران، «دلیل استفاده» را (دست‌کم ۱۰ نویسه) بنویسید.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSummary(await api<Summary>(`/api/admin/research/summary${params()}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const doExport = async (format: 'csv' | 'json') => {
    if (needsReason && !reasonOk) {
      setError('«دلیل استفاده» را (دست‌کم ۱۰ نویسه) بنویسید؛ این دسترسی ممیزی می‌شود.');
      return;
    }
    setError('');
    setExporting(format);
    try {
      await downloadFile(`/api/admin/research/export${params(format)}`, `boshghabyar-research.${format}`);
      toast.success('فایل آمادهٔ دانلود شد؛ دسترسی شما ثبت شد');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting('');
    }
  };

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="stack">
      <Notice tone="warn" icon="shield">
        <strong>هر دسترسی به داده‌های پژوهشی ثبت و ممیزی می‌شود.</strong>{' '}
        به‌صورت پیش‌فرض فقط داده‌های ناشناسِ کاربران موافق با پژوهش نمایش داده می‌شود.
      </Notice>

      <form className="card stack" onSubmit={load}>
        <div className="filters">
          <div className="field"><label htmlFor="rs-from">از تاریخ</label><input id="rs-from" className="input ltr" type="date" dir="ltr" value={filters.from} onChange={(e) => set('from', e.target.value)} /></div>
          <div className="field"><label htmlFor="rs-to">تا تاریخ</label><input id="rs-to" className="input ltr" type="date" dir="ltr" value={filters.to} onChange={(e) => set('to', e.target.value)} /></div>
          <div className="field">
            <label htmlFor="rs-scope">دامنهٔ کاربران</label>
            <select id="rs-scope" className="select" value={filters.scope} onChange={(e) => set('scope', e.target.value as Filters['scope'])}>
              <option value="consented">فقط موافقان پژوهش</option>
              <option value="all">همهٔ کاربران (نیازمند دلیل)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rs-min">حداقل کاربر در هر گروه</label>
            <input id="rs-min" className="input ltr" type="number" dir="ltr" min={1} max={100} value={filters.minGroup} onChange={(e) => set('minGroup', Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>

        <label className="check">
          <input type="checkbox" checked={filters.anonymize} onChange={(e) => set('anonymize', e.target.checked)} />
          <span>ناشناس‌سازی خروجی (پیشنهادی)<span className="tiny muted" style={{ display: 'block' }}>با خاموش‌کردن آن، شناسهٔ کاربر در فایل خروجی می‌آید.</span></span>
        </label>

        {(needsReason || summaryNeedsReason) && (
          <div className="stack-sm">
            <Notice tone="accent" icon="alert">این درخواست داده‌های حساس را باز می‌کند. دلیل شما همراه نام شما در گزارش دسترسی ذخیره می‌شود.</Notice>
            <div className="field">
              <label htmlFor="rs-reason">دلیل استفاده (دست‌کم ۱۰ نویسه)</label>
              <textarea id="rs-reason" className="textarea" maxLength={300} value={filters.reason} onChange={(e) => set('reason', e.target.value)} aria-invalid={!reasonOk} aria-describedby="rs-reason-hint" />
              <span id="rs-reason-hint" className="field-hint">{formatNumber(filters.reason.trim().length)} از ۳۰۰ نویسه{!reasonOk && ' — هنوز کوتاه است'}</span>
            </div>
          </div>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="row">
          <button className="btn" type="submit" disabled={loading}>{loading ? 'در حال بارگذاری…' : 'نمایش خلاصه'}</button>
          <button className="btn btn-secondary" type="button" disabled={exporting !== ''} onClick={() => doExport('csv')}><Icon name="download" size={16} /> خروجی CSV</button>
          <button className="btn btn-secondary" type="button" disabled={exporting !== ''} onClick={() => doExport('json')}><Icon name="download" size={16} /> خروجی JSON</button>
        </div>
      </form>

      {loading && !summary && <div className="stack"><Skeleton height={90} radius={14} /><Skeleton height={160} radius={14} /></div>}
      {!summary && !loading && !error && <div className="card"><EmptyState icon="chart" text="فیلترها را تنظیم کنید و «نمایش خلاصه» را بزنید." /></div>}

      {summary && (
        <div className="stack" style={loading ? { opacity: 0.6 } : undefined}>
          <div className="grid grid-4">
            <StatCard label="کاربران در نمونه" value={formatNumber(summary.users)} hint={summary.scope === 'all' ? 'همهٔ کاربران' : 'موافقان پژوهش'} />
            <StatCard label="وعده‌ها" value={formatNumber(summary.meals)} hint={`سهم ثبت با عکس: ${formatPercent(summary.cameraShare)}`} />
            <StatCard label="کالری (میانه)" value={num(summary.kcal.median)} hint={`میانگین ${num(summary.kcal.mean)}`} />
            <StatCard label="پروتئین (میانگین)" value={num(summary.protein.mean)} hint="گرم در هر وعده" />
          </div>
          {summary.meals === 0 && <Notice>در این بازه و دامنه، وعده‌ای پیدا نشد.</Notice>}
          <GroupTable title="به تفکیک نوع وعده" groups={summary.byMealType} label={(k) => String(k)} minGroup={summary.minGroup} />
          <GroupTable title="به تفکیک نوع هدف" groups={summary.byGoalType} label={(k) => GOAL_LABELS[String(k)] ?? String(k)} minGroup={summary.minGroup} />
          <GroupTable title="به تفکیک دستهٔ غذا" groups={summary.byCategory} label={(k) => CATEGORY_LABELS[String(k)] ?? String(k)} minGroup={summary.minGroup} />
          <GroupTable title="به تفکیک روز هفته" groups={summary.byWeekday} label={(k) => weekdayFa(Number(k))} minGroup={summary.minGroup} />
          <GroupTable title="پرمصرف‌ترین غذاها" groups={summary.byFood} label={(k) => String(k)} minGroup={summary.minGroup} />
        </div>
      )}
    </div>
  );
}
