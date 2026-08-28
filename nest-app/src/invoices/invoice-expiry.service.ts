import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WatchlistNotifier } from './watchlist.notifier';

@Injectable()
export class InvoiceExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly watchlist: WatchlistNotifier,
  ) {}

  async sweepExpired(): Promise<number> {
    const expired = await this.prisma.invoice.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true, address: true },
    });
    if (expired.length === 0) return 0;

    await this.prisma.invoice.updateMany({
      where: { id: { in: expired.map((invoice) => invoice.id) } },
      data: { status: 'EXPIRED' },
    });

    for (const invoice of expired) {
      await this.watchlist.remove(invoice.address);
    }

    return expired.length;
  }
}
