import { Body, Request, Controller, Post, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Controller()
export class WalletsController{
  constructor(private readonly service: WalletsService) {}
    @Post('/wallets')
    @UseGuards(JwtAuthGuard)
    create(@Body() dto:CreateWalletDto, @Request() req){
      const userId = req.user.userId;
      return this.service.createWallet(dto,userId);
  }
}