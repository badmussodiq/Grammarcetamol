import {ObjectId} from 'mongodb';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {EnrolledStudentNotifier} from '@/enrollments/enrolled-student-notifier.service';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';

describe('EnrolledStudentNotifier', () => {
  let enrollmentsService: { listActiveStudentIds: jest.Mock };
  let authServiceClient: { getUser: jest.Mock };
  let eventPublisher: { publishNotification: jest.Mock };
  let notifier: EnrolledStudentNotifier;
  const classId = new ObjectId();

  beforeEach(() => {
    enrollmentsService = { listActiveStudentIds: jest.fn() };
    authServiceClient = { getUser: jest.fn() };
    eventPublisher = { publishNotification: jest.fn() };
    notifier = new EnrolledStudentNotifier(
      enrollmentsService as unknown as EnrollmentsService,
      authServiceClient as unknown as AuthServiceClient,
      eventPublisher as unknown as LiveClassEventPublisher,
    );
  });

  it('passes the classId as relatedId so the frontend can deep-link into the classroom (Task 42 regression)', async () => {
    enrollmentsService.listActiveStudentIds.mockResolvedValue(['student-1']);
    authServiceClient.getUser.mockResolvedValue({ id: 'student-1', email: 's1@example.com', fullName: 'Student One' });

    await notifier.notify(classId, 'Saturday Revision', 'live-class-starting', {});

    expect(eventPublisher.publishNotification).toHaveBeenCalledWith(
      'live-class-starting',
      's1@example.com',
      'Student One',
      expect.objectContaining({ classTitle: 'Saturday Revision' }),
      'student-1',
      classId.toHexString(),
    );
  });

  it('notifies every actively-enrolled student, resolved in parallel', async () => {
    enrollmentsService.listActiveStudentIds.mockResolvedValue(['student-1', 'student-2']);
    authServiceClient.getUser.mockImplementation((id: string) => Promise.resolve({ id, email: `${id}@example.com`, fullName: null }));

    await notifier.notify(classId, 'Saturday Revision', 'class-ended', {});

    expect(eventPublisher.publishNotification).toHaveBeenCalledTimes(2);
  });

  it('a failure resolving one student never blocks notifying the others', async () => {
    enrollmentsService.listActiveStudentIds.mockResolvedValue(['student-1', 'student-2']);
    authServiceClient.getUser.mockImplementation((id: string) =>
      id === 'student-1' ? Promise.reject(new Error('auth-service unreachable')) : Promise.resolve({ id, email: `${id}@example.com`, fullName: null }),
    );

    await expect(notifier.notify(classId, 'Saturday Revision', 'class-ended', {})).resolves.toBeUndefined();
    expect(eventPublisher.publishNotification).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publishNotification).toHaveBeenCalledWith(
      'class-ended', 'student-2@example.com', expect.any(String), expect.anything(), 'student-2', classId.toHexString(),
    );
  });
});
