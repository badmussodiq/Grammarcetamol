import {PreferencesService} from '@/preferences/preferences.service';
import {DEFAULT_PREFERENCES} from '@/preferences/preference.types';

describe('PreferencesService', () => {
  let collection: { findOne: jest.Mock; updateOne: jest.Mock; createIndex: jest.Mock };
  let db: { collection: jest.Mock };
  let service: PreferencesService;

  beforeEach(() => {
    collection = { findOne: jest.fn(), updateOne: jest.fn(), createIndex: jest.fn() };
    db = { collection: jest.fn().mockReturnValue(collection) };
    service = new PreferencesService(db as any);
  });

  it('defaults every type to fully opted-in when no document exists', async () => {
    collection.findOne.mockResolvedValue(null);
    const prefs = await service.getFor('user-1');
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns the stored preferences when a document exists', async () => {
    const stored = { course: { inApp: false, email: false }, payment: { inApp: true, email: true }, live_class: { inApp: true, email: true }, announcement: { inApp: true, email: true } };
    collection.findOne.mockResolvedValue({ userId: 'user-1', preferences: stored });
    const prefs = await service.getFor('user-1');
    expect(prefs).toEqual(stored);
  });

  describe('isEnabled', () => {
    it('always returns true for system-type notifications, regardless of stored preferences', async () => {
      collection.findOne.mockResolvedValue({ userId: 'user-1', preferences: { course: { inApp: false, email: false } } });
      await expect(service.isEnabled('user-1', 'system', 'email')).resolves.toBe(true);
      expect(collection.findOne).not.toHaveBeenCalled();
    });

    it('respects a stored false for a non-system type/channel', async () => {
      collection.findOne.mockResolvedValue({ userId: 'user-1', preferences: { ...DEFAULT_PREFERENCES, course: { inApp: false, email: true } } });
      await expect(service.isEnabled('user-1', 'course', 'inApp')).resolves.toBe(false);
      await expect(service.isEnabled('user-1', 'course', 'email')).resolves.toBe(true);
    });
  });

  it('update upserts and returns the merged preferences', async () => {
    collection.updateOne.mockResolvedValue({});
    const result = await service.update('user-1', DEFAULT_PREFERENCES);
    expect(collection.updateOne).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ $set: expect.objectContaining({ preferences: DEFAULT_PREFERENCES }) }),
      { upsert: true },
    );
    expect(result).toEqual(DEFAULT_PREFERENCES);
  });
});
