import {Body, Controller, Get, Put} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, type CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {DEFAULT_PREFERENCES} from './preference.types';
import {UpdatePreferencesDto} from './dto/update-preferences.dto';
import {PreferencesService} from './preferences.service';

@Controller('api/notification-preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const prefs = await this.preferences.getFor(user.id as string);
    return ApiResponse.success(prefs);
  }

  @Put()
  async update(@Body() dto: UpdatePreferencesDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    // Merge over the default so a caller updating just one type doesn't blow away the others.
    const merged = { ...DEFAULT_PREFERENCES, ...(await this.preferences.getFor(user.id as string)), ...dto };
    const updated = await this.preferences.update(user.id as string, merged as any);
    return ApiResponse.success(updated);
  }
}
