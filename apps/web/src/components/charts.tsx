import { formatNumber } from '../lib/format';

export interface ChartPoint {
  label: string;
  value: number;
  title?: string;
  dim?: boolean;
}

const W = 340;
const PAD_T = 14;
const PAD_B = 26;

/** در راست‌به‌چپ، قدیمی‌ترین نقطه سمت راست قرار می‌گیرد */
const xAt = (index: number, count: number, left = 8, right = 8): number => {
  const step = (W - left - right) / count;
  return W - right - (index + 0.5) * step;
};

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export function BarChart({ data, target, height = 170, label, formatValue = formatNumber, labelEvery = 1 }: {
  data: ChartPoint[];
  target?: number;
  height?: number;
  label: string;
  formatValue?: (value: number) => string;
  labelEvery?: number;
}) {
  const max = niceMax(Math.max(target ?? 0, ...data.map((d) => d.value)));
  const plotH = height - PAD_T - PAD_B;
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const step = (W - 16) / Math.max(1, data.length);
  const barW = Math.min(34, step * 0.62);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line className="grid-line" x1={8} x2={W - 8} y1={y(max * t)} y2={y(max * t)} />
        </g>
      ))}
      {data.map((d, i) => {
        const x = xAt(i, data.length);
        const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plotH);
        return (
          <g key={`${d.label}-${i}`}>
            <rect className={`bar ${d.dim || d.value === 0 ? 'dim' : ''}`} x={x - barW / 2} y={PAD_T + plotH - h} width={barW} height={h} rx={5}>
              <title>{d.title ?? `${d.label}: ${formatValue(d.value)}`}</title>
            </rect>
            {i % labelEvery === 0 && <text x={x} y={height - 8} textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
      {target !== undefined && target > 0 && (
        <line className="target-line" x1={8} x2={W - 8} y1={y(target)} y2={y(target)} />
      )}
    </svg>
  );
}

export function LineChart({ data, target, height = 190, label, formatValue = formatNumber, labelEvery = 1 }: {
  data: ChartPoint[];
  target?: number;
  height?: number;
  label: string;
  formatValue?: (value: number) => string;
  labelEvery?: number;
}) {
  const max = niceMax(Math.max(target ?? 0, ...data.map((d) => d.value)) * 1.05);
  const plotH = height - PAD_T - PAD_B;
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const pts = data.map((d, i) => ({ x: xAt(i, data.length, 12, 12), y: y(d.value), d }));
  // نقطه‌های بدون ثبت (۰) به‌عنوان وقفه رسم می‌شوند تا روند گمراه‌کننده نشود
  const segments: Array<typeof pts> = [];
  let current: typeof pts = [];
  for (const p of pts) {
    if (p.d.value > 0) current.push(p);
    else if (current.length) { segments.push(current); current = []; }
  }
  if (current.length) segments.push(current);
  const path = (seg: typeof pts) => seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const base = PAD_T + plotH;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((t) => (
        <line key={t} className="grid-line" x1={8} x2={W - 8} y1={y(max * t)} y2={y(max * t)} />
      ))}
      {target !== undefined && target > 0 && <line className="target-line" x1={8} x2={W - 8} y1={y(target)} y2={y(target)} />}
      {segments.map((seg, i) => (
        <g key={i}>
          {seg.length > 1 && <path className="area" d={`${path(seg)} L${seg[seg.length - 1]!.x.toFixed(1)} ${base} L${seg[0]!.x.toFixed(1)} ${base} Z`} />}
          <path className="line" d={path(seg)} />
        </g>
      ))}
      {pts.filter((p) => p.d.value > 0).map((p, i) => (
        <circle key={i} className="dot" cx={p.x} cy={p.y} r={data.length > 40 ? 0 : 3.5}>
          <title>{p.d.title ?? `${p.d.label}: ${formatValue(p.d.value)}`}</title>
        </circle>
      ))}
      {data.map((d, i) => (i % labelEvery === 0 ? <text key={i} x={xAt(i, data.length, 12, 12)} y={height - 8} textAnchor="middle">{d.label}</text> : null))}
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({ segments, size = 150, stroke = 22, label, center }: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  label: string;
  center?: React.ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        {total > 0 && segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="ring-center">{center}</div>
    </div>
  );
}
