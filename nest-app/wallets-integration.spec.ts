import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaService } from './src/prisma/prisma.service';
import { WalletsService } from './src/wallets/wallets.service';
import { cleanDatabase } from './src/test-utils/clean-database';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('wallets integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let walletsService: WalletsService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'inherit',
    });
    prisma = new PrismaService();
    await prisma.onModuleInit();
    walletsService = new WalletsService(prisma);
  }, 120000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('creates a wallet in the real database', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@test.com', passwordHash: 'hash' },
    });
    await walletsService.createWallet(
      {
        currency: 'BTC',
        network: 'BITCOIN',
      },
      user.id,
    );
    const inDb = await prisma.wallet.findFirst({ where: { userId: user.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.currency).toBe('BTC');
  });

  it('returns only wallets of the given user', async () => {
    const userA = await prisma.user.create({
      data: { email: 'a@test.com', passwordHash: 'hash' },
    });
    const userB = await prisma.user.create({
      data: { email: 'b@test.com', passwordHash: 'h' },
    });

    await walletsService.createWallet(
      {
        currency: 'BTC',
        network: 'BITCOIN',
      },
      userA.id,
    );
    await walletsService.createWallet(
      { currency: 'ETH', network: 'ERC-20' },
      userA.id,
    );
    await walletsService.createWallet(
      { currency: 'ETH', network: 'ARBITRUM' },
      userB.id,
    );
    const wallets = await walletsService.allUserWallets(userA.id);
    expect(wallets).toHaveLength(2);
  });

  it('gets a wallet by publicId', async () => {
    const user = await prisma.user.create({
      data: { email: 'a@test.com', passwordHash: 'hash' },
    });
    const wallet = await walletsService.createWallet(
      {
        currency: 'BTC',
        network: 'BITCOIN',
      },
      user.id,
    );
    const publicId = wallet.publicId;
    const specificWallet = await walletsService.getWallet(publicId,user.id)
    expect(specificWallet.publicId).toBe(publicId);
  });

  it('returns 404 for another user\'s wallet', async () => {
    const userA = await prisma.user.create({
      data: { email: 'a@test.com', passwordHash: 'hash' },
    });
    const userB = await prisma.user.create({
      data: { email: 'b@test.com', passwordHash: 'h' },
    });
    const walletA = await walletsService.createWallet(
      {
        currency: 'BTC',
        network: 'BITCOIN',
      },
      userA.id,
    );
    const publicIdA = walletA.publicId;
    await walletsService.createWallet(
      {
        currency: 'ETH',
        network: 'OPTIMISM',
      },
      userB.id,
    );
    await expect(walletsService.getWallet(publicIdA, userB.id)).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid currency/network', async () => {
    const user = await prisma.user.create({
      data: { email: 'a@test.com', passwordHash: 'hash' },
    });
    await expect(
      walletsService.createWallet(
        {
          currency: 'BTC',
          network: 'TRC-20',
        },
        user.id,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
