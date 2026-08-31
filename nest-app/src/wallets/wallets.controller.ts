import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Param,
  Query,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { CreateDepositDto } from './dto/deposit.dto';
import { LedgerService } from '../ledger/ledger.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { CurrentUserDecorator } from '../auth/current-user.decorator';

@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly service: WalletsService,
    private readonly ledger: LedgerService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateWalletDto, @CurrentUserDecorator() userId: number) {
    return this.service.createWallet(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getAllWallets(@CurrentUserDecorator() userId: number) {
    return this.service.allUserWallets(userId);
  }

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
    return this.ledger.withdrawal(
      dto.currency,
      dto.network,
      dto.amount,
      userId,
    );
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getSpecificBalance(
    @Query('currency') currency: string,
    @Query('network') network: string,
    @CurrentUserDecorator() userId: number,
  ) {
    return this.ledger.getBalance(currency, network, userId);
  }

  @Get(':publicId')
  @UseGuards(JwtAuthGuard)
  getSpecificWallet(
    @Param('publicId') params: string,
    @CurrentUserDecorator() userId: number,
  ) {
    return this.service.getWallet(params, userId);
  }
}
