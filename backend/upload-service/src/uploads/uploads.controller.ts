import {Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post} from '@nestjs/common';
import {ApiResponse} from '../common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '../common/current-user.decorator';
import {CompleteChunkDto} from './dto/complete-chunk.dto';
import {CreateSessionDto} from './dto/create-session.dto';
import {FailFileDto} from './dto/fail-file.dto';
import {UploadsService} from './uploads.service';

/** Every route here manages course-content uploads — admin/moderator-only, same gate every
 * course-authoring endpoint in course-service already uses. Never owner-scoped (any admin can
 * see/manage any course's in-progress upload), matching how any admin can already edit any
 * course. */
@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('sessions')
  async createSession(@Body() dto: CreateSessionDto, @CurrentUser() user: CurrentUserPayload) {
    this.requireStaff(user);
    const result = await this.uploadsService.createSession(user.id as string, dto.courseId, dto.files);
    return ApiResponse.success(result);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    this.requireStaff(user);
    const result = await this.uploadsService.getSession(id);
    return ApiResponse.success(result);
  }

  @Get('files/:fileId/chunks/:chunkIndex/presign')
  async presignChunk(
    @Param('fileId') fileId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.requireStaff(user);
    const result = await this.uploadsService.presignChunk(fileId, chunkIndex);
    return ApiResponse.success(result);
  }

  @Patch('files/:fileId/chunks/:chunkIndex/complete')
  async completeChunk(
    @Param('fileId') fileId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
    @Body() dto: CompleteChunkDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.requireStaff(user);
    await this.uploadsService.completeChunk(fileId, chunkIndex, dto.etag);
    return ApiResponse.success({ status: 'ok' });
  }

  @Post('files/:fileId/complete')
  async completeFile(@Param('fileId') fileId: string, @CurrentUser() user: CurrentUserPayload) {
    this.requireStaff(user);
    const result = await this.uploadsService.completeFile(fileId);
    return ApiResponse.success(result);
  }

  @Patch('files/:fileId/fail')
  async failFile(@Param('fileId') fileId: string, @Body() dto: FailFileDto, @CurrentUser() user: CurrentUserPayload) {
    this.requireStaff(user);
    await this.uploadsService.failFile(fileId, dto.errorCode, dto.errorMessage);
    return ApiResponse.success({ status: 'ok' });
  }

  /** Same admin/moderator gate as everything else on this controller — also how
   * enrollment-service resolves lesson playback, presenting itself as a trusted internal
   * SUPER_ADMIN caller (same convention as course-service's CourseServiceClient). Only a
   * completed file has anything meaningful to sign a GET for. */
  @Get('files/:fileId/download-url')
  async getDownloadUrl(@Param('fileId') fileId: string, @CurrentUser() user: CurrentUserPayload) {
    this.requireStaff(user);
    const result = await this.uploadsService.getDownloadUrl(fileId);
    return ApiResponse.success(result);
  }

  private requireStaff(user: CurrentUserPayload): void {
    requireAuthenticated(user);
    if (!user.isAdminOrModerator()) {
      throw new ForbiddenException('Only super admins or moderators can manage course-content uploads');
    }
  }
}
