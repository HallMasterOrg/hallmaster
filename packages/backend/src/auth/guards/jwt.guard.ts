import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AuthService } from '../auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  private static extractBearerToken(request: FastifyRequest): string {
    const authHeader = request.headers.authorization ?? '';
    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) throw new UnauthorizedException();
    return token;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = AuthGuard.extractBearerToken(request);

    try {
      const payload = await this.authService.verifyToken(token);

      Object.defineProperty(request, 'user', {
        configurable: true,
        value: payload,
      });
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
