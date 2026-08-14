import {describe, expect, it} from 'vitest';
import {greetingForHour} from '../../lib/dashboard';

describe('greetingForHour', () => {
  it('greets morning hours', () => {
    expect(greetingForHour(9)).toBe('Good morning');
  });

  it('greets afternoon hours', () => {
    expect(greetingForHour(14)).toBe('Good afternoon');
  });

  it('greets evening hours', () => {
    expect(greetingForHour(20)).toBe('Good evening');
  });

  it('treats midnight as morning', () => {
    expect(greetingForHour(0)).toBe('Good morning');
  });

  it('boundary: 11 is morning, 12 is afternoon', () => {
    expect(greetingForHour(11)).toBe('Good morning');
    expect(greetingForHour(12)).toBe('Good afternoon');
  });

  it('boundary: 17 is afternoon, 18 is evening', () => {
    expect(greetingForHour(17)).toBe('Good afternoon');
    expect(greetingForHour(18)).toBe('Good evening');
  });
});
