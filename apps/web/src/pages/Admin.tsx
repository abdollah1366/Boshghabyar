import { useEffect, useState } from 'react';

import { Notice, SectionTitle, StatCard } from '../components/ui';
import { api, track } from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';

interface Overview {
  users: number;
  proUsers: number;
  mealsTotal: number;
  mealsToday: number;
  revenueIRR: number;
  conversionRate: number;
  topFoods: Array<{ food_id: string; n: number }>;
  eventsByDay: Array<{ date: string; n: number }>;
}

interface EventRow {
  type: string;
  user_id: string | null;
  payload: string;
  created_at: string;
}

export function Admin() {
  const [data, setData] = useState<Overview | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'admin' });
    void Promise.all([
      api<Overview>('/api/admin/overview'),
      api<{ events: EventRow[] }>('/api/admin/events?limit=25'),
    ]).then(([overview, eventData]) => {
      setData(overview);
      setEvents(eventData.events);
    }).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <Notice warn>{error}</Notice>;
  if (!data) return <p className="muted">در حال بارگذاری…</p>;

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>پنل مدیریت</h1>
          <p className="small muted">نمای کلی کاربران، وعدهها و رویدادها.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard label="کاربران" value={formatNumber(data.users)} hint={`${formatNumber(data.proUsers)} حرفهای`} />
        <StatCard label="وعدهها" value={formatNumber(data.mealsTotal)} hint={`${formatNumber(data.mealsToday)} امروز`} />
        <StatCard label="نرخ تبدیل" value={`${formatNumber(data.conversionRate * 100)}٪`} hint="رایگان به حرفهای" />
        <StatCard label="درآمد ثبتشده" value={formatNumber(data.revenueIRR)} hint="تومان · پرداخت آزمایشی" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionTitle title="پرمصرفترین غذاها" />
          <ul className="list">
            {data.topFoods.length === 0 && <li className="small muted">هنوز وعدهای ثبت نشده است.</li>}
            {data.topFoods.map((food) => (
              <li className="list-item" key={food.food_id}>
                <span>{food.food_id}</span>
                <span className="badge">{formatNumber(food.n)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <SectionTitle title="رویدادهای هفت روز اخیر" />
          <ul className="list">
            {data.eventsByDay.map((day) => (
              <li className="list-item" key={day.date}>
                <span>{formatDate(day.date)}</span>
                <span className="badge">{formatNumber(day.n)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <SectionTitle title="آخرین رویدادها" />
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>رویداد</th><th>کاربر</th><th>اطلاعات</th><th>زمان</th></tr></thead>
            <tbody>
              {events.map((event, i) => (
                <tr key={`${event.created_at}-${i}`}>
                  <td>{event.type}</td>
                  <td className="small muted" dir="ltr">{event.user_id?.slice(0, 8) ?? '—'}</td>
                  <td className="small muted" dir="ltr">{event.payload}</td>
                  <td className="small muted">{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
