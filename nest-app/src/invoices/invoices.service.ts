import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { LedgerService } from '../ledger/ledger.service';
import { AssetResolverService } from './asset-resolver.service';
import { InvoiceCallbackDto } from './dto/invoice-callback.dto';
import { Invoice, InvoiceStatus, Prisma } from '../generated/client';

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
    private readonly ledger: LedgerService,
    private readonly resolver: AssetResolverService,
  ) {}

  private savePaymentDetails(
    invoice: Invoice,
    dto: InvoiceCallbackDto,
    status: InvoiceStatus,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: status,
        txHash: dto.txHash,
        logIndex: dto.logIndex,
        paidAmount: BigInt(dto.amount),
        fromAddress: dto.fromAddress,
        fee: dto.fee ? BigInt(dto.fee) : null,
      },
    });
  }

  private async creditInvoice(invoice: Invoice, dto: InvoiceCallbackDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.ledger.deposit(
        invoice.currency,
        invoice.network,
        dto.amount,
        invoice.userId,
        tx,
      );
      await this.savePaymentDetails(invoice, dto, 'PAID', tx);
    });
  }

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    const ttlSeconds = Number(
      this.config.getOrThrow<string>('INVOICE_TTL_SECONDS'),
    );
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const address = generateInvoiceAddress();

    const invoice = await this.prisma.invoice.create({
      data: {
        address,
        userId: userId,
        expectedAmount: BigInt(dto.amount),
        currency: dto.currency,
        network: dto.network,
        expiresAt,
      },
    });

    return {
      id: invoice.id,
      address: invoice.address,
      amount: invoice.expectedAmount.toString(),
      currency: invoice.currency,
      network: invoice.network,
      status: invoice.status,
      expiresAt: invoice.expiresAt,
      createdAt: invoice.createdAt,
    };
  }

  async handleCallback(dto: InvoiceCallbackDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { address: dto.address },
    });
    if (!invoice) throw new NotFoundException();
    if (dto.status === 'failed') return;
    if (invoice.txHash === dto.txHash && invoice.logIndex === dto.logIndex) {
      return;
    }
    const asset = this.resolver.resolve(dto.chainId, dto.tokenContract ?? null);
    const matches =
      asset &&
      asset.currency === invoice.currency &&
      asset.network === invoice.network &&
      BigInt(dto.amount) === invoice.expectedAmount;
    if (!matches) return this.savePaymentDetails(invoice, dto, 'MANUAL_REVIEW');
    if (invoice.status === 'EXPIRED') {
      return this.savePaymentDetails(invoice, dto, 'EXPIRED_PAID');
    }
    if (invoice.status === 'PENDING') return this.creditInvoice(invoice, dto);
    return this.savePaymentDetails(invoice, dto, 'MANUAL_REVIEW');
  }
}
