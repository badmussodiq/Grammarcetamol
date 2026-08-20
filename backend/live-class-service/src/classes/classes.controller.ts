import {Body, Controller, Get, Param, Patch, Post, Query} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAdminOrModerator, requireAuthenticated} from '@/common/current-user.decorator';
import {ChatService} from '@/chat/chat.service';
import {PostMessageDto} from '@/chat/dto/post-message.dto';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import {EnrollDto} from '@/enrollments/dto/enroll.dto';
import {InviteDto} from '@/enrollments/dto/invite.dto';
import {MaterialsService} from '@/materials/materials.service';
import {CreateMaterialDto} from '@/materials/dto/create-material.dto';
import {SessionsService} from '@/sessions/sessions.service';
import {CreateSessionDto} from '@/sessions/dto/create-session.dto';
import {toPublicSession} from '@/sessions/session.types';
import {toPublicClass} from './class.types';
import {ClassesService} from './classes.service';
import {CreateClassDto} from './dto/create-class.dto';
import {UpdateClassDto} from './dto/update-class.dto';

@Controller('api/classes')
export class ClassesController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly sessionsService: SessionsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly materialsService: MaterialsService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  async create(@Body() dto: CreateClassDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const created = await this.classesService.create(user.id as string, dto as any);
    return ApiResponse.success(toPublicClass(created));
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('classType') classType?: string,
    @Query('accessMode') accessMode?: string,
    @Query('instructorId') instructorId?: string,
    @Query('search') search?: string,
    @Query('mine') mine?: string,
  ) {
    const includePrivate = user.isAdminOrModerator();
    const result = await this.classesService.list(
      { classType, accessMode, instructorId, search, mine: mine === 'true' ? (user.id ?? undefined) : undefined },
      includePrivate,
    );
    return ApiResponse.success(result);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const doc = await this.classesService.findById(id);
    return ApiResponse.success(toPublicClass(doc));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClassDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.classesService.update(id, user.id as string, user.isAdminOrModerator(), dto as any);
    return ApiResponse.success(toPublicClass(updated));
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.classesService.publish(id, user.id as string, user.isAdminOrModerator());
    return ApiResponse.success(toPublicClass(updated));
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.classesService.end(id, user.id as string, user.isAdminOrModerator());
    return ApiResponse.success(toPublicClass(updated));
  }

  @Patch(':id/chat-lock')
  async setChatLock(@Param('id') id: string, @Body('locked') locked: boolean, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.classesService.setChatLocked(id, user.id as string, user.isAdminOrModerator(), locked);
    return ApiResponse.success(toPublicClass(updated));
  }

  // ---- Sessions ----

  @Post(':id/sessions')
  async createSession(@Param('id') id: string, @Body() dto: CreateSessionDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const classDoc = await this.classesService.findById(id);
    const session = await this.sessionsService.createManual(classDoc, new Date(dto.startTime), new Date(dto.endTime), dto.timezone);
    // roomId/videoDomain must never leave this service except via the room-reveal endpoint —
    // toPublicSession is what redacts them; returning the raw document here was a real bug
    // caught during live verification (2026-08-19), not a hypothetical.
    return ApiResponse.success(toPublicSession(session));
  }

  @Get(':id/sessions')
  async listSessions(@Param('id') id: string) {
    const classDoc = await this.classesService.findById(id);
    const sessions = await this.sessionsService.listForClass(classDoc._id);
    return ApiResponse.success(sessions);
  }

  @Get(':id/sessions/:sessionId/room')
  async getRoom(@Param('id') id: string, @Param('sessionId') sessionId: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const classDoc = await this.classesService.findById(id);
    const room = await this.sessionsService.getRoom(classDoc, sessionId, user.id as string);
    return ApiResponse.success(room);
  }

  // ---- Enrollment & invitations ----

  @Post(':id/enroll')
  async enroll(@Param('id') id: string, @Body() dto: EnrollDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.enrollmentsService.enroll(id, user.id as string, dto.email);
    return ApiResponse.success({ enrollment: result.enrollment, authorizationUrl: result.authorizationUrl });
  }

  @Post(':id/invite')
  async invite(@Param('id') id: string, @Body() dto: InviteDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const invitation = await this.enrollmentsService.invite(id, user.id as string, dto.studentId, dto.negotiatedPrice);
    return ApiResponse.success(invitation);
  }

  @Get(':id/enrollments')
  async listEnrollments(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const classDoc = await this.classesService.findById(id);
    const enrollments = await this.enrollmentsService.listForClass(classDoc._id);
    return ApiResponse.success(enrollments);
  }

  @Get(':id/invitations')
  async listInvitations(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const classDoc = await this.classesService.findById(id);
    const invitations = await this.enrollmentsService.listInvitations(classDoc._id);
    return ApiResponse.success(invitations);
  }

  // ---- Materials ----

  @Post(':id/materials')
  async createMaterial(@Param('id') id: string, @Body() dto: CreateMaterialDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const classDoc = await this.classesService.findById(id);
    const material = await this.materialsService.create(classDoc._id, user.id as string, {
      title: dto.title,
      fileUrl: dto.fileUrl,
      sessionId: dto.sessionId,
      visibleFrom: dto.visibleFrom ? new Date(dto.visibleFrom) : undefined,
    });
    return ApiResponse.success(material);
  }

  @Get(':id/materials')
  async listMaterials(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const classDoc = await this.classesService.findById(id);
    if (!user.isAdminOrModerator()) {
      const access = await this.enrollmentsService.hasAccess(classDoc._id, user.id as string);
      if (!access) {
        return ApiResponse.success([]);
      }
    }
    const materials = await this.materialsService.listForClass(classDoc._id);
    return ApiResponse.success(materials);
  }

  // ---- Chat ----

  @Get(':id/messages')
  async listMessages(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const messages = await this.chatService.list(id, user.id as string, user.isAdminOrModerator());
    return ApiResponse.success(messages);
  }

  @Post(':id/messages')
  async postMessage(@Param('id') id: string, @Body() dto: PostMessageDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const senderRole = user.isAdminOrModerator() ? 'admin' : 'student';
    const message = await this.chatService.post(id, user.id as string, senderRole, dto.body);
    return ApiResponse.success(message);
  }
}
