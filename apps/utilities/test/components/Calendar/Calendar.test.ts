import {describe, expect, it} from 'vitest';
import {defaultEventColor, toFullCalendarEvent} from '../../../src/components/Calendar/Calendar';

describe('defaultEventColor', () => {
  it('assigns a distinct color per known session status', () => {
    const colors = new Set(['LIVE', 'SCHEDULED', 'ENDED', 'CANCELLED'].map(defaultEventColor));
    expect(colors.size).toBe(4);
  });

  it('falls back to a neutral color for an unrecognized status', () => {
    expect(defaultEventColor('SOMETHING_UNKNOWN')).toBe('#64748B');
  });
});

describe('toFullCalendarEvent', () => {
  const event = { id: 'session-1', title: 'Primary 4 Mathematics', start: '2026-09-01T15:00:00.000Z', end: '2026-09-01T16:00:00.000Z', status: 'SCHEDULED' };

  it('maps id/title/start/end straight through', () => {
    const fc = toFullCalendarEvent(event);
    expect(fc.id).toBe('session-1');
    expect(fc.title).toBe('Primary 4 Mathematics');
    expect(fc.start).toBe('2026-09-01T15:00:00.000Z');
    expect(fc.end).toBe('2026-09-01T16:00:00.000Z');
  });

  it('colors the event using defaultEventColor when no override is given', () => {
    const fc = toFullCalendarEvent(event);
    expect(fc.color).toBe(defaultEventColor('SCHEDULED'));
  });

  it('uses a supplied color function instead of the default when given one', () => {
    const fc = toFullCalendarEvent(event, () => '#FF00FF');
    expect(fc.color).toBe('#FF00FF');
  });
});
