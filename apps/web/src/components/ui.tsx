import type { ReactNode } from 'react';

import { clampPercent, formatNumber } from '../lib/format';

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint && <p className="tiny muted">{hint}</p>}
    </div>
  );
}

export function Progress({ label, value, target, unit = '', over }: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  over?: boolean;
}) {
  const ratio = target ? value / target : 0;
  return (
    <div>
      <div className="row between small">
        <span>{label}</span>
        <span className={over || ratio > 1 ? 'error-text' : 'muted'}>
          {formatNumber(value)}{unit} / {formatNumber(target)}{unit}
        </span>
      </div>
      <div className={`progress ${over || ratio > 1 ? 'over' : ''}`} role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${clampPercent(ratio)}%` }} />
      </div>
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="card-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="card center stack">
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

export function Notice({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return <div className={`notice ${warn ? 'warn' : ''}`}>{children}</div>;
}
