import { Body, Request, Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly service: WalletsService) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateWalletDto, @Request() req) {
    const userId = req.user.userId;
    return this.service.createWallet(dto, userId);
  }
  @Get()
  @UseGuards(JwtAuthGuard)
  getAllWallets(@Request() req) {
    const userId = req.user.userId;
    return this.service.allUserWallets(userId);
  }
  @Get(':publicId')
  @UseGuards(JwtAuthGuard)
  getSpecificWallet(@Param('publicId') params, @Request() req) {
    const userId = req.user.userId;
    return this.service.getWallet(params,userId);
  }
}