import {describe, expect, it} from 'vitest';
import {parseLearningGoals} from '../../lib/profile.api';

describe('parseLearningGoals', () => {
  it('splits a comma-separated string into a trimmed array', () => {
    expect(parseLearningGoals('IELTS, Business English,  Writing')).toEqual(['IELTS', 'Business English', 'Writing']);
  });

  it('drops blank entries from stray commas or whitespace', () => {
    expect(parseLearningGoals('IELTS,, , Business English,')).toEqual(['IELTS', 'Business English']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseLearningGoals('')).toEqual([]);
  });
});
