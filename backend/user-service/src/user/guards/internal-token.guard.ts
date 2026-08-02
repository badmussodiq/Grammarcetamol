import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';

@Injectable()
export class InternalTokenGuard implements CanActivate {

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token   = request.headers['x-internal-token'];
    const expected = process.env.INTERNAL_TOKEN;

    if (!token || token !== expected) {
      throw new ForbiddenException(
        'Direct access is not allowed. Use the API Gateway.',
      );
    }

    return true;
  }
}
