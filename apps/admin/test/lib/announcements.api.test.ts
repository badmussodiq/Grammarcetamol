import {describe, expect, it} from 'vitest';
import {
  type Announcement,
  buildAnnouncementQuery,
  canEditAnnouncement,
  EMPTY_ANNOUNCEMENT_FORM,
  announcementToFormValues,
  formatTargetAudience,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  toAnnouncementRequestBody,
  validateAnnouncementForm,
} from '@/lib/announcements.api';

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    title: 'Maintenance window',
    body: 'We will be down for maintenance.',
    targetType: 'all',
    targetIds: [],
    priority: 'normal',
    status: 'draft',
    publishAt: null,
    expiresAt: null,
    createdBy: 'admin-1',
    publishedAt: null,
    recipientCount: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildAnnouncementQuery', () => {
  it('always sets page/limit, omits status when unset', () => {
    const qs = buildAnnouncementQuery({});
    const params = new URLSearchParams(qs);
    expect(params.get('page')).toBe('1');
    expect(params.get('limit')).toBe('20');
    expect(params.has('status')).toBe(false);
  });

  it('includes status and page when set', () => {
    const qs = buildAnnouncementQuery({ status: 'published', page: 3 });
    const params = new URLSearchParams(qs);
    expect(params.get('status')).toBe('published');
    expect(params.get('page')).toBe('3');
  });
});

describe('formatTargetAudience', () => {
  it('labels "all" without a count', () => {
    expect(formatTargetAudience(announcement({ targetType: 'all', targetIds: [] }))).toBe('All Students');
  });

  it('appends the selection count for courses/segments', () => {
    expect(formatTargetAudience(announcement({ targetType: 'courses', targetIds: ['c1', 'c2', 'c3'] }))).toBe('Specific Courses (3)');
    expect(formatTargetAudience(announcement({ targetType: 'segments', targetIds: ['s1'] }))).toBe('Specific Segments (1)');
  });
});

describe('validateAnnouncementForm', () => {
  it('requires title and body', () => {
    const errors = validateAnnouncementForm(EMPTY_ANNOUNCEMENT_FORM);
    expect(errors.title).toBeDefined();
    expect(errors.body).toBeDefined();
  });

  it('requires at least one selected course when targeting courses', () => {
    const errors = validateAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM, title: 't', body: 'b', targetType: 'courses', targetIds: [] });
    expect(errors.targetIds).toBeDefined();
  });

  it('passes with courses selected', () => {
    const errors = validateAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM, title: 't', body: 'b', targetType: 'courses', targetIds: ['c1'] });
    expect(errors.targetIds).toBeUndefined();
  });

  it('requires a publishAt when scheduling for later', () => {
    const errors = validateAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM, title: 't', body: 'b', schedule: 'later', publishAt: '' });
    expect(errors.publishAt).toBeDefined();
  });
});

describe('toAnnouncementRequestBody', () => {
  it('trims title/body', () => {
    const body = toAnnouncementRequestBody({ ...EMPTY_ANNOUNCEMENT_FORM, title: '  Hi  ', body: '  There  ' });
    expect(body.title).toBe('Hi');
    expect(body.body).toBe('There');
  });

  it('omits targetIds unless targetType is courses', () => {
    const body = toAnnouncementRequestBody({ ...EMPTY_ANNOUNCEMENT_FORM, targetType: 'all', targetIds: ['leftover'] });
    expect(body.targetIds).toBeUndefined();
  });

  it('includes targetIds for courses', () => {
    const body = toAnnouncementRequestBody({ ...EMPTY_ANNOUNCEMENT_FORM, targetType: 'courses', targetIds: ['c1', 'c2'] });
    expect(body.targetIds).toEqual(['c1', 'c2']);
  });

  it('sets publishAt only when scheduling for later', () => {
    const draft = toAnnouncementRequestBody({ ...EMPTY_ANNOUNCEMENT_FORM, schedule: 'draft' });
    expect(draft.publishAt).toBeUndefined();

    const now = toAnnouncementRequestBody({ ...EMPTY_ANNOUNCEMENT_FORM, schedule: 'now' });
    expect(now.publishAt).toBeUndefined();

    const later = toAnnouncementRequestBody({ ...EMPTY_ANNOUNCEMENT_FORM, schedule: 'later', publishAt: '2026-09-01T10:00' });
    expect(later.publishAt).toBe(new Date('2026-09-01T10:00').toISOString());
  });
});

describe('PRIORITY_BADGE_VARIANT / STATUS_BADGE_VARIANT', () => {
  it('maps every priority to a distinct-enough badge variant, critical/high reading as more severe than low/normal', () => {
    expect(PRIORITY_BADGE_VARIANT.low).toBe('neutral');
    expect(PRIORITY_BADGE_VARIANT.normal).toBe('info');
    expect(PRIORITY_BADGE_VARIANT.high).toBe('warning');
    expect(PRIORITY_BADGE_VARIANT.critical).toBe('error');
  });

  it('maps every status to a badge variant, published reading as the positive/success state', () => {
    expect(STATUS_BADGE_VARIANT.draft).toBe('neutral');
    expect(STATUS_BADGE_VARIANT.scheduled).toBe('info');
    expect(STATUS_BADGE_VARIANT.published).toBe('success');
    expect(STATUS_BADGE_VARIANT.expired).toBe('neutral');
  });
});

describe('canEditAnnouncement', () => {
  it('allows editing only while still a draft', () => {
    expect(canEditAnnouncement('draft')).toBe(true);
    expect(canEditAnnouncement('scheduled')).toBe(false);
    expect(canEditAnnouncement('published')).toBe(false);
    expect(canEditAnnouncement('expired')).toBe(false);
  });
});

describe('announcementToFormValues', () => {
  it('marks a publishAt-bearing announcement as scheduled for later', () => {
    const values = announcementToFormValues(announcement({ publishAt: '2026-09-01T10:00:00.000Z' }));
    expect(values.schedule).toBe('later');
    expect(values.publishAt).toBe('2026-09-01T10:00');
  });

  it('marks a publishAt-less announcement as draft', () => {
    const values = announcementToFormValues(announcement({ publishAt: null }));
    expect(values.schedule).toBe('draft');
    expect(values.publishAt).toBe('');
  });
});
