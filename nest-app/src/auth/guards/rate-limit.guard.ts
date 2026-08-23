import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';

const atomicIncrWithExpiryScript = `
    local counter = redis.call('INCR',KEYS[1])
    if counter == 1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end
    return counter
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT') private redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.get<{ limit: number; ttl: number }>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    const { limit, ttl } = metadata ?? { limit: 5, ttl: 60 };
    const req = context.switchToHttp().getRequest<Request>();
    const key = `ratelimit:${req.path}:${req.ip}`;
    const counter = Number(
      await this.redis.eval(atomicIncrWithExpiryScript, 1, key, ttl),
    );
    if (counter > limit)
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
