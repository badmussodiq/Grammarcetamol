import {ForbiddenException, Inject, Injectable, NotFoundException, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import type {LiveClass} from '@/classes/class.types';
import type {ClassChatMessage, ClassChatMessageDocument} from './chat-message.types';
import {toPublicMessage} from './chat-message.types';

@Injectable()
export class ChatService implements OnApplicationBootstrap {
  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  private messages(): Collection<ClassChatMessage> {
    return this.db.collection<ClassChatMessage>('class_chat_messages');
  }

  private classes(): Collection<LiveClass> {
    return this.db.collection<LiveClass>('classes');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.messages().createIndex({ classId: 1, createdAt: 1 });
  }

  private async findClass(classId: string): Promise<LiveClass & { _id: ObjectId }> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(classId);
    } catch {
      throw new NotFoundException(`Class not found: ${classId}`);
    }
    const doc = await this.classes().findOne({ _id: objectId });
    if (!doc) throw new NotFoundException(`Class not found: ${classId}`);
    return doc as LiveClass & { _id: ObjectId };
  }

  /** Students always read regardless of lock state — only posting is gated. */
  async list(classId: string, callerId: string, isAdminOrInstructor: boolean): Promise<ReturnType<typeof toPublicMessage>[]> {
    const classDoc = await this.findClass(classId);
    if (!isAdminOrInstructor) {
      const access = await this.enrollmentsService.hasAccess(classDoc._id, callerId);
      if (!access) {
        throw new ForbiddenException('You do not have access to this class');
      }
    }
    const docs = await this.messages().find({ classId: classDoc._id }).sort({ createdAt: 1 }).toArray();
    return docs.map((d) => toPublicMessage(d as ClassChatMessageDocument));
  }

  /** Gated on classes.chatLocked + the sender's enrollment status/accessUntil — independent of
   * whether a session is currently live, per PHASE4.md's Domain Model. Instructors/admins can
   * always post, even while locked (they're the ones controlling the lock). */
  async post(classId: string, senderId: string, senderRole: 'instructor' | 'student' | 'admin', body: string): Promise<ClassChatMessageDocument> {
    const classDoc = await this.findClass(classId);

    if (senderRole === 'student') {
      if (classDoc.chatLocked) {
        throw new ForbiddenException('Chat is currently locked by the instructor');
      }
      const access = await this.enrollmentsService.hasAccess(classDoc._id, senderId);
      if (!access) {
        throw new ForbiddenException('You do not have access to this class');
      }
    }

    const doc: ClassChatMessage = { classId: classDoc._id, senderId, senderRole, body, createdAt: new Date() };
    const result = await this.messages().insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  }
}
