import { Inject, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import { MONGO_DB } from '../config/database.module';
import { NotificationSenderService } from '../sender/notification-sender.service';
import type { SupportTicket } from './support-ticket.types';

export interface CreateTicketInput {
  name: string;
  email: string;
  userId: string | null;
  subject: string;
  message: string;
  courseId: string | null;
}

@Injectable()
export class SupportService implements OnApplicationBootstrap {
  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly sender: NotificationSenderService,
  ) {}

  private collection(): Collection<SupportTicket> {
    return this.db.collection<SupportTicket>('support_tickets');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.collection().createIndex({ createdAt: -1 });
    await this.collection().createIndex({ status: 1 });
  }

  async create(input: CreateTicketInput): Promise<SupportTicket & { _id: ObjectId }> {
    const now = new Date();
    const ticket: SupportTicket = {
      name: input.name,
      email: input.email,
      userId: input.userId,
      subject: input.subject,
      message: input.message,
      courseId: input.courseId,
      status: 'open',
      closedBy: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection().insertOne(ticket);
    const saved = { ...ticket, _id: result.insertedId };

    // Same process as the email logic — no RabbitMQ round-trip needed. Fire-and-forget from the
    // caller's perspective is wrong here (the confirmation email IS part of "submitted
    // successfully"), but NotificationSenderService itself never throws, so this can't turn a
    // successful ticket creation into a failed HTTP response.
    await this.sender.send({
      service: 'notification-service',
      templateName: 'support-ticket-submitted',
      to: saved.email,
      toName: saved.name,
      variables: { name: saved.name, ticketSubject: saved.subject, ticketId: saved._id.toHexString() },
    });

    return saved;
  }

  async list(filter: { status?: string } = {}, page = 1, limit = 20) {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;

    const collection = this.collection();
    const [items, total] = await Promise.all([
      collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<SupportTicket & { _id: ObjectId }> {
    const ticket = await this.collection().findOne({ _id: new ObjectId(id) });
    if (!ticket) {
      throw new NotFoundException(`Support ticket not found: ${id}`);
    }
    return ticket as SupportTicket & { _id: ObjectId };
  }

  async close(id: string, closedByUserId: string): Promise<SupportTicket & { _id: ObjectId }> {
    const ticket = await this.findById(id);
    if (ticket.status === 'closed') {
      return ticket;
    }

    const now = new Date();
    await this.collection().updateOne(
      { _id: ticket._id },
      { $set: { status: 'closed', closedBy: closedByUserId, closedAt: now, updatedAt: now } },
    );

    await this.sender.send({
      service: 'notification-service',
      templateName: 'support-ticket-closed',
      to: ticket.email,
      toName: ticket.name,
      variables: { name: ticket.name, ticketSubject: ticket.subject, ticketId: ticket._id.toHexString() },
    });

    return this.findById(id);
  }
}
