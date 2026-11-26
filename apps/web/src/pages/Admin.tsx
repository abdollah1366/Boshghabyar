import { useState } from 'react';

import { BarChart } from '../components/charts';
import { EmptyState, ErrorState, PageHead, PageSkeleton, Skeleton, StatCard, Tabs, tabIds } from '../components/ui';
import { formatDate, formatDateTime, formatIRR, formatNumber, formatPercent, toPersianDigits, weekdayShortOf } from '../lib/format';
import { useApi, useDocumentTitle } from '../lib/hooks';
import { AdminResearch } from './AdminResearch';
import { AdminUsers } from './AdminUsers';

type TabId = 'overview' | 'users' | 'research' | 'club' | 'audit';

interface Overview {
  users: number;
  proUsers: number;
  newUsers7d: number;
  activeUsers7d: number;
  researchConsentUsers: number;
  mealsTotal: number;
  mealsToday: number;
  cameraMeals: number;
  recognitionsToday: number;
  revenueIRR: number;
  conversionRate: number;
  topFoods: Array<{ food_id: string; n: number; nameFa: string }>;
  eventsByDay: Array<{ date: string; n: number }>;
  mealsByDay: Array<{ date: string; n: number }>;
  club: { tokensIssued: number; tokensSpent: number; referrals: number; referralsRewarded: number; redemptions: number };
}

interface ClubAdmin {
  topReferrers: Array<{ name: string; referral_code: string; invited: number; rewarded: number }>;
  levels: Record<string, number>;
}

interface AuditRow { admin_id: string; action: string; target: string | null; detail: string | null; ip: string | null; created_at: string }
interface EventRow { type: string; user_id: string | null; payload: string; created_at: string }

const AUDIT_LABELS: Record<string, string> = {
  'admin.overview.view': 'مشاهدهٔ نمای کلی',
  'admin.users.list': 'فهرست کاربران',
  'admin.users.view': 'مشاهدهٔ کاربر',
  'admin.users.update': 'ویرایش کاربر',
  'admin.tokens.grant': 'تغییر ژتون',
  'admin.meals.list': 'فهرست وعده‌ها',
  'admin.club.view': 'مشاهدهٔ باشگاه',
  'admin.research.summary': 'خلاصهٔ پژوهشی',
  'admin.research.export': 'خروجی پژوهشی',
};

function dayPoints(rows: Array<{ date: string; n: number }>) {
  return rows.map((r) => ({ label: weekdayShortOf(r.date), value: r.n, title: `${formatDate(r.date)}: ${formatNumber(r.n)}` }));
}

function OverviewTab() {
  const overview = useApi<Overview>('/api/admin/overview');
  if (overview.loading && !overview.data) return <PageSkeleton />;
  if (overview.error && !overview.data) return <ErrorState message={overview.error} onRetry={overview.reload} />;
  if (!overview.data) return null;
  const o = overview.data;
  const maxFood = Math.max(1, ...o.topFoods.map((f) => f.n));

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon="users" label="کل کاربران" value={formatNumber(o.users)} hint={`${formatNumber(o.newUsers7d)} کاربر جدید در ۷ روز`} />
        <StatCard icon="check" label="کاربران فعال (۷ روز)" value={formatNumber(o.activeUsers7d)} />
        <StatCard icon="crown" label="کاربران حرفه‌ای" value={formatNumber(o.proUsers)} hint={`نرخ تبدیل ${formatPercent(o.conversionRate * 100)}`} />
        <StatCard icon="gift" label="درآمد ثبت‌شده" value={formatIRR(o.revenueIRR)} />
        <StatCard icon="bowl" label="وعده‌ها" value={formatNumber(o.mealsTotal)} hint={`${formatNumber(o.mealsToday)} وعده امروز`} />
        <StatCard icon="camera" label="ثبت با عکس" value={formatNumber(o.cameraMeals)} hint={`${formatNumber(o.recognitionsToday)} تشخیص امروز`} />
        <StatCard icon="shield" label="موافقان پژوهش" value={formatNumber(o.researchConsentUsers)} />
        <StatCard icon="trophy" label="دعوت‌های موفق" value={`${formatNumber(o.club.referralsRewarded)} از ${formatNumber(o.club.referrals)}`} />
      </div>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="ov-meals">
          <h2 id="ov-meals" style={{ fontSize: 'var(--text-md)' }}>وعده‌های ثبت‌شده در ۷ روز اخیر</h2>
          {o.mealsByDay.length === 0 ? <EmptyState icon="chart" text="دادهای ثبت نشده است." /> : <BarChart label="نمودار وعده‌ها در هفته" data={dayPoints(o.mealsByDay)} />}
        </section>
        <section className="card stack" aria-labelledby="ov-events">
          <h2 id="ov-events" style={{ fontSize: 'var(--text-md)' }}>رویدادهای ۷ روز اخیر</h2>
          {o.eventsByDay.length === 0 ? <EmptyState icon="chart" text="رویدادی ثبت نشده است." /> : <BarChart label="نمودار رویدادها در هفته" data={dayPoints(o.eventsByDay)} />}
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="ov-foods">
          <h2 id="ov-foods" style={{ fontSize: 'var(--text-md)' }}>پرمصرف‌ترین غذاها</h2>
          {o.topFoods.length === 0 ? <p className="small muted">دادهای نیست.</p> : o.topFoods.map((f) => (
            <div key={f.food_id} className="macro-row" style={{ gridTemplateColumns: '120px 1fr 48px' }}>
              <span className="truncate">{f.nameFa}</span>
              <div className="progress" role="img" aria-label={`${f.nameFa}: ${formatNumber(f.n)} بار`}><span style={{ width: `${(f.n / maxFood) * 100}%` }} /></div>
              <span className="val">{formatNumber(f.n)}</span>
            </div>
          ))}
        </section>
        <section className="card stack" aria-labelledby="ov-club">
          <h2 id="ov-club" style={{ fontSize: 'var(--text-md)' }}>باشگاه مشتریان</h2>
          <dl className="kv">
            <dt>ژتون صادرشده</dt><dd>{formatNumber(o.club.tokensIssued)}</dd>
            <dt>ژتون مصرف‌شده</dt><dd>{formatNumber(o.club.tokensSpent)}</dd>
            <dt>جایزه‌های دریافت‌شده</dt><dd>{formatNumber(o.club.redemptions)}</dd>
            <dt>دعوت‌ها</dt><dd>{formatNumber(o.club.referrals)}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}

function ClubTab() {
  const club = useApi<ClubAdmin>('/api/admin/club');
  if (club.loading && !club.data) return <Skeleton height={200} radius={14} />;
  if (club.error && !club.data) return <ErrorState message={club.error} onRetry={club.reload} />;
  if (!club.data) return null;
  const levels = Object.entries(club.data.levels);
  const total = levels.reduce((sum, [, n]) => sum + n, 0) || 1;
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <section className="card stack" aria-labelledby="cl-top">
        <h2 id="cl-top" style={{ fontSize: 'var(--text-md)' }}>برترین دعوت‌کنندگان</h2>
        {club.data.topReferrers.length === 0 ? <EmptyState icon="users" text="هنوز دعوتی ثبت نشده است." /> : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 360 }}>
              <thead><tr><th>نام</th><th>کد</th><th className="num-cell">دعوت</th><th className="num-cell">موفق</th></tr></thead>
              <tbody>
                {club.data.topReferrers.map((r) => (
                  <tr key={r.referral_code}>
                    <td>{r.name}</td><td className="ltr small">{r.referral_code}</td>
                    <td className="num-cell">{formatNumber(r.invited)}</td><td className="num-cell">{formatNumber(r.rewarded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card stack" aria-labelledby="cl-levels">
        <h2 id="cl-levels" style={{ fontSize: 'var(--text-md)' }}>توزیع سطح کاربران</h2>
        {levels.map(([label, n]) => (
          <div key={label} className="macro-row" style={{ gridTemplateColumns: '80px 1fr 56px' }}>
            <span>{label}</span>
            <div className="progress gold" role="img" aria-label={`${label}: ${formatNumber(n)} نفر`}><span style={{ width: `${(n / total) * 100}%` }} /></div>
            <span className="val">{formatNumber(n)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function AuditTab() {
  const audit = useApi<{ audit: AuditRow[] }>('/api/admin/audit?limit=100');
  const events = useApi<{ events: EventRow[] }>('/api/admin/events?limit=50');
  return (
    <div className="stack-lg">
      <section className="stack" aria-labelledby="au-title">
        <h2 id="au-title" style={{ fontSize: 'var(--text-md)' }}>گزارش دسترسی مدیران</h2>
        {audit.error && !audit.data ? <ErrorState message={audit.error} onRetry={audit.reload} /> : !audit.data ? <Skeleton height={160} radius={14} /> : audit.data.audit.length === 0 ? (
          <div className="card"><EmptyState icon="shield" text="هنوز دسترسی‌ای ثبت نشده است." /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>زمان</th><th>اقدام</th><th>هدف</th><th>جزئیات</th><th>نشانی</th></tr></thead>
              <tbody>
                {audit.data.audit.map((row, i) => (
                  <tr key={`${row.created_at}-${i}`}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</td>
                    <td>{AUDIT_LABELS[row.action] ?? row.action}<span className="tiny faint ltr" style={{ display: 'block' }}>{row.action}</span></td>
                    <td className="ltr tiny">{row.target ? row.target.slice(0, 8) : '—'}</td>
                    <td className="ltr tiny" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.detail ?? ''}>{row.detail ?? '—'}</td>
                    <td className="ltr tiny">{row.ip ? toPersianDigits(row.ip) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="ev-title">
        <h2 id="ev-title" style={{ fontSize: 'var(--text-md)' }}>رویدادهای اخیر</h2>
        {events.error && !events.data ? <ErrorState message={events.error} onRetry={events.reload} /> : !events.data ? <Skeleton height={160} radius={14} /> : events.data.events.length === 0 ? (
          <div className="card"><EmptyState icon="chart" text="رویدادی ثبت نشده است." /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>زمان</th><th>نوع</th><th>کاربر</th><th>داده</th></tr></thead>
              <tbody>
                {events.data.events.map((ev, i) => (
                  <tr key={`${ev.created_at}-${i}`}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(ev.created_at)}</td>
                    <td className="ltr small">{ev.type}</td>
                    <td className="ltr tiny">{ev.user_id ? ev.user_id.slice(0, 8) : '—'}</td>
                    <td className="ltr tiny" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.payload}>{ev.payload}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Admin() {
  useDocumentTitle('مدیریت');
  const [tab, setTab] = useState<TabId>('overview');
  return (
    <>
      <PageHead title="پنل مدیریت" subtitle="آمار، کاربران، داده‌های پژوهشی و گزارش دسترسی" />
      <Tabs
        prefix="adm"
        label="بخش‌های مدیریت"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'نمای کلی' },
          { id: 'users', label: 'کاربران' },
          { id: 'research', label: 'پژوهش' },
          { id: 'club', label: 'باشگاه' },
          { id: 'audit', label: 'گزارش دسترسی' },
        ]}
      />
      <div role="tabpanel" id={tabIds('adm', tab).panel} aria-labelledby={tabIds('adm', tab).tab} tabIndex={0}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <AdminUsers />}
        {tab === 'research' && <AdminResearch />}
        {tab === 'club' && <ClubTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </>
  );
}

export { Admin };
