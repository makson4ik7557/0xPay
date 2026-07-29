import { Body, Controller, Post, HttpCode} from '@nestjs/common';
import {AuthService} from './auth.service'
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }
}

