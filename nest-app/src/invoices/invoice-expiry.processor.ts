import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InvoiceExpiryService } from './invoice-expiry.service';

@Processor('invoice-expiry')
export class InvoiceExpiryProcessor extends WorkerHost {
  constructor(private readonly expiry: InvoiceExpiryService) {
    super();
  }

  async process(): Promise<void> {
    await this.expiry.sweepExpired();
  }
}
