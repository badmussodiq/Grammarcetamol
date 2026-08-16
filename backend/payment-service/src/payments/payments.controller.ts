import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Headers,
    Param,
    Post,
    Query,
    RawBodyRequest,
    Req
} from '@nestjs/common';
import type {Request} from 'express';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {InitializePaymentDto} from './dto/initialize-payment.dto';
import {RefundPaymentDto} from './dto/refund-payment.dto';
import {PaymentsService} from './payments.service';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  async initialize(@Body() dto: InitializePaymentDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.paymentsService.initialize(user.id as string, dto.courseId, dto.email ?? '');
    return ApiResponse.success(result);
  }

  @Post(':reference/confirm')
  async confirm(@Param('reference') reference: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const payment = await this.paymentsService.confirm(reference);
    return ApiResponse.success(payment);
  }

  /** Paystack calls this server-to-server — no user session, no JWT. It authenticates itself via
   * the x-paystack-signature HMAC header instead, verified inside PaymentsService. Needs the
   * exact raw request bytes (not a re-serialized JSON string) for the signature to check out —
   * see main.ts's `rawBody: true` and this handler's use of req.rawBody rather than @Body(). */
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature?: string) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    await this.paymentsService.handleWebhook(rawBody, signature);
    return { status: 'ok' };
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    requireAuthenticated(user);
    if (!user.isAdminOrModerator()) {
      throw new ForbiddenException('Only super admins or moderators can view transactions');
    }
    const result = await this.paymentsService.list({
      status,
      method,
      dateFrom,
      dateTo,
      userId,
      page: Math.max(Number(page) || 1, 1),
      limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
    });
    return ApiResponse.success({
      items: result.items,
      page: Math.max(Number(page) || 1, 1),
      limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
      total: result.total,
      totalPages: Math.ceil(result.total / Math.min(Math.max(Number(limit) || 20, 1), 100)),
    });
  }

  /** GET /api/payments/me — the authenticated student's own transactions. Registered before
   * the GET ':id' route below so Nest doesn't try to match 'me' as an :id param. */
  @Get('me')
  async listMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    requireAuthenticated(user);
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const result = await this.paymentsService.listMine(user.id as string, { status, dateFrom, dateTo, page: pageNum, limit: limitNum });
    return ApiResponse.success({
      items: result.items,
      page: pageNum,
      limit: limitNum,
      total: result.total,
      totalPages: Math.ceil(result.total / limitNum),
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const payment = await this.paymentsService.getById(id, user);
    return ApiResponse.success(payment);
  }

  @Post(':id/refund')
  async refund(@Param('id') id: string, @Body() dto: RefundPaymentDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    if (!user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only super admins can issue refunds');
    }
    const refund = await this.paymentsService.refund(id, dto.amount, dto.reason, user.id as string);
    return ApiResponse.success(refund);
  }
}
