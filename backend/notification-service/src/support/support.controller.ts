import {Body, Controller, Get, Param, Patch, Post, Query} from '@nestjs/common';
import {CurrentUser, type CurrentUserPayload, requireAdminOrModerator} from '@/common/current-user.decorator';
import {ApiResponse} from '@/common/api-response';
import {CreateTicketDto} from './dto/create-ticket.dto';
import {SupportService} from './support.service';

@Controller('api/support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /** Public — guest or logged-in student. If a session is present, the ticket is linked to that
   * user, but name/email always come from the submitted form (pre-filled client-side when
   * logged in), matching how a guest submission works identically otherwise. */
  @Post()
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: CurrentUserPayload) {
    const ticket = await this.support.create({
      name: dto.name,
      email: dto.email,
      userId: user.id,
      subject: dto.subject,
      message: dto.message,
      courseId: dto.courseId ?? null,
    });
    return ApiResponse.success(ticket);
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    requireAdminOrModerator(user);
    return ApiResponse.success(await this.support.list({ status }, page ? Number(page) : 1, limit ? Number(limit) : 20));
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    return ApiResponse.success(await this.support.findById(id));
  }

  @Patch(':id/close')
  async close(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    return ApiResponse.success(await this.support.close(id, user.id!));
  }
}
