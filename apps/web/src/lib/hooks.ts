import { useCallback, useEffect, useRef, useState } from 'react';
import type { Food } from '@boshghabyar/core';

import { api, errorMessage } from './api';

export interface Loaded<T> {
  data: T | null;
  error: string;
  loading: boolean;
  reload: () => void;
  setData: (value: T | null) => void;
}

/** بارگذاری GET با نگهداری وضعیت؛ با تغییر path دوباره بارگذاری می‌شود (null = غیرفعال) */
export function useApi<T>(path: string | null): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setError('');
    api<T>(path)
      .then((result) => {
        if (id === seq.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === seq.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [path, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}

let foodsCache: Food[] | null = null;

/** فهرست غذاها (با کش درون‌حافظه‌ای برای جلوگیری از درخواست تکراری) */
export function useFoods(): { foods: Food[]; loading: boolean; error: string; nameOf: (id: string) => string } {
  const [foods, setFoods] = useState<Food[]>(foodsCache ?? []);
  const [loading, setLoading] = useState(foodsCache === null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (foodsCache) return;
    api<{ foods: Food[] }>('/api/foods')
      .then((result) => {
        foodsCache = result.foods;
        setFoods(result.foods);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const nameOf = useCallback((id: string) => foods.find((food) => food.id === id)?.nameFa ?? 'غذای نامشخص', [foods]);
  return { foods, loading, error, nameOf };
}

export function clearFoodsCache(): void {
  foodsCache = null;
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | بشقاب‌یار`;
  }, [title]);
}
