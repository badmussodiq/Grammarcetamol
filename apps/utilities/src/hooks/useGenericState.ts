'use client';

import { useCallback, useState } from 'react';

function isPlainObjectState(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Plain-object state (excluding arrays) updates one key at a time: (key, value | updater).
 * Everything else — primitives, arrays, class instances — replaces the whole value: (value | updater).
 *
 * The `[T] extends [...]` form (rather than a naked `T extends ...`) is deliberate: a naked
 * conditional distributes over unions, and `boolean` is `true | false` under the hood — that
 * would split this into an unusable intersection of two narrow signatures instead of one
 * signature over `boolean`. Wrapping in a tuple evaluates T as a whole and avoids that.
 */
type UpdateStateFunction<T> = [T] extends [Record<PropertyKey, unknown>]
  ? <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => void
  : (value: T | ((prev: T) => T)) => void;

type ReplaceStateFunction<T> = (value: T | ((prev: T) => T)) => void;

/**
 * useState with two extra conveniences: patch a single key of an object without
 * spreading the rest yourself, and a separate setter for replacing the whole
 * value. Both setters are referentially stable (useCallback, no deps) — safe to
 * pass down as props without re-triggering memoized children.
 *
 * @returns [state, updateState, replaceState]
 */
export function useGenericState<T>(
  initialState: T | (() => T),
): [T, UpdateStateFunction<T>, ReplaceStateFunction<T>] {
  const [state, setState] = useState<T>(initialState);

  const replaceState = useCallback<ReplaceStateFunction<T>>((value) => {
    setState((prev) => (typeof value === 'function' ? (value as (prev: T) => T)(prev) : value));
  }, []);

  const updateState = useCallback((...args: [unknown, unknown?]) => {
    setState((prev) => {
      if (isPlainObjectState(prev)) {
        const [key, value] = args as [keyof T, T[keyof T] | ((prev: T[keyof T]) => T[keyof T])];
        const nextValue = typeof value === 'function'
          ? (value as (prev: T[keyof T]) => T[keyof T])(prev[key] as T[keyof T])
          : value;
        return { ...prev, [key]: nextValue };
      }
      const [value] = args as [T | ((prev: T) => T)];
      return typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
    });
  }, []) as UpdateStateFunction<T>;

  return [state, updateState, replaceState];
}
