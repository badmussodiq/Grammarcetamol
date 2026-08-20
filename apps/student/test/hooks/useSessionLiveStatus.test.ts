import {describe, expect, it} from 'vitest';
import {classifyRoomError, isTerminalSessionState, nextPollDelayMs} from '@/hooks/useSessionLiveStatus';

describe('classifyRoomError', () => {
  it('maps each of the backend\'s four known denial messages to its state', () => {
    expect(classifyRoomError('This session has not started yet')).toBe('not-live');
    expect(classifyRoomError('This session has already ended')).toBe('ended');
    expect(classifyRoomError('You are not enrolled in this class')).toBe('not-enrolled');
    expect(classifyRoomError('Access to this class requires an accepted invitation')).toBe('invite-not-accepted');
  });

  it('falls back to a generic error state for anything unrecognized', () => {
    expect(classifyRoomError('Some unexpected 500 message')).toBe('error');
    expect(classifyRoomError('')).toBe('error');
  });
});

describe('isTerminalSessionState', () => {
  it('treats ended/not-enrolled/invite-not-accepted as terminal — polling should stop', () => {
    expect(isTerminalSessionState('ended')).toBe(true);
    expect(isTerminalSessionState('not-enrolled')).toBe(true);
    expect(isTerminalSessionState('invite-not-accepted')).toBe(true);
  });

  it('treats not-live/live/error as non-terminal — polling continues', () => {
    expect(isTerminalSessionState('not-live')).toBe(false);
    expect(isTerminalSessionState('live')).toBe(false);
    expect(isTerminalSessionState('error')).toBe(false);
  });
});

describe('nextPollDelayMs', () => {
  it('polls infrequently when the session is hours away', () => {
    expect(nextPollDelayMs(2 * 60 * 60_000)).toBe(5 * 60_000);
  });

  it('polls more often as the session approaches within 30 minutes', () => {
    expect(nextPollDelayMs(20 * 60_000)).toBe(30_000);
  });

  it('polls tightly within 5 minutes of start, or once already started', () => {
    expect(nextPollDelayMs(4 * 60_000)).toBe(5_000);
    expect(nextPollDelayMs(-1000)).toBe(5_000);
  });
});
