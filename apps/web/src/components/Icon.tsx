const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  plus: 'M12 5v14M5 12h14',
  chart: 'M4 20V11M10 20V5M16 20v-6M3 20h18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  plate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z',
  logout: 'M10 4H5v16h5M14 8l-4 4 4 4M10 12h11',
  check: 'M4 12l5 5L20 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9 12l2 2 4-4',
  camera: 'M4 8a2 2 0 0 1 2-2h1.5l1.2-2h6.6l1.2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  gift: 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-2 0-4-1-4-3s3-2.5 4 0c1-2.5 4-2 4 0s-2 3-4 3Z',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v8h14v-8',
  download: 'M12 3v12M8 11l4 4 4-4M5 21h14',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  alert: 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-5-5',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0V4ZM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 14v4M8 21h8M10 18h4',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Z',
  refresh: 'M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4',
  forward: 'M15 6l-6 6 6 6',
  back: 'M9 6l6 6-6 6',
  bowl: 'M3 11h18a9 9 0 0 1-18 0ZM8 7c0-1.5 1.5-1.5 1.5-3M13 7c0-1.5 1.5-1.5 1.5-3',
  calendar: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 9h16M8 3v3M16 3v3',
  heart: 'M12 21s-7-4.5-7-11a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 6.5-7 11-7 11Z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  doctor: 'M4 5h5V3h6v2h5v16H4V5Zm8 4a2 2 0 0 0-2 2v2h-2v2h2v2h2v-2h2v-2h-2v-2a2 2 0 0 0-2-2Z',
  phone: 'M6 4h4l2 5-2 1c1 3 3 5 6 6l1-2 5 2v4c0 1-1 2-2 2C10 22 2 14 2 6c0-1 1-2 2-2Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, strokeWidth = 2 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Coin({ size = 28 }: { size?: number }) {
  return (
    <span className="coin" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">
      ژ
    </span>
  );
}
