import {Body, Controller, Param, Post} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {EnrollDto} from './dto/enroll.dto';
import {EnrollmentsService} from './enrollments.service';

@Controller('api/invitations')
export class InvitationsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post(':token/accept')
  async accept(@Param('token') token: string, @Body() dto: EnrollDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.enrollmentsService.acceptInvitation(token, user.id as string, dto.email);
    return ApiResponse.success({ enrollment: result.enrollment, authorizationUrl: result.authorizationUrl });
  }
}
