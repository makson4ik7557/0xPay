import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaService } from './src/prisma/prisma.service';
import { WalletsService } from './src/wallets/wallets.service';

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

  it('creates a wallet in the real database', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@test.com', passwordHash: 'hash' },
    });
    const wallet = await walletsService.createWallet({
      currency: 'BTC',
      network: 'BITCOIN',
    }, user.id);
    const inDb = await prisma.wallet.findFirst({ where: { userId: user.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.currency).toBe('BTC');
  });
});
