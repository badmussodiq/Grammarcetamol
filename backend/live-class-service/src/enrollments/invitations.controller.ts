import {Body, Controller, Get, Param, Post} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {EnrollDto} from './dto/enroll.dto';
import {EnrollmentsService} from './enrollments.service';

@Controller('api/invitations')
export class InvitationsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // Public — no requireAuthenticated. A visitor needs to see the class/instructor/schedule/
  // price before deciding whether to log in and accept (see getInvitationPreview's own doc
  // comment). The gateway must classify this GET as optionally-authenticated, not public
  // outright, since it's under the same path prefix as the fully-authenticated accept below.
  @Get(':token')
  async preview(@Param('token') token: string) {
    const result = await this.enrollmentsService.getInvitationPreview(token);
    return ApiResponse.success(result);
  }

  @Post(':token/accept')
  async accept(@Param('token') token: string, @Body() dto: EnrollDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.enrollmentsService.acceptInvitation(token, user.id as string, dto.email);
    return ApiResponse.success({ enrollment: result.enrollment, authorizationUrl: result.authorizationUrl });
  }
}
