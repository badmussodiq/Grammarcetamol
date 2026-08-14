import {Body, Controller, Get, Param, Patch} from '@nestjs/common';
import {CurrentUser, type CurrentUserPayload, requireAdminOrModerator} from '../common/current-user.decorator';
import {ApiResponse} from '../common/api-response';
import {TemplatesService} from './templates.service';

/** Admin-only visibility into what's actually seeded and rendering — no create/edit endpoint yet
 * (templates are edited by changing templates.seed.ts and restarting, see TemplatesService's own
 * comment); this just lets an admin see the list and turn a template off without a redeploy. */
@Controller('api/notification-templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    return ApiResponse.success(await this.templates.findAll());
  }

  @Patch(':name')
  async setActive(@Param('name') name: string, @Body('isActive') isActive: boolean, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const updated = await this.templates.setActive(name, isActive);
    return ApiResponse.success(updated);
  }
}
