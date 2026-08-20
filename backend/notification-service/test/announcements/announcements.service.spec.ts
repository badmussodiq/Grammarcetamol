import {ConflictException} from '@nestjs/common';
import {ObjectId} from 'mongodb';
import {AnnouncementsService} from '@/announcements/announcements.service';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {EnrollmentServiceClient} from '@/clients/enrollment-service.client';
import {NotificationSenderService} from '@/sender/notification-sender.service';
import {NotificationsService} from '@/notifications/notifications.service';

function announcementDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new ObjectId(),
    title: 'Platform maintenance',
    body: 'We will be down for 10 minutes tonight.',
    targetType: 'all',
    targetIds: [],
    priority: 'normal',
    status: 'draft',
    publishAt: null,
    expiresAt: null,
    createdBy: 'admin-1',
    publishedAt: null,
    recipientCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AnnouncementsService', () => {
  let collection: { insertOne: jest.Mock; findOne: jest.Mock; updateOne: jest.Mock; updateMany: jest.Mock; deleteOne: jest.Mock; find: jest.Mock; countDocuments: jest.Mock; createIndex: jest.Mock };
  let cursor: { sort: jest.Mock; skip: jest.Mock; limit: jest.Mock; toArray: jest.Mock };
  let db: { collection: jest.Mock };
  let authServiceClient: { listActiveStudents: jest.Mock; getUser: jest.Mock };
  let enrollmentServiceClient: { getEnrolledUserIds: jest.Mock };
  let notifications: { create: jest.Mock };
  let sender: { send: jest.Mock };
  let service: AnnouncementsService;

  beforeEach(() => {
    cursor = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), toArray: jest.fn().mockResolvedValue([]) };
    collection = {
      insertOne: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      find: jest.fn().mockReturnValue(cursor),
      countDocuments: jest.fn().mockResolvedValue(0),
      createIndex: jest.fn(),
    };
    db = { collection: jest.fn().mockReturnValue(collection) };
    authServiceClient = { listActiveStudents: jest.fn(), getUser: jest.fn() };
    enrollmentServiceClient = { getEnrolledUserIds: jest.fn() };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    sender = { send: jest.fn().mockResolvedValue(undefined) };

    service = new AnnouncementsService(
      db as any,
      authServiceClient as unknown as AuthServiceClient,
      enrollmentServiceClient as unknown as EnrollmentServiceClient,
      notifications as unknown as NotificationsService,
      sender as unknown as NotificationSenderService,
    );
  });

  describe('audience resolution per targetType', () => {
    it("'all' resolves via AuthServiceClient.listActiveStudents", async () => {
      collection.findOne.mockResolvedValue(announcementDoc({ targetType: 'all' }));
      authServiceClient.listActiveStudents.mockResolvedValue([{ id: 'u1', email: 'a@b.com', fullName: 'A' }, { id: 'u2', email: 'c@d.com', fullName: 'C' }]);

      const count = await service.recipientCount('507f1f77bcf86cd799439011');

      expect(count).toBe(2);
      expect(enrollmentServiceClient.getEnrolledUserIds).not.toHaveBeenCalled();
    });

    it("'courses' resolves via EnrollmentServiceClient then enriches each id via AuthServiceClient", async () => {
      collection.findOne.mockResolvedValue(announcementDoc({ targetType: 'courses', targetIds: ['course-1'] }));
      enrollmentServiceClient.getEnrolledUserIds.mockResolvedValue(['u1', 'u2']);
      authServiceClient.getUser.mockImplementation((id: string) => Promise.resolve({ id, email: `${id}@x.com`, fullName: id }));

      const count = await service.recipientCount('507f1f77bcf86cd799439011');

      expect(enrollmentServiceClient.getEnrolledUserIds).toHaveBeenCalledWith(['course-1']);
      expect(count).toBe(2);
    });

    it("'segments' is a documented no-op — always resolves to zero recipients, never errors", async () => {
      collection.findOne.mockResolvedValue(announcementDoc({ targetType: 'segments', targetIds: ['whales'] }));

      const count = await service.recipientCount('507f1f77bcf86cd799439011');

      expect(count).toBe(0);
      expect(authServiceClient.listActiveStudents).not.toHaveBeenCalled();
      expect(enrollmentServiceClient.getEnrolledUserIds).not.toHaveBeenCalled();
    });
  });

  describe('recipient-count matches a real publish\'s fan-out', () => {
    it('the count returned by recipientCount equals the number of recipients doPublish actually processes', async () => {
      const recipients = [{ id: 'u1', email: 'a@b.com', fullName: 'A' }, { id: 'u2', email: 'c@d.com', fullName: 'C' }];
      const announcement = announcementDoc({ targetType: 'all', priority: 'low' });
      collection.findOne.mockResolvedValue(announcement);
      authServiceClient.listActiveStudents.mockResolvedValue(recipients);

      const dryRunCount = await service.recipientCount('507f1f77bcf86cd799439011');
      await service.publish('507f1f77bcf86cd799439011');

      expect(dryRunCount).toBe(2);
      expect(notifications.create).toHaveBeenCalledTimes(2); // low priority -> in-app only, one per recipient
      const updateCall = collection.updateOne.mock.calls.find((c) => c[1].$set?.recipientCount !== undefined);
      expect(updateCall[1].$set.recipientCount).toBe(2);
    });
  });

  describe('priority gates email — high/critical send, low/normal do not', () => {
    it.each(['low', 'normal'] as const)('%s priority writes in-app only, never calls the email sender', async (priority) => {
      const announcement = announcementDoc({ priority, targetType: 'all' });
      collection.findOne.mockResolvedValue(announcement);
      authServiceClient.listActiveStudents.mockResolvedValue([{ id: 'u1', email: 'a@b.com', fullName: 'A' }]);

      await service.publish('507f1f77bcf86cd799439011');

      expect(sender.send).not.toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'announcement' }));
    });

    it.each(['high', 'critical'] as const)('%s priority routes through the sender (email + in-app + log, respecting preferences)', async (priority) => {
      const announcement = announcementDoc({ priority, targetType: 'all' });
      collection.findOne.mockResolvedValue(announcement);
      authServiceClient.listActiveStudents.mockResolvedValue([{ id: 'u1', email: 'a@b.com', fullName: 'A' }]);

      await service.publish('507f1f77bcf86cd799439011');

      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ templateName: 'announcement', to: 'a@b.com', userId: 'u1' }));
      expect(notifications.create).not.toHaveBeenCalled(); // sender.send handles the in-app write itself for high/critical
    });

    it('passes relatedId through for high/critical priority too — regression, previously only the low/normal branch set it (Task 42)', async () => {
      const announcement = announcementDoc({ priority: 'high', targetType: 'all' });
      collection.findOne.mockResolvedValue(announcement);
      authServiceClient.listActiveStudents.mockResolvedValue([{ id: 'u1', email: 'a@b.com', fullName: 'A' }]);

      await service.publish('507f1f77bcf86cd799439011');

      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ relatedId: announcement._id.toHexString() }));
    });
  });

  describe('publish — draft/scheduled state machine', () => {
    it('rejects publishing an already-published announcement', async () => {
      collection.findOne.mockResolvedValue(announcementDoc({ status: 'published' }));
      await expect(service.publish('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(ConflictException);
    });

    it('moves to scheduled (does not fan out yet) when publishAt is still in the future', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      collection.findOne.mockResolvedValue(announcementDoc({ publishAt: future }));

      await service.publish('507f1f77bcf86cd799439011');

      expect(collection.updateOne).toHaveBeenCalledWith(expect.anything(), { $set: expect.objectContaining({ status: 'scheduled' }) });
      expect(authServiceClient.listActiveStudents).not.toHaveBeenCalled();
    });
  });

  describe("sweepScheduled — 'already published' guard", () => {
    it('only ever queries status: scheduled, so a re-run naturally never re-matches an already-published row', async () => {
      cursor.toArray.mockResolvedValue([]);
      await service.sweepScheduled();
      expect(collection.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled' }));
    });

    it('publishes every due scheduled announcement it finds', async () => {
      const due = announcementDoc({ status: 'scheduled', publishAt: new Date(Date.now() - 1000), targetType: 'all', priority: 'low' });
      cursor.toArray.mockResolvedValue([due]);
      authServiceClient.listActiveStudents.mockResolvedValue([]);

      await service.sweepScheduled();

      const updateCall = collection.updateOne.mock.calls.find((c) => c[1].$set?.status === 'published');
      expect(updateCall).toBeDefined();
    });
  });

  describe('update — targeting can\'t change after publish', () => {
    it('rejects editing a published announcement', async () => {
      collection.findOne.mockResolvedValue(announcementDoc({ status: 'published' }));
      await expect(service.update('507f1f77bcf86cd799439011', { title: 'new title' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('sendTest', () => {
    it('sends exactly one email to the caller\'s own address, never to real recipients', async () => {
      collection.findOne.mockResolvedValue(announcementDoc());
      authServiceClient.getUser.mockResolvedValue({ id: 'admin-1', email: 'admin@x.com', fullName: 'Admin' });

      await service.sendTest('507f1f77bcf86cd799439011', 'admin-1');

      expect(sender.send).toHaveBeenCalledTimes(1);
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@x.com' }));
    });
  });
});
