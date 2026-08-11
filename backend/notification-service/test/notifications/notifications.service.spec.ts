import { NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { NotificationsService } from '../../src/notifications/notifications.service';

describe('NotificationsService', () => {
  let collection: {
    insertOne: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
    deleteOne: jest.Mock;
    createIndex: jest.Mock;
  };
  let db: { collection: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    collection = {
      insertOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      createIndex: jest.fn(),
    };
    db = { collection: jest.fn().mockReturnValue(collection) };
    service = new NotificationsService(db as any);
  });

  describe('create', () => {
    it('inserts a row with readAt: null and never throws on failure', async () => {
      collection.insertOne.mockRejectedValue(new Error('mongo down'));

      await expect(
        service.create({ userId: 'user-1', type: 'system', title: 'Hi', message: 'Hello', relatedId: null }),
      ).resolves.toBeUndefined();
    });

    it('inserts the row on success', async () => {
      collection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

      await service.create({ userId: 'user-1', type: 'course', title: 'Hi', message: 'Hello', relatedId: 'course-1' });

      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'course', readAt: null }),
      );
    });
  });

  describe('listForUser', () => {
    it('scopes the query to the given userId', async () => {
      const cursor = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), toArray: jest.fn().mockResolvedValue([]) };
      collection.find.mockReturnValue(cursor);
      collection.countDocuments.mockResolvedValue(0);

      await service.listForUser('user-1', {}, 1, 20);

      expect(collection.find).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    });

    it('adds readAt: null to the query when unreadOnly is set', async () => {
      const cursor = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), toArray: jest.fn().mockResolvedValue([]) };
      collection.find.mockReturnValue(cursor);
      collection.countDocuments.mockResolvedValue(0);

      await service.listForUser('user-1', { unreadOnly: true }, 1, 20);

      expect(collection.find).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', readAt: null }));
    });
  });

  describe('markRead', () => {
    it('marks the notification read when found and owned by the caller', async () => {
      collection.updateOne.mockResolvedValue({ matchedCount: 1 });

      await expect(service.markRead(new ObjectId().toHexString(), 'user-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when no matching row exists (wrong owner or unknown id)', async () => {
      collection.updateOne.mockResolvedValue({ matchedCount: 0 });

      await expect(service.markRead(new ObjectId().toHexString(), 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException (not a raw BSON error) for a malformed id', async () => {
      await expect(service.markRead('not-an-object-id', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(collection.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('scopes the update to the user and unread rows only', async () => {
      collection.updateMany.mockResolvedValue({ modifiedCount: 3 });

      await service.markAllRead('user-1');

      expect(collection.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', readAt: null },
        expect.objectContaining({ $set: expect.objectContaining({ readAt: expect.any(Date) }) }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when no matching row was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(service.remove(new ObjectId().toHexString(), 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('unreadCount', () => {
    it('counts only this user\'s unread rows', async () => {
      collection.countDocuments.mockResolvedValue(4);

      const count = await service.unreadCount('user-1');

      expect(count).toBe(4);
      expect(collection.countDocuments).toHaveBeenCalledWith({ userId: 'user-1', readAt: null });
    });
  });
});
