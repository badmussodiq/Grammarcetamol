import {Logger} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {Server, Socket} from 'socket.io';
import {ObjectId} from 'mongodb';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import type {toPublicMessage} from './chat-message.types';

/**
 * Real-time delivery for class chat, added per explicit user direction (2026-08-19) — the
 * original Task 41 plan used REST polling for chat, same as PLAN.md's own "no WebSocket in
 * this task" note, but the user asked for sockets specifically. Writes stay REST (POST
 * /api/classes/{id}/messages) so ChatService.post()'s validation/locking logic exists in
 * exactly one place; this gateway's only job is to broadcast an already-created, already-public-
 * shaped message to everyone else currently viewing that class's chat. ChatService calls
 * broadcastMessage() itself right after a successful post — see its own comment.
 *
 * Auth reuses the same header-trust pattern as every REST endpoint in this service: the
 * gateway's JwtAuthFilter runs on the WebSocket upgrade's initial HTTP request the same way it
 * runs on any other request, injecting X-User-Id/X-User-Role before Spring Cloud Gateway
 * proxies the upgrade through — no separate socket-specific auth mechanism needed.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  handleConnection(client: Socket): void {
    const userId = this.extractUserId(client);
    if (!userId) {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join-class')
  async handleJoinClass(@ConnectedSocket() client: Socket, @MessageBody() body: { classId: string }): Promise<void> {
    const userId = this.extractUserId(client);
    const isAdminOrModerator = this.extractRoles(client).some((r) => r === 'SUPER_ADMIN' || r === 'MODERATOR');
    if (!userId || !body?.classId) {
      client.emit('join-class-error', { reason: 'unauthenticated' });
      return;
    }

    let classObjectId: ObjectId;
    try {
      classObjectId = new ObjectId(body.classId);
    } catch {
      client.emit('join-class-error', { reason: 'not-found' });
      return;
    }

    if (!isAdminOrModerator) {
      const access = await this.enrollmentsService.hasAccess(classObjectId, userId);
      if (!access) {
        this.logger.warn(`join-class rejected: user ${userId} has no access to class ${body.classId}`);
        client.emit('join-class-error', { reason: 'not-enrolled' });
        return;
      }
    }

    void client.join(this.roomFor(body.classId));
  }

  /** Called by ChatService right after a message is successfully created — pushes it to
   * everyone currently in that class's chat room, instructor/admin included. */
  broadcastMessage(classId: string, message: ReturnType<typeof toPublicMessage>): void {
    this.server.to(this.roomFor(classId)).emit('chat-message', message);
  }

  private roomFor(classId: string): string {
    return `class:${classId}`;
  }

  private extractUserId(client: Socket): string | null {
    const header = client.handshake.headers['x-user-id'];
    if (!header || Array.isArray(header)) return null;
    return header;
  }

  private extractRoles(client: Socket): string[] {
    const header = client.handshake.headers['x-user-role'];
    if (!header) return [];
    const value = Array.isArray(header) ? header[0] : header;
    return value.split(',').map((r) => r.trim()).filter(Boolean);
  }
}
