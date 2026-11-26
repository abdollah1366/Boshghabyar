import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

import { clampPercent, formatNumber } from '../lib/format';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <div className="card stat">
      {icon && <span className="stat-icon"><Icon name={icon} size={20} /></span>}
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Progress({ label, value, target, unit = '', tone }: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  tone?: 'good' | 'gold';
}) {
  const ratio = target ? value / target : 0;
  const over = ratio > 1.0001;
  return (
    <div className="stack-sm">
      <div className="row between small">
        <span>{label}</span>
        <span className={over ? 'error-text' : 'muted'}>
          {formatNumber(value)}{unit} از {formatNumber(target)}{unit}
        </span>
      </div>
      <div
        className={`progress ${over ? 'over' : tone ?? ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.min(100, Math.round(ratio * 100))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${clampPercent(ratio)}%` }} />
      </div>
    </div>
  );
}

export function Ring({ value, size = 140, stroke = 12, color, children, label }: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clampPercent(value) / 100) * circumference;
  const style: CSSProperties = { width: size, height: size };
  return (
    <div className="ring" style={style} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={color ? { stroke: color } : undefined}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, radius }: { width?: number | string; height?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3, height = 120 }: { lines?: number; height?: number }) {
  return (
    <div className="card stack" aria-busy="true" aria-label="در حال بارگذاری">
      <Skeleton width="40%" height={16} />
      {lines > 0 && <Skeleton height={height} radius={12} />}
      {Array.from({ length: Math.max(0, lines - 1) }, (_, i) => <Skeleton key={i} width={`${90 - i * 15}%`} />)}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="stack" role="status" aria-label="در حال بارگذاری">
      <Skeleton width={180} height={28} />
      <div className="grid grid-4">
        <SkeletonCard lines={0} />
        <SkeletonCard lines={0} />
        <SkeletonCard lines={0} />
        <SkeletonCard lines={0} />
      </div>
      <SkeletonCard lines={3} height={160} />
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="در حال انجام" />;
}

export function EmptyState({ icon = 'plate', title, text, action }: { icon?: IconName; title?: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-art"><Icon name={icon} size={32} /></span>
      {title && <h3>{title}</h3>}
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card empty" role="alert">
      <span className="empty-art" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}><Icon name="alert" size={32} /></span>
      <p>{message}</p>
      {onRetry && <button className="btn btn-secondary" type="button" onClick={onRetry}><Icon name="refresh" size={18} /> تلاش دوباره</button>}
    </div>
  );
}

export function Notice({ tone = 'info', icon, children, onClose }: {
  tone?: 'info' | 'warn' | 'error' | 'success' | 'accent';
  icon?: IconName;
  children: ReactNode;
  onClose?: () => void;
}) {
  const defaultIcon: IconName = tone === 'error' || tone === 'warn' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return (
    <div className={`notice ${tone === 'info' ? '' : tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon ?? defaultIcon} size={20} />
      <div className="notice-body">{children}</div>
      {onClose && (
        <button className="icon-btn" style={{ width: 28, height: 28 }} type="button" aria-label="بستن" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="switch-row">
      <div>
        <label id={`${id}-l`} htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
        {description && <p className="small muted">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" className="switch" aria-checked={checked} aria-labelledby={`${id}-l`} disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

export function tabIds(prefix: string, id: string): { tab: string; panel: string } {
  return { tab: `${prefix}-tab-${id}`, panel: `${prefix}-panel-${id}` };
}

export function Tabs<T extends string>({ items, value, onChange, prefix, label }: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  prefix: string;
  label: string;
}) {
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    let next = index;
    // در راست‌به‌چپ، فلش چپ یعنی تب بعدی
    if (event.key === 'ArrowLeft') next = (index + 1) % items.length;
    else if (event.key === 'ArrowRight') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    const target = items[next];
    if (target) {
      onChange(target.id);
      document.getElementById(tabIds(prefix, target.id).tab)?.focus();
    }
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {items.map((item) => (
        <button
          key={item.id}
          id={tabIds(prefix, item.id).tab}
          className="tab"
          type="button"
          role="tab"
          aria-selected={item.id === value}
          aria-controls={tabIds(prefix, item.id).panel}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({ title, onClose, children, drawer = false, labelledBy }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={`backdrop ${drawer ? 'backdrop-end' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={drawer ? 'drawer' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        tabIndex={-1}
        onKeyDown={onKey}
      >
        <div className="row between" style={{ marginBlockEnd: 'var(--space-3)' }}>
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" type="button" aria-label="بستن" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, busy, danger = true, onConfirm, onClose, disabled }: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="stack">
        {children}
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" data-autofocus onClick={onClose}>انصراف</button>
          <button className={`btn ${danger ? 'btn-accent' : ''}`} type="button" disabled={busy || disabled} onClick={onConfirm}>
            {busy ? 'در حال انجام…' : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
