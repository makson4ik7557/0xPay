import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

// STUB: returns a valid-format EVM address (0x + 40 hex chars).
// Replace with real HD/derivation when address generation lands.
function generateInvoiceAddress(): string {
  const hex = Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `0x${hex}`;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    const wallet = await this.prisma.wallet.findFirst({where: { publicId: dto.walletPublicId , userId: userId}});
    if (!wallet) throw new NotFoundException();
    const ttlSeconds = Number(
      this.config.getOrThrow<string>('INVOICE_TTL_SECONDS'),
    );
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const address = generateInvoiceAddress();

    const invoice = await this.prisma.invoice.create({
      data: {
        address,
        walletId: wallet.id,
        amount: BigInt(dto.amount),
        currency: wallet.currency,
        network: wallet.network,
        expiresAt,
        userId,
      },
    });

    return {
      id: invoice.id,
      address: invoice.address,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      network: invoice.network,
      status: invoice.status,
      expiresAt: invoice.expiresAt,
      createdAt: invoice.createdAt,
    };
  }
}
