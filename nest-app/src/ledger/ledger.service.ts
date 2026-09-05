import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/client';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { seedSystemAccounts } from './seed-system-accounts';

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await seedSystemAccounts(this.prisma);
  }

  async deposit(
    currency: string,
    network: string,
    amount: string,
    userId: number,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) return this.depositCore(tx, currency, network, amount, userId);
    return this.prisma.$transaction((client) =>
      this.depositCore(client, currency, network, amount, userId),
    );
  }

  private async depositCore(
    tx: Prisma.TransactionClient,
    currency: string,
    network: string,
    amount: string,
    userId: number,
  ) {
    const userAccount = await tx.account.upsert({
      where: { userId_currency_network: { userId, currency, network } },
      create: { type: 'USER', userId, currency, network },
      update: {},
    });
    const systemAccount = await tx.account.findFirst({
      where: { type: 'SYSTEM', currency, network },
    });
    if (!systemAccount) throw new NotFoundException();
    const transaction = await tx.transaction.create({
      data: { type: 'deposit', amount: BigInt(amount), userId },
    });
    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: userAccount.id,
        amount: BigInt(amount),
      },
    });
    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: systemAccount.id,
        amount: -BigInt(amount),
      },
    });
  }

  async withdrawal(
    currency: string,
    network: string,
    amount: string,
    userId: number,
  ) {
    const userAccount = await this.prisma.account.findUnique({
      where: {
        userId_currency_network: {
          userId: userId,
          currency: currency,
          network: network,
        },
      },
    });
    if (!userAccount) throw new ConflictException();
    const systemAccount = await this.prisma.account.findFirst({
      where: {
        type: 'SYSTEM',
        currency: currency,
        network: network,
      },
    });
    if (!systemAccount) throw new NotFoundException();

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${userAccount.id} FOR UPDATE`;
      const balance = await tx.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { accountId: userAccount.id },
      });
      const availableBalance = balance._sum.amount ?? 0n;
      if (BigInt(amount) > availableBalance)
        throw new ConflictException('Insufficient balance');

      const tx1 = await tx.transaction.create({
        data: {
          type: 'withdrawal',
          amount: BigInt(amount),
          userId,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          transactionId: tx1.id,
          accountId: userAccount.id,
          amount: -BigInt(amount),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          transactionId: tx1.id,
          accountId: systemAccount.id,
          amount: BigInt(amount),
        },
      });
    });
  }
  async getBalance(currency: string, network: string, userId: number) {
    const userAccount = await this.prisma.account.findFirst({
      where: {
        userId: userId,
        currency: currency,
        network: network,
      },
    });
    if (!userAccount) return { balance: '0' };

    const balance = await this.prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { accountId: userAccount.id },
    });
    return { balance: (balance._sum.amount ?? 0n).toString() };
  }
}
