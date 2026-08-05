import { Body, Controller, ForbiddenException, Headers, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponse } from '../common/api-response';
import { CurrentUser, CurrentUserPayload, requireAuthenticated } from '../common/current-user.decorator';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentsService } from './payments.service';

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
