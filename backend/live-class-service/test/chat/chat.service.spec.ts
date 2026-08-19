import {ForbiddenException} from '@nestjs/common';
import {ObjectId} from 'mongodb';
import {ChatGateway} from '@/chat/chat.gateway';
import {ChatService} from '@/chat/chat.service';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import {mockCollection, mockDb} from '../mock-collection';

describe('ChatService — chat-lock gating', () => {
  let messages: ReturnType<typeof mockCollection>;
  let classes: ReturnType<typeof mockCollection>;
  let db: ReturnType<typeof mockDb>;
  let enrollmentsService: { hasAccess: jest.Mock };
  let chatGateway: { broadcastMessage: jest.Mock };
  let service: ChatService;
  const classId = new ObjectId();

  beforeEach(() => {
    messages = mockCollection();
    classes = mockCollection();
    db = mockDb({ class_chat_messages: messages, classes });
    enrollmentsService = { hasAccess: jest.fn() };
    chatGateway = { broadcastMessage: jest.fn() };
    service = new ChatService(db as any, enrollmentsService as unknown as EnrollmentsService, chatGateway as unknown as ChatGateway);
  });

  it('rejects a student posting while chat is locked', async () => {
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: true });
    await expect(service.post(classId.toHexString(), 'student-1', 'student', 'hello')).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.insertOne).not.toHaveBeenCalled();
  });

  it('allows a student to post once unlocked, with an active enrollment', async () => {
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: false });
    enrollmentsService.hasAccess.mockResolvedValueOnce({ status: 'ACTIVE' });
    messages.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

    await service.post(classId.toHexString(), 'student-1', 'student', 'hello');
    expect(messages.insertOne).toHaveBeenCalled();
  });

  it('rejects a locked-then-unlocked-then-locked-again post attempt', async () => {
    // Locked
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: true });
    await expect(service.post(classId.toHexString(), 'student-1', 'student', 'first')).rejects.toBeInstanceOf(ForbiddenException);

    // Unlocked
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: false });
    enrollmentsService.hasAccess.mockResolvedValueOnce({ status: 'ACTIVE' });
    messages.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });
    await service.post(classId.toHexString(), 'student-1', 'student', 'second');
    expect(messages.insertOne).toHaveBeenCalledTimes(1);

    // Locked again
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: true });
    await expect(service.post(classId.toHexString(), 'student-1', 'student', 'third')).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.insertOne).toHaveBeenCalledTimes(1);
  });

  it('instructors/admins can always post, even while locked', async () => {
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: true });
    messages.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

    await service.post(classId.toHexString(), 'admin-1', 'admin', 'moderator note');
    expect(messages.insertOne).toHaveBeenCalled();
    expect(enrollmentsService.hasAccess).not.toHaveBeenCalled();
  });

  it('students always read regardless of lock state, as long as they have access', async () => {
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: true });
    enrollmentsService.hasAccess.mockResolvedValueOnce({ status: 'ACTIVE' });
    messages.__cursor.toArray.mockResolvedValueOnce([]);

    await expect(service.list(classId.toHexString(), 'student-1', false)).resolves.toEqual([]);
  });

  it('post() returns the same public shape as list() (id/classId as hex strings, no raw _id) and broadcasts it', async () => {
    // Regression test: post() used to return the raw Mongo document instead of running it
    // through toPublicMessage() like list() does, so a freshly-posted message had `_id`/an
    // ObjectId `classId` instead of `id`/a hex-string `classId` — found live-verifying Task 41.
    const insertedId = new ObjectId();
    classes.findOne.mockResolvedValueOnce({ _id: classId, chatLocked: false });
    enrollmentsService.hasAccess.mockResolvedValueOnce({ status: 'ACTIVE' });
    messages.insertOne.mockResolvedValueOnce({ insertedId });

    const result = await service.post(classId.toHexString(), 'student-1', 'student', 'hello');

    expect(result.id).toBe(insertedId.toHexString());
    expect(result.classId).toBe(classId.toHexString());
    expect((result as any)._id).toBeUndefined();
    expect(chatGateway.broadcastMessage).toHaveBeenCalledWith(classId.toHexString(), result);
  });
});
