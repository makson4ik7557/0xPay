import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { seedSystemAccounts } from './seed-system-accounts';

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await seedSystemAccounts(this.prisma);
  }

  async deposit(publicId: string, amount: string, userId: number) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        publicId: publicId,
        userId: userId,
      },
    });
    if (!wallet) throw new NotFoundException();
    const userAccount = await this.prisma.account.upsert({
      where: { walletId: wallet.id },
      create: {
        type: 'USER',
        walletId: wallet.id,
        currency: wallet.currency,
        network: wallet.network,
      },
      update: {},
    });
    const systemAccount = await this.prisma.account.findFirst({
      where: {
        type: 'SYSTEM',
        currency: wallet.currency,
        network: wallet.network,
      },
    });
    if (!systemAccount) throw new NotFoundException();

    await this.prisma.$transaction(async (tx) => {
      const tx1 = await tx.transaction.create({
        data: { type: 'deposit', amount: BigInt(amount), walletId: wallet.id },
      });
      await tx.ledgerEntry.create({
        data: {
          transactionId: tx1.id,
          accountId: userAccount.id,
          amount: BigInt(amount),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          transactionId: tx1.id,
          accountId: systemAccount.id,
          amount: -BigInt(amount),
        },
      });
    });
  }

  async withdrawal(publicId: string, amount: string, userId: number) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        publicId: publicId,
        userId: userId,
      },
    });
    if (!wallet) throw new NotFoundException();
    const userAccount = await this.prisma.account.findUnique({
      where: {
        walletId: wallet.id,
      },
    });
    if (!userAccount) throw new ConflictException();
    const systemAccount = await this.prisma.account.findFirst({
      where: {
        type: 'SYSTEM',
        currency: wallet.currency,
        network: wallet.network,
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
          walletId: wallet.id,
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
  async getWalletBalance(publicId: string, userId: number) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        publicId: publicId,
        userId: userId,
      },
    });
    if (!wallet) throw new NotFoundException();

    const userAccount = await this.prisma.account.findFirst({
      where: { walletId: wallet.id },
    });
    if (!userAccount) return { balance: '0' };

    const balance = await this.prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { accountId: userAccount.id },
    });
    return { balance: (balance._sum.amount ?? 0n).toString() };
  }
}