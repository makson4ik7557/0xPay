import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  async sweepExpired(): Promise<number> {
    const expired = await this.prisma.invoice.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (expired.length === 0) return 0;

    await this.prisma.invoice.updateMany({
      where: { id: { in: expired.map((invoice) => invoice.id) } },
      data: { status: 'EXPIRED' },
    });

    return expired.length;
  }
}
