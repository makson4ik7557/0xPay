import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceExpiryService } from './invoice-expiry.service';
import { InvoiceExpiryProcessor } from './invoice-expiry.processor';
import { WatchlistNotifier } from './watchlist.notifier';
import { AssetResolverService } from './asset-resolver.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    PrismaModule,
    LedgerModule,
    BullModule.registerQueue({ name: 'invoice-expiry' }),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceExpiryService,
    InvoiceExpiryProcessor,
    WatchlistNotifier,
    AssetResolverService,
  ],
})
export class InvoicesModule implements OnModuleInit {
  constructor(
    @InjectQueue('invoice-expiry') private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const every = Number(
      this.config.getOrThrow<string>('INVOICE_EXPIRY_SWEEP_MS'),
    );
    await this.queue.upsertJobScheduler(
      'invoice-expiry-repeat',
      { every },
      {
        name: 'sweep',
        opts: { removeOnComplete: true, removeOnFail: true },
      },
    );
  }
}
