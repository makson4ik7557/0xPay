import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { CreateDepositDto } from './dto/deposit.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserDecorator } from '../auth/current-user.decorator';

@Controller()
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Post('deposits')
  @UseGuards(JwtAuthGuard)
  deposit(
    @Body() dto: CreateDepositDto,
    @CurrentUserDecorator() userId: number,
  ) {
    return this.ledger.deposit(dto.currency, dto.network, dto.amount, userId);
  }

  @Post('withdrawals')
  @UseGuards(JwtAuthGuard)
  withdrawal(
    @Body() dto: CreateWithdrawalDto,
    @CurrentUserDecorator() userId: number,
  ) {
    return this.ledger.withdrawal(dto.currency, dto.network, dto.amount, userId);
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(
    @Query('currency') currency: string,
    @Query('network') network: string,
    @CurrentUserDecorator() userId: number,
  ) {
    return this.ledger.getBalance(currency, network, userId);
  }
}
