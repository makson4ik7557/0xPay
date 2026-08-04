import { PrismaService } from '../prisma/prisma.service';

export async function cleanDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LedgerEntry", "Transaction", "Account", "Wallet", "User"
    RESTART IDENTITY CASCADE
  `);
}
