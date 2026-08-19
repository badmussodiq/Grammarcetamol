import {Body, Controller, Get, Param, Post} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {CreateSubscriptionDto} from './dto/create-subscription.dto';
import {SubscriptionsService} from './subscriptions.service';

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  async create(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.subscriptionsService.create(user.id as string, dto);
    return ApiResponse.success(result);
  }

  @Get('mine')
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.subscriptionsService.listMine(user.id as string);
    return ApiResponse.success(result);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const subscription = await this.subscriptionsService.getById(id, user);
    return ApiResponse.success(subscription);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const subscription = await this.subscriptionsService.cancel(id, user.id as string);
    return ApiResponse.success(subscription);
  }
}
