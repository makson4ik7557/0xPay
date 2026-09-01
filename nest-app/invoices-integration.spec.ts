import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './src/prisma/prisma.service';
import { InvoicesService } from './src/invoices/invoices.service';
import { cleanDatabase } from './src/test-utils/clean-database';

describe('invoices integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let invoicesService: InvoicesService;

  const TTL_SECONDS = 900;
  const config = {
    getOrThrow: () => String(TTL_SECONDS),
  } as unknown as ConfigService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'inherit',
    });
    prisma = new PrismaService();
    await prisma.onModuleInit();
    invoicesService = new InvoicesService(prisma, config);
  }, 120000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('creates a PENDING invoice with expiresAt = now + TTL', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@email.com', passwordHash: 'hash' },
    });

    const before = Date.now();
    const invoice = await invoicesService.createInvoice(
      { currency: 'ETH', network: 'SEPOLIA', amount: '1000' },
      user.id,
    );
    const after = Date.now();

    expect(invoice.status).toBe('PENDING');
    expect(invoice.address).toMatch(/^0x[0-9a-f]{40}$/);

    const expiresAt = invoice.expiresAt.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + TTL_SECONDS * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + TTL_SECONDS * 1000);
  });

  it('persists the invoice against the given user', async () => {
    const user = await prisma.user.create({
      data: { email: 'owner@email.com', passwordHash: 'hash' },
    });

    const invoice = await invoicesService.createInvoice(
      { currency: 'ETH', network: 'SEPOLIA', amount: '42' },
      user.id,
    );

    const inDb = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(inDb).not.toBeNull();
    expect(inDb?.userId).toBe(user.id);
    expect(inDb?.amount).toBe(42n);
    expect(inDb?.status).toBe('PENDING');
  });
});
