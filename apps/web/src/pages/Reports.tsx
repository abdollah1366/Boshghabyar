import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Notice, SectionTitle, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, track } from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';

interface WeeklyResponse {
  trend: Array<{ date: string; kcal: number; protein: number; budget: number; entryCount: number }>;
  summary: { averageKcal: number; activeDays: number; totalMeals: number; budgetUsedIRR: number };
  insight: string;
  advanced: boolean;
}

function BarChart({ points }: { points: WeeklyResponse['trend'] }) {
  const max = Math.max(...points.map((p) => p.kcal), 1);
  const width = 700;
  const height = 160;
  const step = width / Math.max(points.length, 1);
  const barWidth = Math.min(48, step * 0.6);

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="نمودار کالری روزانه">
      <line x1="0" y1={height - 20} x2={width} y2={height - 20} stroke="var(--border)" />
      {points.map((point, i) => {
        const barHeight = (point.kcal / max) * (height - 40);
        const x = i * step + (step - barWidth) / 2;
        return (
          <g key={point.date}>
            <rect
              className={point.kcal ? 'chart-bar' : 'chart-bar-zero'}
              x={x}
              y={height - 20 - barHeight}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx="4"
            />
            <text className="chart-label" x={x + barWidth / 2} y={height - 4} textAnchor="middle">{formatDate(point.date)}</text>
            {point.kcal > 0 && <text className="chart-label" x={x + barWidth / 2} y={height - 26 - barHeight} textAnchor="middle">{formatNumber(point.kcal)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState<WeeklyResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'reports' });
    void api<WeeklyResponse>('/api/reports/weekly?days=7').then(setData).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <Notice warn>{error}</Notice>;
  if (!data) return <p className="muted">در حال بارگذاری…</p>;

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>گزارشها</h1>
          <p className="small muted">روند هفت روزه کالری، وعدهها و هزینه.</p>
        </div>
        {user?.plan === 'free' && <Link className="btn btn-secondary btn-sm" to="/profile">ارتقا به حرفهای</Link>}
      </div>

      <div className="grid grid-4">
        <StatCard label="میانگین کالری" value={formatNumber(data.summary.averageKcal)} hint="کیلوکالوری در روز" />
        <StatCard label="روزهای فعال" value={`${data.summary.activeDays} / 7`} hint="دارای ثبت وعده" />
        <StatCard label="کل وعدهها" value={formatNumber(data.summary.totalMeals)} hint="در بازه هفت روزه" />
        <StatCard label="هزینه ثبتشده" value={formatNumber(data.summary.budgetUsedIRR)} hint="تومان" />
      </div>

      <div className="card stack">
        <SectionTitle title="کالری روزانه" action={<span className="badge">آخرین ۷ روز</span>} />
        <BarChart points={data.trend} />
        <Notice warn={!data.advanced}>{data.insight}</Notice>
      </div>
    </div>
  );
}
