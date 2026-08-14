import {Controller, ForbiddenException, Get, Query} from '@nestjs/common';
import {ApiResponse} from '../common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '../common/current-user.decorator';
import {RevenueService} from './revenue.service';
import type {RevenuePeriod} from './revenue.types';

@Controller('api/payments/revenue')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get('summary')
  async summary(@CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    return ApiResponse.success(await this.revenueService.getSummary());
  }

  @Get('trend')
  async trend(@Query('period') period: string | undefined, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const validPeriod: RevenuePeriod = period === 'weekly' || period === 'monthly' ? period : 'daily';
    return ApiResponse.success(await this.revenueService.getTrend(validPeriod));
  }

  @Get('best-sellers')
  async bestSellers(@Query('limit') limit: string | undefined, @CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return ApiResponse.success(await this.revenueService.getBestSellers(parsedLimit));
  }

  @Get('by-method')
  async byMethod(@CurrentUser() user: CurrentUserPayload) {
    requireAdminOrModerator(user);
    return ApiResponse.success(await this.revenueService.getRevenueByMethod());
  }
}

function requireAdminOrModerator(user: CurrentUserPayload): void {
  requireAuthenticated(user);
  if (!user.isAdminOrModerator()) {
    throw new ForbiddenException('Only super admins or moderators can view revenue data');
  }
}
