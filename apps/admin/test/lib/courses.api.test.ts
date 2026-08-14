import {describe, expect, it} from 'vitest';
import type {Course} from '../../lib/courses.api';
import {courseToFormValues, EMPTY_COURSE_FORM, toRequestBody, validateCourseForm} from '../../lib/courses.api';

describe('toRequestBody', () => {
  it('trims strings and converts empty optional fields to null', () => {
    const body = toRequestBody({ ...EMPTY_COURSE_FORM, title: '  Hello  ', subtitle: '  ', instructorName: 'Jane' });
    expect(body.title).toBe('Hello');
    expect(body.subtitle).toBeNull();
    expect(body.instructorName).toBe('Jane');
  });

  it('converts numeric strings, defaulting price to 0 and leaving discount unset', () => {
    const body = toRequestBody({ ...EMPTY_COURSE_FORM, price: '49.99', discountPrice: '' });
    expect(body.price).toBe(49.99);
    expect(body.discountPrice).toBeNull();
  });

  it('filters out blank learning objectives', () => {
    const body = toRequestBody({ ...EMPTY_COURSE_FORM, learningObjectives: ['Speak fluently', '  ', ''] });
    expect(body.learningObjectives).toEqual(['Speak fluently']);
  });

  it('defaults language to en and currency to USD when blank', () => {
    const body = toRequestBody({ ...EMPTY_COURSE_FORM, language: '', currency: '' });
    expect(body.language).toBe('en');
    expect(body.currency).toBe('USD');
  });
});

describe('validateCourseForm', () => {
  it('requires title, description, and instructor name', () => {
    const errors = validateCourseForm(EMPTY_COURSE_FORM);
    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.instructorName).toBeDefined();
  });

  it('rejects a negative or non-numeric price', () => {
    expect(validateCourseForm({ ...EMPTY_COURSE_FORM, price: '-5' }).price).toBeDefined();
    expect(validateCourseForm({ ...EMPTY_COURSE_FORM, price: 'abc' }).price).toBeDefined();
  });

  it('accepts a free (zero) price', () => {
    const errors = validateCourseForm({
      ...EMPTY_COURSE_FORM,
      title: 'T',
      description: 'D',
      instructorName: 'I',
      price: '0',
    });
    expect(errors.price).toBeUndefined();
  });

  it('rejects an invalid discount price but allows a blank one', () => {
    expect(validateCourseForm({ ...EMPTY_COURSE_FORM, discountPrice: '-1' }).discountPrice).toBeDefined();
    expect(validateCourseForm({ ...EMPTY_COURSE_FORM, discountPrice: '' }).discountPrice).toBeUndefined();
  });
});

describe('courseToFormValues', () => {
  it('round-trips nullable fields to empty strings', () => {
    const course: Course = {
      id: '1', slug: 'x', instructorId: 'u1', instructorName: 'Jane', instructorBio: null, instructorAvatarUrl: null,
      title: 'Title', subtitle: null, description: 'Desc', learningObjectives: [], targetAudience: null,
      prerequisites: null, categoryId: null, difficulty: 'beginner', language: 'en', estimatedDuration: null,
      status: 'draft', price: 0, discountPrice: null, discountExpiresAt: null, currency: 'USD', coverImageUrl: null,
      promoVideoUrl: null, enrollmentCount: 0, avgRating: null, reviewCount: 0, version: 1, publishedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const values = courseToFormValues(course);
    expect(values.subtitle).toBe('');
    expect(values.categoryId).toBe('');
    expect(values.price).toBe('0');
  });
});
