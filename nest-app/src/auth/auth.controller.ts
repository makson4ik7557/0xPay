import { Body, Controller, Post, Get, HttpCode, UseGuards, Request } from '@nestjs/common';
import {AuthService} from './auth.service'
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {RateLimitGuard} from './guards/rate-limit.guard';
import {CurrentUserDecorator} from './current-user.decorator'
import { RateLimit } from './guards/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @RateLimit(5, 3600)
  @UseGuards(RateLimitGuard)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @RateLimit(5, 300)
  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  me(@CurrentUserDecorator() userId: number) {
    return this.service.getMe(userId);
  }
}

