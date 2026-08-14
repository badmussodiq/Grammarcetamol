import {ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger} from '@nestjs/common';
import type {Response} from 'express';
import {ApiResponse} from './api-response';

/** Wraps every error response in the same {success, data, error, timestamp} envelope the Java
 * services' GlobalExceptionHandler produces. Nest's own HttpException subclasses (NotFoundException,
 * ForbiddenException, BadRequestException, ConflictException, ...) already carry the right status
 * code — this only reshapes the body, mirroring GlobalExceptionHandler's per-exception mapping. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const rawMessage = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : (rawMessage ?? exception.message);
      response.status(status).json(ApiResponse.error(message));
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ApiResponse.error('An internal error occurred'));
  }
}
