import { Platform } from 'react-native';

const DEFAULT_API =
  Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API;

let authToken: string | null = null;

export function setApiToken(token: string | null): void {
  authToken = token;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) throw new ApiError(String(body.error ?? 'خطا در ارتباط با سرور'), response.status);
  return body as T;
}

export function track(type: string, payload: Record<string, unknown> = {}): void {
  if (!authToken) return;
  void api('/api/events', { method: 'POST', body: JSON.stringify({ type, payload }) }).catch(() => undefined);
}
