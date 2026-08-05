'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFetch<T>(path: string | null): FetchState<T> {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError]   = useState<string | null>(null);
  const [tick, setTick]     = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<{ data: T }>(path)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [path, tick]);

  return { data, loading, error, refetch };
}
