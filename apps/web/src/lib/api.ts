const TOKEN_KEY = 'boshghabyar_token';

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '';

const DEFAULT_TIMEOUT_MS = 15_000;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* حافظهٔ مرورگر در دسترس نیست */
  }
}

/** تنها نوع خطای کلاینت: همهٔ خطاهای شبکه، زمان‌سنج و پاسخ‌های ناموفق سرور */
export class ApiError extends Error {
  readonly status: number;
  readonly data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  get retryAfterSec(): number | undefined {
    const value = this.data.retryAfterSec;
    return typeof value === 'number' ? value : undefined;
  }

  get manual(): boolean {
    return this.data.manual === true;
  }

  get upgradeRequired(): boolean {
    return this.data.upgradeRequired === true;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function errorMessage(error: unknown, fallback = 'خطایی رخ داد؛ دوباره تلاش کنید'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** بدنهٔ JSON */
  json?: unknown;
  /** بدنهٔ خام (مثلاً تصویر) */
  blob?: Blob;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const token = getToken();
  const headers = new Headers();
  let body: BodyInit | undefined;
  if (options.blob) {
    headers.set('Content-Type', options.blob.type || 'application/octet-stream');
    body = options.blob;
  } else if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method: options.method ?? 'GET', headers, body, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiError('پاسخ سرور طولانی شد؛ لطفاً دوباره تلاش کنید', 0);
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('درخواست لغو شد', 0);
    throw new ApiError('ارتباط با سرور برقرار نشد؛ اینترنت خود را بررسی کنید', 0);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let data: Record<string, unknown> = {};
    try {
      const text = await response.text();
      const parsed: unknown = text ? JSON.parse(text) : {};
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      /* بدنهٔ غیر JSON */
    }
    if (response.status === 401 && token) {
      setToken(null);
      unauthorizedHandler?.();
    }
    const message = typeof data.error === 'string' && data.error ? data.error : 'خطایی رخ داد؛ دوباره تلاش کنید';
    throw new ApiError(message, response.status, data);
  }
  return response;
}

export async function api<T = Record<string, never>>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return {} as T;
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('پاسخ نامعتبر از سرور دریافت شد', response.status);
  }
}

/** دانلود فایل با توکن در هدر (نه در نشانی) و ذخیره از راه Blob */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await send(path, { timeoutMs: 60_000 });
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function track(type: string, payload: Record<string, unknown> = {}): void {
  if (!getToken()) return;
  void api('/api/events', { method: 'POST', json: { type, payload } }).catch(() => undefined);
}

export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
