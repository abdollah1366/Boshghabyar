import { useEffect, useState } from 'react';

import { Icon } from '../components/Icon';
import { Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

interface Client {
  id: string;
  name: string;
  plan: string;
  goalType: string;
  goal: { calorieTarget: number; proteinTarget: number };
  today: { kcal: number; entryCount: number; status: string };
  week: { averageKcal: number; activeDays: number; totalMeals: number };
  trend: Array<{ date: string; kcal: number }>;
  lastMeals: Array<{ foodName: string; grams: number; mealType: string; date: string }>;
}

export function Nutritionist() {
  useDocumentTitle('پنل متخصص تغذیه');
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const isNutritionist = user?.role === 'nutritionist' || user?.role === 'admin';

  const load = () => {
    api<{ clients: Client[] }>('/api/nutritionist/clients')
      .then((r) => setClients(r.clients))
      .catch((e) => setError(errorMessage(e)));
  };

  useEffect(() => {
    if (isNutritionist) load();
  }, [isNutritionist]);

  const connect = async () => {
    setError('');
    setNotice('');
    try {
      await api('/api/nutritionist/me/connect', { method: 'POST', json: { code } });
      setNotice('به متخصص تغذیه وصل شدید.');
      setCode('');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!isNutritionist) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <h1>پنل متخصص تغذیه</h1>
        <p className="muted">اگر متخصص تغذیه‌ای شما را راهنمایی می‌کند، کد معرف او را وارد کنید تا گزارش‌های شما را ببیند و پایش کند.</p>
        <div className="card stack-sm">
          <label htmlFor="nutritionist-code">کد متخصص تغذیه</label>
          <input id="nutritionist-code" className="input ltr" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثلاً AB12CDE" />
          {error && <Notice tone="error">{error}</Notice>}
          {notice && <Notice tone="success">{notice}</Notice>}
          <button className="btn" onClick={connect}>اتصال</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>پنل متخصص تغذیه</h1>
      <p className="muted">مراجعانی که به شما وصل شده‌اند و وضعیت تغذیه‌شان.</p>
      {error && <Notice tone="error">{error}</Notice>}

      {!clients && !error && <p className="muted">در حال بارگذاری…</p>}
      {clients && clients.length === 0 && <p className="muted">هنوز مراجعی به شما وصل نشده است.</p>}

      <div className="grid grid-3">
        {clients?.map((client) => (
          <div className="card" key={client.id}>
            <div className="row between">
              <strong>{client.name}</strong>
              <span className="badge badge-warn">{client.goalType === 'weight-loss' ? 'کاهش وزن' : client.goalType === 'muscle-gain' ? 'افزایش عضله' : client.goalType === 'budget' ? 'اقتصادی' : 'تعادل'}</span>
            </div>
            <p className="small muted">
              امروز: {formatNumber(client.today.kcal)} از {formatNumber(client.goal.calorieTarget)} کیلوکالری · {formatNumber(client.today.entryCount)} وعده
            </p>
            <p className="small muted">
              هفته: میانگین {formatNumber(client.week.averageKcal)} · {formatNumber(client.week.activeDays)} روز فعال
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(expanded === client.id ? null : client.id)}>
              {expanded === client.id ? 'بستن' : 'جزئیات'}
            </button>

            {expanded === client.id && (
              <div className="stack-sm" style={{ marginTop: 'var(--space-3)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)' }}>روند هفت‌روزهٔ کالری</h3>
                <div className="mini-bars">
                  {client.trend.map((t) => {
                    const max = Math.max(...client.trend.map((x) => x.kcal), 1);
                    return (
                      <div key={t.date} className="mini-bar" style={{ height: `${Math.max(6, (t.kcal / max) * 100)}%` }} title={`${formatNumber(t.kcal)} کیلوکالری`} />
                    );
                  })}
                </div>
                <h3 style={{ fontSize: 'var(--text-sm)' }}>آخرین وعده‌ها</h3>
                <ul className="stack-xs" style={{ paddingInlineStart: '1em' }}>
                  {client.lastMeals.map((m, i) => (
                    <li key={i} className="small muted">{m.foodName} · {formatNumber(m.grams)} گرم</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
