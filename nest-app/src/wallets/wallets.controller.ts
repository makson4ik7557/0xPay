import { Body, Request, Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { CreateDepositDto } from './dto/deposit.dto';
import { LedgerService } from '../ledger/ledger.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly service: WalletsService,
    private readonly ledger: LedgerService,
  ) {}

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
    return this.service.getWallet(params, userId);
  }

  @Post('/:publicId/deposits')
  @UseGuards(JwtAuthGuard)
  deposit(
    @Param('publicId') params,
    @Body() dto: CreateDepositDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.ledger.deposit(params, dto.amount, userId);
  }

  @Post('/:publicId/withdrawal')
  @UseGuards(JwtAuthGuard)
  withdrawal(
    @Param('publicId') params,
    @Body() dto: CreateWithdrawalDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.ledger.withdrawal(params, dto.amount, userId);
  }

  @Get('/:publicId/balance')
  @UseGuards(JwtAuthGuard)
  getSpecificBalance(@Param('publicId') params, @Request() req) {
    const userId = req.user.userId;
    return this.ledger.getWalletBalance(params, userId);
  }
}