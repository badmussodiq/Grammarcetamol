import {Controller, Get, Param, Query} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAdminOrModerator} from '@/common/current-user.decorator';
import {SessionsService} from './sessions.service';

/** Backs the admin create/edit form's real-time conflict check — same conflict-detection
 * logic SessionsService uses when actually booking, exposed as a read-only availability view. */
@Controller('api/instructors')
export class InstructorsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get(':id/availability')
  async availability(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    requireAdminOrModerator(user);
    const busy = await this.sessionsService.getInstructorAvailability(id, new Date(from), new Date(to));
    return ApiResponse.success(busy);
  }
}
