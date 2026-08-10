import { NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { SupportService } from '../../src/support/support.service';
import { NotificationSenderService } from '../../src/sender/notification-sender.service';

describe('SupportService', () => {
  let collection: {
    insertOne: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    findOne: jest.Mock;
    updateOne: jest.Mock;
    createIndex: jest.Mock;
  };
  let db: { collection: jest.Mock };
  let sender: { send: jest.Mock };
  let service: SupportService;

  beforeEach(() => {
    collection = {
      insertOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      createIndex: jest.fn(),
    };
    db = { collection: jest.fn().mockReturnValue(collection) };
    sender = { send: jest.fn().mockResolvedValue(undefined) };
    service = new SupportService(db as any, sender as unknown as NotificationSenderService);
  });

  describe('create', () => {
    it('inserts an open ticket and sends the submitted-confirmation email', async () => {
      const insertedId = new ObjectId();
      collection.insertOne.mockResolvedValue({ insertedId });

      const ticket = await service.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        userId: null,
        subject: 'Cannot access course',
        message: 'Help please',
        courseId: null,
      });

      expect(ticket.status).toBe('open');
      expect(ticket._id).toBe(insertedId);
      expect(sender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: 'support-ticket-submitted',
          to: 'jane@example.com',
          toName: 'Jane Doe',
          variables: expect.objectContaining({ ticketSubject: 'Cannot access course' }),
        }),
      );
    });

    it('links the ticket to a logged-in user when userId is present', async () => {
      const insertedId = new ObjectId();
      collection.insertOne.mockResolvedValue({ insertedId });

      const ticket = await service.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        userId: 'user-1',
        subject: 'Question',
        message: 'Hi',
        courseId: 'course-1',
      });

      expect(ticket.userId).toBe('user-1');
      expect(ticket.courseId).toBe('course-1');
    });
  });

  describe('close', () => {
    it('marks an open ticket closed, records who closed it, and sends the closed email', async () => {
      const id = new ObjectId();
      const openTicket = {
        _id: id,
        name: 'Jane Doe',
        email: 'jane@example.com',
        userId: null,
        subject: 'Cannot access course',
        message: 'Help please',
        courseId: null,
        status: 'open' as const,
        closedBy: null,
        closedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const closedTicket = { ...openTicket, status: 'closed' as const, closedBy: 'admin-1', closedAt: new Date() };
      collection.findOne.mockResolvedValueOnce(openTicket).mockResolvedValueOnce(closedTicket);

      const result = await service.close(id.toHexString(), 'admin-1');

      expect(result.status).toBe('closed');
      expect(collection.updateOne).toHaveBeenCalledWith(
        { _id: id },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'closed', closedBy: 'admin-1' }) }),
      );
      expect(sender.send).toHaveBeenCalledWith(
        expect.objectContaining({ templateName: 'support-ticket-closed', to: 'jane@example.com' }),
      );
    });

    it('is a no-op (no duplicate email) when the ticket is already closed', async () => {
      const id = new ObjectId();
      const closedTicket = {
        _id: id, name: 'Jane Doe', email: 'jane@example.com', userId: null, subject: 'x', message: 'x',
        courseId: null, status: 'closed' as const, closedBy: 'admin-1', closedAt: new Date(),
        createdAt: new Date(), updatedAt: new Date(),
      };
      collection.findOne.mockResolvedValue(closedTicket);

      const result = await service.close(id.toHexString(), 'admin-2');

      expect(result.status).toBe('closed');
      expect(collection.updateOne).not.toHaveBeenCalled();
      expect(sender.send).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown ticket id', async () => {
      collection.findOne.mockResolvedValue(null);

      await expect(service.close(new ObjectId().toHexString(), 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('filters by status and paginates', async () => {
      const cursor = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), toArray: jest.fn().mockResolvedValue([]) };
      collection.find.mockReturnValue(cursor);
      collection.countDocuments.mockResolvedValue(0);

      const result = await service.list({ status: 'open' }, 2, 10);

      expect(collection.find).toHaveBeenCalledWith({ status: 'open' });
      expect(cursor.skip).toHaveBeenCalledWith(10);
      expect(cursor.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ items: [], page: 2, limit: 10, total: 0, totalPages: 0 });
    });
  });
});
