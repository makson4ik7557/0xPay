import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './src/prisma/prisma.service';
import { InvoicesService } from './src/invoices/invoices.service';
import { LedgerService } from './src/ledger/ledger.service';
import { AssetResolverService } from './src/invoices/asset-resolver.service';
import { InvoiceCallbackDto } from './src/invoices/dto/invoice-callback.dto';
import { InvoiceStatus } from './src/generated/client';
import { cleanDatabase } from './src/test-utils/clean-database';

describe('invoice callback integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let ledger: LedgerService;
  let service: InvoicesService;

  const config = {
    getOrThrow: () => '900',
  } as unknown as ConfigService;

  const ADDRESS = `0x${'a'.repeat(40)}`;

  async function createPayer() {
    return prisma.user.create({
      data: { email: 'payer@email.com', passwordHash: 'hash' },
    });
  }

  async function createInvoice(
    userId: number,
    overrides: Partial<{
      status: InvoiceStatus;
      expectedAmount: bigint;
      expiresAt: Date;
    }> = {},
  ) {
    return prisma.invoice.create({
      data: {
        address: ADDRESS,
        userId,
        expectedAmount: overrides.expectedAmount ?? 1000n,
        currency: 'ETH',
        network: 'SEPOLIA',
        status: overrides.status ?? 'PENDING',
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 900_000),
      },
    });
  }

  function callback(overrides: Partial<InvoiceCallbackDto> = {}): InvoiceCallbackDto {
    return {
      address: ADDRESS,
      txHash: '0xtxhash',
      logIndex: 0,
      amount: '1000',
      blockNumber: 100,
      chainId: 11155111,
      fromAddress: '0xsender',
      timestamp: 1_700_000_000,
      status: 'success',
      ...overrides,
    };
  }

  async function balanceOf(userId: number) {
    const { balance } = await ledger.getBalance('ETH', 'SEPOLIA', userId);
    return balance;
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
    ledger = new LedgerService(prisma);
    service = new InvoicesService(
      prisma,
      config,
      ledger,
      new AssetResolverService(),
    );
  }, 120000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await ledger.onModuleInit();
  });

  it('PENDING + matching payment → PAID and credits the ledger', async () => {
    const user = await createPayer();
    const invoice = await createInvoice(user.id);

    await service.handleCallback(callback({ fee: '21' }));

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('PAID');
    expect(updated?.paidAmount).toBe(1000n);
    expect(updated?.txHash).toBe('0xtxhash');
    expect(updated?.logIndex).toBe(0);
    expect(updated?.fromAddress).toBe('0xsender');
    expect(updated?.fee).toBe(21n);

    expect(await balanceOf(user.id)).toBe('1000');
  });

  it('EXPIRED + matching payment → EXPIRED_PAID and does NOT credit', async () => {
    const user = await createPayer();
    const invoice = await createInvoice(user.id, { status: 'EXPIRED' });

    await service.handleCallback(callback());

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('EXPIRED_PAID');
    expect(updated?.paidAmount).toBe(1000n);
    expect(await balanceOf(user.id)).toBe('0');
  });

  it('amount mismatch → MANUAL_REVIEW and does NOT credit', async () => {
    const user = await createPayer();
    const invoice = await createInvoice(user.id, { expectedAmount: 1000n });

    await service.handleCallback(callback({ amount: '999' }));

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('MANUAL_REVIEW');
    expect(await balanceOf(user.id)).toBe('0');
  });

  it('unknown token contract → MANUAL_REVIEW and does NOT credit', async () => {
    const user = await createPayer();
    const invoice = await createInvoice(user.id);

    await service.handleCallback(
      callback({ tokenContract: `0x${'b'.repeat(40)}` }),
    );

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('MANUAL_REVIEW');
    expect(await balanceOf(user.id)).toBe('0');
  });

  it('duplicate (txHash, logIndex) → does not credit twice', async () => {
    const user = await createPayer();
    await createInvoice(user.id);

    await service.handleCallback(callback());
    await service.handleCallback(callback());

    expect(await balanceOf(user.id)).toBe('1000');
  });

  it('status: failed → ignored, invoice stays PENDING', async () => {
    const user = await createPayer();
    const invoice = await createInvoice(user.id);

    await service.handleCallback(callback({ status: 'failed' }));

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(updated?.status).toBe('PENDING');
    expect(await balanceOf(user.id)).toBe('0');
  });

  it('unknown address → 404', async () => {
    await expect(
      service.handleCallback(callback({ address: `0x${'c'.repeat(40)}` })),
    ).rejects.toThrow();
  });

  it('DB rejects a second invoice with the same (txHash, logIndex) — idempotency backstop', async () => {
    const user = await createPayer();
    await createInvoice(user.id);
    await service.handleCallback(callback());

    const other = await prisma.invoice.create({
      data: {
        address: `0x${'d'.repeat(40)}`,
        userId: user.id,
        expectedAmount: 1000n,
        currency: 'ETH',
        network: 'SEPOLIA',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 900_000),
      },
    });

    await expect(
      prisma.invoice.update({
        where: { id: other.id },
        data: { txHash: '0xtxhash', logIndex: 0 },
      }),
    ).rejects.toThrow();
  });
});
