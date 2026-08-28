import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaService } from './src/prisma/prisma.service';
import { InvoiceExpiryService } from './src/invoices/invoice-expiry.service';
import { WatchlistNotifier } from './src/invoices/watchlist.notifier';
import { cleanDatabase } from './src/test-utils/clean-database';

describe('invoice expiry integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let watchlist: WatchlistNotifier;
  let service: InvoiceExpiryService;

  async function createUser(email = 'exp@email.com') {
    return prisma.user.create({ data: { email, passwordHash: 'hash' } });
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'inherit',
    });
    prisma = new PrismaService();
    await prisma.onModuleInit();
    watchlist = new WatchlistNotifier();
    service = new InvoiceExpiryService(prisma, watchlist);
  }, 120000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('expires a PENDING invoice past expiresAt and notifies the watchlist', async () => {
    const user = await createUser();
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        address: 'PLACEHOLDER_ADDRESS',
        currency: 'ETH',
        network: 'SEPOLIA',
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        address: '0xpast',
        walletId: wallet.id,
        amount: 100n,
        currency: 'ETH',
        network: 'SEPOLIA',
        expiresAt: new Date(Date.now() - 60_000),
        userId: user.id,
      },
    });
    const removeSpy = vi.spyOn(watchlist, 'remove');

    const count = await service.sweepExpired();

    expect(count).toBe(1);
    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('EXPIRED');
    expect(removeSpy).toHaveBeenCalledWith('0xpast');
    removeSpy.mockRestore();
  });

  it('leaves a not-yet-expired PENDING invoice untouched', async () => {
    const user = await createUser('future@email.com');
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        address: 'PLACEHOLDER_ADDRESS',
        currency: 'ETH',
        network: 'SEPOLIA',
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        address: '0xfuture',
        walletId: wallet.id,
        amount: 100n,
        currency: 'ETH',
        network: 'SEPOLIA',
        expiresAt: new Date(Date.now() + 60_000),
        userId: user.id,
      },
    });
    const removeSpy = vi.spyOn(watchlist, 'remove');

    const count = await service.sweepExpired();

    expect(count).toBe(0);
    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('PENDING');
    expect(removeSpy).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
