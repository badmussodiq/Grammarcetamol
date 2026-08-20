import {describe, expect, it} from 'vitest';
import {
  buildClassQuery,
  type ClassSchedule,
  classToFormValues,
  EMPTY_CLASS_FORM,
  findScheduleConflicts,
  type LiveClass,
  toClassRequestBody,
  validateClassForm,
} from '@/lib/classes.api';

describe('buildClassQuery', () => {
  it('omits unset filters', () => {
    expect(buildClassQuery({})).toBe('');
  });

  it('includes every set filter', () => {
    const qs = buildClassQuery({ classType: 'GROUP', accessMode: 'OPEN', instructorId: 'admin-1', search: 'math' });
    const params = new URLSearchParams(qs);
    expect(params.get('classType')).toBe('GROUP');
    expect(params.get('accessMode')).toBe('OPEN');
    expect(params.get('instructorId')).toBe('admin-1');
    expect(params.get('search')).toBe('math');
  });
});

describe('toClassRequestBody', () => {
  it('trims title/description and defaults currency when blank', () => {
    const body = toClassRequestBody({ ...EMPTY_CLASS_FORM, title: '  Saturday Revision  ', currency: '' });
    expect(body.title).toBe('Saturday Revision');
    expect(body.currency).toBe('NGN');
  });

  it('nulls out defaultPrice/billingInterval for a FREE class regardless of leftover form state', () => {
    const body = toClassRequestBody({ ...EMPTY_CLASS_FORM, paymentModel: 'FREE', defaultPrice: '5000', billingInterval: 'monthly' });
    expect(body.defaultPrice).toBeNull();
    expect(body.billingInterval).toBeNull();
  });

  it('keeps defaultPrice for ONE_TIME and billingInterval for RECURRING', () => {
    const oneTime = toClassRequestBody({ ...EMPTY_CLASS_FORM, paymentModel: 'ONE_TIME', defaultPrice: '25000' });
    expect(oneTime.defaultPrice).toBe(25000);
    expect(oneTime.billingInterval).toBeNull();

    const recurring = toClassRequestBody({ ...EMPTY_CLASS_FORM, paymentModel: 'RECURRING', defaultPrice: '10000', billingInterval: 'weekly' });
    expect(recurring.defaultPrice).toBe(10000);
    expect(recurring.billingInterval).toBe('weekly');
  });

  it('only sends capacity for GROUP classes with a value set', () => {
    expect(toClassRequestBody({ ...EMPTY_CLASS_FORM, classType: 'GROUP', capacity: '30' }).capacity).toBe(30);
    expect(toClassRequestBody({ ...EMPTY_CLASS_FORM, classType: 'PRIVATE', capacity: '30' }).capacity).toBeNull();
    expect(toClassRequestBody({ ...EMPTY_CLASS_FORM, classType: 'GROUP', capacity: '' }).capacity).toBeNull();
  });

  it('defaults materialsRetentionDays to 14 when blank', () => {
    expect(toClassRequestBody({ ...EMPTY_CLASS_FORM, materialsRetentionDays: '' }).materialsRetentionDays).toBe(14);
  });
});

describe('validateClassForm', () => {
  it('requires title, description, and instructor', () => {
    const errors = validateClassForm(EMPTY_CLASS_FORM);
    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.instructorId).toBeDefined();
  });

  it('does not require a price for FREE classes', () => {
    const errors = validateClassForm({ ...EMPTY_CLASS_FORM, title: 'x', description: 'x', instructorId: 'a', paymentModel: 'FREE' });
    expect(errors.defaultPrice).toBeUndefined();
  });

  it('requires a positive price for ONE_TIME/RECURRING classes', () => {
    const base = { ...EMPTY_CLASS_FORM, title: 'x', description: 'x', instructorId: 'a' };
    expect(validateClassForm({ ...base, paymentModel: 'ONE_TIME', defaultPrice: '' }).defaultPrice).toBeDefined();
    expect(validateClassForm({ ...base, paymentModel: 'ONE_TIME', defaultPrice: '0' }).defaultPrice).toBeDefined();
    expect(validateClassForm({ ...base, paymentModel: 'ONE_TIME', defaultPrice: '5000' }).defaultPrice).toBeUndefined();
  });

  it('requires a billing interval for RECURRING classes only', () => {
    const base = { ...EMPTY_CLASS_FORM, title: 'x', description: 'x', instructorId: 'a', defaultPrice: '5000' };
    expect(validateClassForm({ ...base, paymentModel: 'RECURRING', billingInterval: '' }).billingInterval).toBeDefined();
    expect(validateClassForm({ ...base, paymentModel: 'ONE_TIME', billingInterval: '' }).billingInterval).toBeUndefined();
  });

  it('rejects a non-positive capacity for GROUP classes, but allows it blank (unlimited)', () => {
    const base = { ...EMPTY_CLASS_FORM, title: 'x', description: 'x', instructorId: 'a', classType: 'GROUP' as const };
    expect(validateClassForm({ ...base, capacity: '0' }).capacity).toBeDefined();
    expect(validateClassForm({ ...base, capacity: '' }).capacity).toBeUndefined();
    expect(validateClassForm({ ...base, capacity: '20' }).capacity).toBeUndefined();
  });
});

describe('findScheduleConflicts', () => {
  function schedule(overrides: Partial<ClassSchedule> = {}): ClassSchedule {
    return { dayOfWeek: 1, startTime: '15:00', endTime: '16:00', timezone: 'UTC', effectiveFrom: '', effectiveUntil: null, ...overrides };
  }

  it('flags a schedule row overlapping a busy period on the same day-of-week', () => {
    const busy = [{ sessionId: 's1', startTime: '2026-09-07T15:30:00.000Z', endTime: '2026-09-07T16:30:00.000Z' }]; // a Monday
    const conflicts = findScheduleConflicts([schedule({ dayOfWeek: 1 })], busy);
    expect(conflicts).toHaveLength(1);
  });

  it('does not flag a different day-of-week even at the same time', () => {
    const busy = [{ sessionId: 's1', startTime: '2026-09-08T15:30:00.000Z', endTime: '2026-09-08T16:30:00.000Z' }]; // a Tuesday
    const conflicts = findScheduleConflicts([schedule({ dayOfWeek: 1 })], busy);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag an adjacent, non-overlapping time on the same day', () => {
    const busy = [{ sessionId: 's1', startTime: '2026-09-07T16:00:00.000Z', endTime: '2026-09-07T17:00:00.000Z' }];
    const conflicts = findScheduleConflicts([schedule({ dayOfWeek: 1, startTime: '15:00', endTime: '16:00' })], busy);
    expect(conflicts).toHaveLength(0);
  });

  it('returns no conflicts when there are no busy periods', () => {
    expect(findScheduleConflicts([schedule()], [])).toEqual([]);
  });
});

describe('classToFormValues', () => {
  it('round-trips a class into editable form state', () => {
    const cls: LiveClass = {
      id: 'class-1',
      title: 'Saturday Revision',
      description: 'Weekly review',
      coverImageUrl: null,
      classType: 'GROUP',
      accessMode: 'OPEN',
      instructorId: 'admin-1',
      paymentModel: 'RECURRING',
      defaultPrice: 10000,
      currency: 'NGN',
      billingInterval: 'monthly',
      capacity: 30,
      status: 'ACTIVE',
      chatLocked: true,
      materialsRetentionDays: 14,
      videoProvider: 'jitsi',
      schedules: [],
      createdBy: 'admin-1',
      endedAt: null,
      createdAt: '',
      updatedAt: '',
    };
    const values = classToFormValues(cls);
    expect(values.title).toBe('Saturday Revision');
    expect(values.defaultPrice).toBe('10000');
    expect(values.capacity).toBe('30');
    expect(values.billingInterval).toBe('monthly');
  });
});
