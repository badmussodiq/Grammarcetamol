import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGenericState } from '../../src/hooks/useGenericState';

describe('useGenericState', () => {
  it('patches a single key of object state without touching the rest', () => {
    const { result } = renderHook(() => useGenericState({ name: 'Jane', age: 30 }));

    act(() => result.current[1]('age', 31));

    expect(result.current[0]).toEqual({ name: 'Jane', age: 31 });
  });

  it('accepts a functional updater for a single key', () => {
    const { result } = renderHook(() => useGenericState({ count: 1 }));

    act(() => result.current[1]('count', (prev) => prev + 1));

    expect(result.current[0]).toEqual({ count: 2 });
  });

  it('replaces primitive state directly', () => {
    const { result } = renderHook(() => useGenericState(0));

    act(() => result.current[1](5));

    expect(result.current[0]).toBe(5);
  });

  it('accepts a functional updater for primitive state', () => {
    const { result } = renderHook(() => useGenericState(1));

    act(() => result.current[1]((prev) => prev + 1));

    expect(result.current[0]).toBe(2);
  });

  it('treats array state as a whole value, not key-value pairs', () => {
    const { result } = renderHook(() => useGenericState<string[]>(['a', 'b']));

    act(() => result.current[1](['c', 'd']));

    expect(result.current[0]).toEqual(['c', 'd']);
  });

  it('replaceState swaps the entire value even for object state', () => {
    const { result } = renderHook(() => useGenericState({ name: 'Jane', age: 30 }));

    act(() => result.current[2]({ name: 'Jo', age: 22 }));

    expect(result.current[0]).toEqual({ name: 'Jo', age: 22 });
  });

  it('replaceState accepts a functional updater', () => {
    const { result } = renderHook(() => useGenericState({ count: 1 }));

    act(() => result.current[2]((prev) => ({ count: prev.count + 10 })));

    expect(result.current[0]).toEqual({ count: 11 });
  });

  it('returns referentially stable setters across renders', () => {
    const { result, rerender } = renderHook(() => useGenericState({ a: 1 }));
    const [, updateStateFirst, replaceStateFirst] = result.current;

    rerender();

    expect(result.current[1]).toBe(updateStateFirst);
    expect(result.current[2]).toBe(replaceStateFirst);
  });
});
