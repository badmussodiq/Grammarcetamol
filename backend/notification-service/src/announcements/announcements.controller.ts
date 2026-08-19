import {Body, Controller, Delete, Get, Param, Patch, Post, Query} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, type CurrentUserPayload, requireAdminOrModerator} from '@/common/current-user.decorator';
import {toPublicAnnouncement} from './announcement.types';
import {AnnouncementsService} from './announcements.service';
import {CreateAnnouncementDto} from './dto/create-announcement.dto';
import {UpdateAnnouncementDto} from './dto/update-announcement.dto';

@Controller('api/announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post()
  async create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const created = await this.announcements.create(user.id as string, dto);
    return ApiResponse.success(toPublicAnnouncement(created));
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    requireAdminOrModerator(user);
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const result = await this.announcements.list({ status }, pageNum, limitNum);
    return ApiResponse.success({ ...result, items: result.items.map((i) => toPublicAnnouncement(i as any)) });
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const doc = await this.announcements.findById(id);
    return ApiResponse.success(toPublicAnnouncement(doc));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.announcements.update(id, dto);
    return ApiResponse.success(toPublicAnnouncement(updated));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    await this.announcements.remove(id);
    return ApiResponse.success(null);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.announcements.publish(id);
    return ApiResponse.success(toPublicAnnouncement(updated));
  }

  @Post(':id/send-test')
  async sendTest(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    await this.announcements.sendTest(id, user.id as string);
    return ApiResponse.success(null);
  }

  @Get(':id/recipient-count')
  async recipientCount(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const count = await this.announcements.recipientCount(id);
    return ApiResponse.success({ count });
  }
}
