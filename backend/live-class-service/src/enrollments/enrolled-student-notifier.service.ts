import {Injectable, Logger} from '@nestjs/common';
import type {ObjectId} from 'mongodb';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {EnrollmentsService} from './enrollments.service';

/**
 * Shared by SessionsService (session reminders/started) and ClassesService (class ended) —
 * both need "resolve every actively-enrolled student's email/name, then fan out a real
 * per-student notification event" and there's no reason to duplicate that logic twice.
 * Recipient resolution happens HERE (the publishing side), not in Notification Service — same
 * precedent Task 33 already set for payment/enrollment events: the consumer never looks
 * anything up itself.
 */
@Injectable()
export class EnrolledStudentNotifier {
  private readonly logger = new Logger(EnrolledStudentNotifier.name);

  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly authServiceClient: AuthServiceClient,
    private readonly eventPublisher: LiveClassEventPublisher,
  ) {}

  /** A resolution/publish failure for one student must never block the others, so each is
   * caught and logged individually rather than let one bad lookup fail the whole fan-out. */
  async notify(classId: ObjectId, classTitle: string, templateName: string, variables: Record<string, unknown>): Promise<void> {
    const studentIds = await this.enrollmentsService.listActiveStudentIds(classId);
    await Promise.all(
      studentIds.map(async (studentId) => {
        try {
          const user = await this.authServiceClient.getUser(studentId);
          this.eventPublisher.publishNotification(
            templateName,
            user.email,
            user.fullName ?? user.email,
            { fullName: user.fullName ?? user.email, classTitle, ...variables },
            studentId,
            classId.toHexString(),
          );
        } catch (err) {
          this.logger.warn(`Failed to resolve/notify student ${studentId} for ${templateName}: ${(err as Error).message}`);
        }
      }),
    );
  }
}
