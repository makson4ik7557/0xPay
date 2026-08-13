import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {NotFoundException} from '@nestjs/common';
import {OnModuleInit} from '@nestjs/common';
import {seedSystemAccounts} from './seed-system-accounts'

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await seedSystemAccounts(this.prisma);
  }

  async deposit(publicId: string, amount: string, userId:number) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        publicId: publicId,
        userId: userId
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
}