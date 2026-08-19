import {ConflictException, ForbiddenException} from '@nestjs/common';
import {ObjectId} from 'mongodb';
import {EnrolledStudentNotifier} from '@/enrollments/enrolled-student-notifier.service';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {SessionsService} from '@/sessions/sessions.service';
import {ClassesService} from '@/classes/classes.service';
import {mockCollection, mockDb} from '../mock-collection';

// Note: this file covers only Task 40's new end()-fans-out-a-notification behavior — a
// broader ClassesService suite (create/update/publish/list) was never written back in Task
// 39 and remains a real gap, flagged rather than silently left uncovered.
function classDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new ObjectId(),
    title: 'Primary 4 Mathematics',
    instructorId: 'instructor-1',
    status: 'ACTIVE',
    schedules: [],
    ...overrides,
  } as any;
}

describe('ClassesService — end()', () => {
  let classes: ReturnType<typeof mockCollection>;
  let db: ReturnType<typeof mockDb>;
  let sessionsService: { generateFromSchedules: jest.Mock };
  let eventPublisher: Record<string, jest.Mock>;
  let studentNotifier: { notify: jest.Mock };
  let service: ClassesService;

  beforeEach(() => {
    classes = mockCollection();
    db = mockDb({ classes });
    sessionsService = { generateFromSchedules: jest.fn() };
    eventPublisher = { publishClassCreated: jest.fn(), publishClassUpdated: jest.fn(), publishClassEnded: jest.fn() };
    studentNotifier = { notify: jest.fn().mockResolvedValue(undefined) };

    service = new ClassesService(
      db as any,
      sessionsService as unknown as SessionsService,
      eventPublisher as unknown as LiveClassEventPublisher,
      studentNotifier as unknown as EnrolledStudentNotifier,
    );
  });

  it('fans out a class-ended notification to enrolled students', async () => {
    const cls = classDoc({ status: 'ACTIVE' });
    classes.findOne.mockResolvedValue(cls);
    classes.updateOne.mockResolvedValue({});

    await service.end(cls._id.toHexString(), 'instructor-1', false);
    await Promise.resolve();

    expect(studentNotifier.notify).toHaveBeenCalledWith(cls._id, cls.title, 'class-ended', {});
    expect(eventPublisher.publishClassEnded).toHaveBeenCalled();
  });

  it('rejects ending a class that is not ACTIVE/PAUSED', async () => {
    classes.findOne.mockResolvedValue(classDoc({ status: 'DRAFT' }));
    await expect(service.end('507f1f77bcf86cd799439011', 'instructor-1', false)).rejects.toBeInstanceOf(ConflictException);
    expect(studentNotifier.notify).not.toHaveBeenCalled();
  });

  it('rejects a non-instructor, non-admin caller', async () => {
    classes.findOne.mockResolvedValue(classDoc({ instructorId: 'instructor-1' }));
    await expect(service.end('507f1f77bcf86cd799439011', 'someone-else', false)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
