export type IconName = 'home' | 'plus' | 'chart' | 'user' | 'plate' | 'spark' | 'logout' | 'check' | 'shield' | 'admin';

// آیکونهای جهتدار در راستچین باید آینه شوند تا معنای «خروج/بازگشت» حفظ شود.
const MIRROR_IN_RTL: ReadonlySet<IconName> = new Set(['logout']);

const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V21h-7v-7h-4v7H3z',
  plus: 'M12 5v14M5 12h14',
  chart: 'M4 20V11M10 20V5M16 20v-6M3 20h18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  plate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z',
  logout: 'M14 4h5v16h-5M10 8l4 4-4 4M14 12H3',
  check: 'M4 12l5 5L20 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9 12l2 2 4-4',
};

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={PATHS[name]}
        transform={MIRROR_IN_RTL.has(name) ? 'translate(24 0) scale(-1 1)' : undefined}
      />
    </svg>
  );
}
