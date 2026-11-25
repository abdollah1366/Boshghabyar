export const formatIRR = (value: number): string => `${new Intl.NumberFormat('fa-IR').format(Math.round(value))} تومان`;

export const formatNumber = (value: number): string => new Intl.NumberFormat('fa-IR').format(Math.round(value));

export const formatDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(date);
};

export const clampPercent = (ratio: number): number => Math.min(100, Math.max(0, ratio * 100));
