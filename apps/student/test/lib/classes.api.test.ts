import {describe, expect, it} from 'vitest';
import {
  buildClassQuery,
  formatCapacity,
  formatClassPrice,
  formatScheduleSummary,
  resolveClassCardAction,
  type ClassSchedule,
  type Enrollment,
  type LiveClass,
} from '@/lib/classes.api';

function schedule(overrides: Partial<ClassSchedule> = {}): ClassSchedule {
  return {
    dayOfWeek: 1,
    startTime: '15:00',
    endTime: '16:00',
    timezone: 'UTC',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
    ...overrides,
  };
}

describe('buildClassQuery', () => {
  it('omits unset filters', () => {
    expect(buildClassQuery({})).toBe('');
  });

  it('includes classType and search when set', () => {
    const qs = buildClassQuery({ classType: 'GROUP', search: 'math' });
    const params = new URLSearchParams(qs);
    expect(params.get('classType')).toBe('GROUP');
    expect(params.get('search')).toBe('math');
  });
});

describe('formatScheduleSummary', () => {
  it('returns a fallback when there are no schedules yet', () => {
    expect(formatScheduleSummary([])).toBe('Schedule to be announced');
  });

  it('formats a single weekly schedule with its timezone', () => {
    expect(formatScheduleSummary([schedule()])).toBe('Mon 15:00–16:00 (UTC)');
  });

  it('groups multiple days sharing the same time into one line', () => {
    const summary = formatScheduleSummary([
      schedule({ dayOfWeek: 1 }),
      schedule({ dayOfWeek: 3 }),
    ]);
    expect(summary).toBe('Mon, Wed 15:00–16:00 (UTC)');
  });

  it('separates distinct time slots with a middle dot', () => {
    const summary = formatScheduleSummary([
      schedule({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }),
      schedule({ dayOfWeek: 6, startTime: '11:00', endTime: '12:00' }),
    ]);
    expect(summary).toBe('Mon 09:00–10:00 · Sat 11:00–12:00 (UTC)');
  });

  it('omits the timezone suffix when schedules disagree on timezone', () => {
    const summary = formatScheduleSummary([
      schedule({ dayOfWeek: 1, timezone: 'UTC' }),
      schedule({ dayOfWeek: 2, timezone: 'WAT' }),
    ]);
    expect(summary).not.toContain('(');
  });
});

describe('formatCapacity', () => {
  it('reports unlimited when capacity is null', () => {
    expect(formatCapacity(null)).toBe('Unlimited spots');
  });

  it('pluralizes correctly', () => {
    expect(formatCapacity(1)).toBe('Limited to 1 student');
    expect(formatCapacity(30)).toBe('Limited to 30 students');
  });
});

describe('formatClassPrice', () => {
  it('shows Free for FREE classes regardless of any leftover defaultPrice', () => {
    expect(formatClassPrice({ paymentModel: 'FREE', defaultPrice: 5000, currency: 'NGN', billingInterval: null })).toBe('Free');
  });

  it('formats a one-time price as currency', () => {
    expect(formatClassPrice({ paymentModel: 'ONE_TIME', defaultPrice: 25000, currency: 'NGN', billingInterval: null })).toContain('25,000');
  });

  it('appends the billing interval for recurring classes', () => {
    const price = formatClassPrice({ paymentModel: 'RECURRING', defaultPrice: 10000, currency: 'NGN', billingInterval: 'monthly' });
    expect(price).toContain('/monthly');
  });

  it('falls back to "Price on request" when a paid class somehow has no defaultPrice', () => {
    expect(formatClassPrice({ paymentModel: 'ONE_TIME', defaultPrice: null, currency: 'NGN', billingInterval: null })).toBe('Price on request');
  });
});

describe('resolveClassCardAction', () => {
  const baseClass: LiveClass = {
    id: 'class-1',
    title: 'Test Class',
    description: '',
    coverImageUrl: null,
    classType: 'GROUP',
    accessMode: 'OPEN',
    instructorId: 'instructor-1',
    paymentModel: 'FREE',
    defaultPrice: null,
    currency: 'NGN',
    billingInterval: null,
    capacity: null,
    status: 'ACTIVE',
    chatLocked: true,
    materialsRetentionDays: 14,
    videoProvider: 'jitsi',
    schedules: [],
    createdAt: '',
    updatedAt: '',
  };

  const baseEnrollment: Enrollment = {
    id: 'enrollment-1',
    classId: 'class-1',
    studentId: 'student-1',
    status: 'ACTIVE',
    negotiatedPrice: null,
    subscriptionId: null,
    paymentId: null,
    accessUntil: '2100-01-01T00:00:00.000Z',
    invitationId: null,
    enrolledAt: '',
    endedAt: null,
    endedReason: null,
  };

  it('offers Enter Classroom for an ACTIVE enrollment, regardless of payment model', () => {
    expect(resolveClassCardAction(baseClass, baseEnrollment)).toBe('enter-classroom');
  });

  it('offers Enter Classroom for a PAUSED enrollment too', () => {
    expect(resolveClassCardAction(baseClass, { ...baseEnrollment, status: 'PAUSED' })).toBe('enter-classroom');
  });

  it('offers Payment Pending for a PENDING_PAYMENT enrollment', () => {
    expect(resolveClassCardAction(baseClass, { ...baseEnrollment, status: 'PENDING_PAYMENT' })).toBe('payment-pending');
  });

  it('offers Enroll for Free when there is no enrollment and the class is FREE', () => {
    expect(resolveClassCardAction(baseClass, undefined)).toBe('enroll-free');
  });

  it('offers Buy for a ONE_TIME class with no enrollment', () => {
    expect(resolveClassCardAction({ ...baseClass, paymentModel: 'ONE_TIME' }, undefined)).toBe('buy');
  });

  it('offers Subscribe for a RECURRING class with no enrollment', () => {
    expect(resolveClassCardAction({ ...baseClass, paymentModel: 'RECURRING' }, undefined)).toBe('subscribe');
  });

  it('treats a CANCELLED/EXPIRED enrollment as no enrollment at all, offering the normal buy/enroll action', () => {
    expect(resolveClassCardAction(baseClass, { ...baseEnrollment, status: 'EXPIRED' })).toBe('enroll-free');
  });

  it('reports Ended once the class itself has ended, even with no enrollment', () => {
    expect(resolveClassCardAction({ ...baseClass, status: 'ENDED' }, undefined)).toBe('ended');
  });
});
