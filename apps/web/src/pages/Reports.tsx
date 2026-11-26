import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { BarChart, Donut, LineChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, Notice, PageHead, Progress, Ring, SkeletonCard, StatCard, Tabs, tabIds } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError, downloadFile, errorMessage, track } from '../lib/api';
import { formatDate, formatDecimal, formatIRR, formatNumber, formatPercent, toPersianDigits, weekdayShortOf } from '../lib/format';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { DetailedReport, DetailedResponse, WeeklyReport } from '../lib/types';

type TabId = 'basic' | 'detailed';
const PERIODS = [7, 30, 90] as const;

const SAMPLE = [1800, 2100, 1950, 2300, 1700, 2050, 1900, 2200, 1850, 2000].map((value, i) => ({ label: String(i), value }));

function BasicTab() {
  const { user } = useAuth();
  const weekly = useApi<WeeklyReport>('/api/reports/weekly?days=7');

  if (weekly.loading && !weekly.data) return <div className="stack"><SkeletonCard lines={2} height={180} /><div className="grid grid-3"><SkeletonCard lines={0} /><SkeletonCard lines={0} /><SkeletonCard lines={0} /></div></div>;
  if (weekly.error && !weekly.data) return <ErrorState message={weekly.error} onRetry={weekly.reload} />;
  if (!weekly.data) return null;

  const { trend, summary, insight } = weekly.data;
  const target = user?.goal.calorieTarget;
  const empty = summary.totalMeals === 0;

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon="chart" label="میانگین کالری روزانه" value={formatNumber(summary.averageKcal)} hint="کیلوکالری در روزهای فعال" />
        <StatCard icon="bowl" label="میانگین پروتئین" value={`${formatDecimal(summary.averageProtein)} گرم`} hint="در هر روز فعال" />
        <StatCard icon="check" label="روزهای فعال" value={`${formatNumber(summary.activeDays)} از ۷`} hint={`${formatNumber(summary.totalMeals)} وعده ثبت شده`} />
        <StatCard icon="gift" label="هزینهٔ غذا" value={formatIRR(summary.budgetUsedIRR)} hint="مجموع هفته" />
      </div>

      <section className="card stack" aria-labelledby="week-title">
        <div className="card-head" style={{ marginBlockEnd: 0 }}>
          <h2 id="week-title">کالری هفتهٔ اخیر</h2>
          <span className="legend"><span><i style={{ background: 'var(--chart-1)' }} />کالری روزانه</span><span><i style={{ background: 'var(--chart-2)' }} />هدف</span></span>
        </div>
        {empty ? (
          <EmptyState icon="chart" text="هنوز وعده‌ای در هفتهٔ اخیر ثبت نشده است." action={<Link className="btn btn-sm" to="/log">ثبت وعده</Link>} />
        ) : (
          <BarChart
            label="نمودار میله‌ای کالری ۷ روز اخیر"
            target={target}
            data={trend.map((p) => ({ label: weekdayShortOf(p.date), value: Math.round(p.kcal), title: `${formatDate(p.date)}: ${formatNumber(p.kcal)} کیلوکالری` }))}
          />
        )}
        <Notice icon="spark">{toPersianDigits(insight)}</Notice>
      </section>
    </div>
  );
}

function LockedPreview({ data, onUnlocked }: { data: Extract<DetailedResponse, { locked: true }>; onUnlocked: () => void }) {
  const { upgrade } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doUpgrade = async () => {
    setBusy(true);
    setError('');
    try {
      await upgrade();
      toast.success('نسخهٔ حرفه‌ای فعال شد');
      onUnlocked();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 501 ? 'پرداخت آنلاین هنوز فعال نشده است؛ فعلاً می‌توانید با ژتون باشگاه، نسخهٔ حرفه‌ای را فعال کنید.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <section className="card card-lg locked-hero stack" aria-labelledby="locked-title">
        <span className="locked-icon"><Icon name="lock" size={30} /></span>
        <h2 id="locked-title">گزارش تکمیلی ویژهٔ نسخهٔ حرفه‌ای است</h2>
        <p className="muted" style={{ maxWidth: 520 }}>{data.messageFa}</p>
        <div style={{ width: '100%', maxWidth: 420 }} className="blur-demo" aria-hidden="true">
          <LineChart label="نمونهٔ نمودار" data={SAMPLE} target={2000} height={150} />
        </div>
        {error && <div style={{ width: '100%', maxWidth: 520, textAlign: 'start' }}><Notice tone="warn">{error}</Notice></div>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-lg" type="button" onClick={doUpgrade} disabled={busy}>
            <Icon name="crown" size={20} /> {busy ? 'در حال فعال‌سازی…' : 'ارتقا به نسخهٔ حرفه‌ای'}
          </button>
          <Link className="btn btn-secondary btn-lg" to="/club"><Icon name="gift" size={20} /> با ژتون باشگاه فعال کن</Link>
        </div>
      </section>

      <section className="card stack" aria-labelledby="sections-title">
        <h2 id="sections-title" style={{ fontSize: 'var(--text-md)' }}>در گزارش تکمیلی چه می‌بینید؟</h2>
        <ul className="grid grid-2">
          {data.sections.map((section) => (
            <li key={section.id} className="locked-item">
              <Icon name="lock" size={18} />
              <span>{section.titleFa}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function scoreTone(score: number): { color: string; label: string } {
  if (score >= 75) return { color: 'var(--success-solid)', label: 'عالی' };
  if (score >= 50) return { color: 'var(--warning-solid)', label: 'خوب' };
  return { color: 'var(--accent)', label: 'نیازمند بهبود' };
}

function DetailedView({ report, calorieTarget }: { report: DetailedReport; calorieTarget: number }) {
  const tone = scoreTone(report.score);
  const split = report.macroSplit;
  const labelEvery = report.days > 60 ? 15 : report.days > 14 ? 5 : 1;
  const maxShare = Math.max(1, ...report.mealTypes.map((m) => m.sharePct));

  return (
    <div className="stack">
      <div className="grid grid-aside">
        <section className="card card-lg stack" aria-labelledby="score-title">
          <h2 id="score-title" style={{ fontSize: 'var(--text-md)' }}>امتیاز تعادل شما</h2>
          <div className="row" style={{ gap: 'var(--space-4)', justifyContent: 'center' }}>
            <Ring value={report.score / 100} size={150} stroke={14} color={tone.color} label={`امتیاز تعادل ${formatNumber(report.score)} از ۱۰۰`}>
              <span className="score-badge num">{formatNumber(report.score)}</span>
              <span className="tiny muted">از ۱۰۰</span>
            </Ring>
            <div className="stack-sm">
              <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text)' }}>{tone.label}</span>
              <p className="small muted">{formatNumber(report.activeDays)} روز فعال از {formatNumber(report.days)} روز</p>
              <p className="small muted">{formatNumber(report.totalMeals)} وعدهٔ ثبت‌شده</p>
            </div>
          </div>
        </section>
        <div className="grid grid-2">
          <StatCard icon="chart" label="میانگین کالری" value={formatNumber(report.averages.kcal)} hint={`هدف ${formatNumber(calorieTarget)}`} />
          <StatCard icon="bowl" label="میانگین پروتئین" value={`${formatDecimal(report.averages.protein)} گرم`} />
          <StatCard icon="flame" label="طولانی‌ترین زنجیره" value={`${formatNumber(report.longestStreak)} روز`} hint="ثبت پیاپی" />
          <StatCard icon="gift" label="هزینهٔ روزانه" value={formatIRR(report.averages.budget)} hint="میانگین" />
        </div>
      </div>

      <section className="card stack" aria-labelledby="trend-title">
        <div className="card-head" style={{ marginBlockEnd: 0 }}>
          <h2 id="trend-title">روند کالری و هدف</h2>
          <span className="legend"><span><i style={{ background: 'var(--chart-1)' }} />کالری</span><span><i style={{ background: 'var(--chart-2)' }} />هدف</span></span>
        </div>
        <LineChart
          label="روند کالری روزانه نسبت به هدف"
          target={calorieTarget}
          labelEvery={labelEvery}
          data={report.trend.map((p) => ({ label: formatDate(p.date), value: Math.round(p.kcal), title: `${formatDate(p.date)}: ${formatNumber(p.kcal)} کیلوکالری` }))}
        />
      </section>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="macro-title">
          <h2 id="macro-title" style={{ fontSize: 'var(--text-md)' }}>سهم انرژی درشت‌مغذی‌ها</h2>
          <div className="donut-wrap">
            <Donut
              label={`پروتئین ${split.proteinPct} درصد، کربوهیدرات ${split.carbsPct} درصد، چربی ${split.fatPct} درصد`}
              segments={[
                { label: 'پروتئین', value: split.proteinPct, color: 'var(--chart-1)' },
                { label: 'کربوهیدرات', value: split.carbsPct, color: 'var(--chart-3)' },
                { label: 'چربی', value: split.fatPct, color: 'var(--chart-2)' },
              ]}
              center={<><strong className="num">{formatNumber(report.averages.kcal)}</strong><span className="tiny muted">کیلوکالری</span></>}
            />
            <ul className="stack-sm small">
              <li><span className="legend"><span><i style={{ background: 'var(--chart-1)' }} />پروتئین: {formatPercent(split.proteinPct)}</span></span></li>
              <li><span className="legend"><span><i style={{ background: 'var(--chart-3)' }} />کربوهیدرات: {formatPercent(split.carbsPct)}</span></span></li>
              <li><span className="legend"><span><i style={{ background: 'var(--chart-2)' }} />چربی: {formatPercent(split.fatPct)}</span></span></li>
            </ul>
          </div>
        </section>

        <section className="card stack" aria-labelledby="adh-title">
          <h2 id="adh-title" style={{ fontSize: 'var(--text-md)' }}>پایبندی به هدف</h2>
          <Progress label="کالری در بازهٔ هدف" value={report.adherence.kcalPct} target={100} unit="٪" />
          <Progress label="تأمین پروتئین" value={report.adherence.proteinPct} target={100} unit="٪" tone="good" />
          <Progress label="رعایت بودجه" value={report.adherence.budgetPct} target={100} unit="٪" tone="gold" />
          <p className="tiny faint">
            {formatNumber(report.adherence.kcalInRangeDays)} روز کالری در بازه، {formatNumber(report.adherence.proteinMetDays)} روز پروتئین کافی و {formatNumber(report.adherence.budgetWithinDays)} روز در چارچوب بودجه.
          </p>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="mt-title">
          <h2 id="mt-title" style={{ fontSize: 'var(--text-md)' }}>توزیع کالری بین وعده‌ها</h2>
          {report.mealTypes.map((m) => (
            <div key={m.mealType} className="macro-row" style={{ gridTemplateColumns: '84px 1fr 96px' }}>
              <span>{m.labelFa}</span>
              <div className="progress" role="img" aria-label={`${m.labelFa}: ${m.sharePct} درصد`}><span style={{ width: `${(m.sharePct / maxShare) * 100}%` }} /></div>
              <span className="val">{formatPercent(m.sharePct)} · {formatNumber(m.count)} وعده</span>
            </div>
          ))}
        </section>

        <section className="card stack" aria-labelledby="tf-title">
          <h2 id="tf-title" style={{ fontSize: 'var(--text-md)' }}>پرمصرف‌ترین غذاها</h2>
          {report.topFoods.length === 0 ? <p className="small muted">دادهٔ کافی نیست.</p> : (
            <ol className="list">
              {report.topFoods.map((food, index) => (
                <li key={food.foodId}>
                  <div className="row row-nowrap grow">
                    <span className="badge badge-primary">{formatNumber(index + 1)}</span>
                    <strong className="truncate">{food.nameFa}</strong>
                  </div>
                  <span className="small muted">{formatNumber(food.count)} بار · {formatNumber(food.kcal)} کیلوکالری</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid grid-2">
        <div className="card row between">
          <div><p className="small muted">متعادل‌ترین روز</p><strong>{report.bestDay ? formatDate(report.bestDay.date) : '—'}</strong></div>
          <span className="badge badge-success">{report.bestDay ? `${formatNumber(report.bestDay.kcal)} کیلوکالری` : 'بدون داده'}</span>
        </div>
        <div className="card row between">
          <div><p className="small muted">پرکالری‌ترین روز</p><strong>{report.highestDay ? formatDate(report.highestDay.date) : '—'}</strong></div>
          <span className="badge badge-warn">{report.highestDay ? `${formatNumber(report.highestDay.kcal)} کیلوکالری` : 'بدون داده'}</span>
        </div>
      </div>

      <section className="card stack" aria-labelledby="ins-title">
        <h2 id="ins-title" style={{ fontSize: 'var(--text-md)' }}>تحلیل‌های شخصی</h2>
        <ul className="stack-sm">
          {report.insights.map((text, index) => <li key={index}><Notice icon="spark">{toPersianDigits(text)}</Notice></li>)}
        </ul>
      </section>
    </div>
  );
}

function DetailedTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [days, setDays] = useState<number>(30);
  const detailed = useApi<DetailedResponse>(`/api/reports/detailed?days=${days}`);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(`/api/reports/export.csv?days=${days}`, 'boshghabyar-meals.csv');
      toast.success('فایل CSV دانلود شد');
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 403 ? 'خروجی CSV ویژهٔ نسخهٔ حرفه‌ای است' : errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (detailed.error && !detailed.data) return <ErrorState message={detailed.error} onRetry={detailed.reload} />;
  if (!detailed.data) return <div className="stack"><SkeletonCard lines={2} height={200} /><SkeletonCard lines={2} height={140} /></div>;

  const data = detailed.data;
  if (data.locked) return <LockedPreview data={data} onUnlocked={detailed.reload} />;

  return (
    <div className="stack">
      <div className="row between">
        <div className="segmented" role="group" aria-label="بازهٔ گزارش">
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>{formatNumber(p)} روز</button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={exportCsv} disabled={exporting}>
          <Icon name="download" size={16} /> {exporting ? 'در حال آماده‌سازی…' : 'دانلود CSV'}
        </button>
      </div>
      {detailed.loading && <div className="progress progress-thin" aria-hidden="true"><span style={{ width: '40%' }} /></div>}
      {data.report.activeDays === 0 ? (
        <div className="card"><EmptyState icon="chart" text="در این بازه وعده‌ای ثبت نشده است." action={<Link className="btn btn-sm" to="/log">ثبت وعده</Link>} /></div>
      ) : (
        <DetailedView report={data.report} calorieTarget={user?.goal.calorieTarget ?? 2000} />
      )}
    </div>
  );
}

export function Reports() {
  useDocumentTitle('گزارش‌ها');
  const [tab, setTab] = useState<TabId>('basic');

  useEffect(() => {
    track('page.viewed', { page: 'reports' });
  }, []);

  return (
    <>
      <PageHead title="گزارش‌ها" subtitle="روند تغذیهٔ شما در یک نگاه" />
      <Tabs
        prefix="rep"
        label="نوع گزارش"
        value={tab}
        onChange={setTab}
        items={[{ id: 'basic', label: 'خلاصه' }, { id: 'detailed', label: 'تکمیلی' }]}
      />
      <div role="tabpanel" id={tabIds('rep', tab).panel} aria-labelledby={tabIds('rep', tab).tab} tabIndex={0}>
        {tab === 'basic' ? <BasicTab /> : <DetailedTab />}
      </div>
    </>
  );
}

export default Reports;
