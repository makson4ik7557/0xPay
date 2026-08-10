import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LedgerService } from '../ledger/ledger.service';

@Module({
  imports: [
    PrismaModule,
    LedgerModule
  ],
  controllers: [WalletsController],
  providers: [
    WalletsService,
  ],
})
export class WalletsModule {}
