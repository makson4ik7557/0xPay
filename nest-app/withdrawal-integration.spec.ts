import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaService } from './src/prisma/prisma.service';
import { cleanDatabase } from './src/test-utils/clean-database';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import { RateLimitGuard } from './src/auth/guards/rate-limit.guard';
import { seedSystemAccounts } from './src/ledger/seed-system-accounts';

describe('withdrawal integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let app: INestApplication;

  async function setupUser(email = 'test@email.com') {
    await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: 'pass',
    });

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
      email,
      password: 'pass',
    });

    return { token: loginRes.body.token as string };
  }

  function deposit(token: string, amount: string) {
    return request(app.getHttpServer())
      .post('/wallets/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'BTC', network: 'BITCOIN', amount });
  }

  function withdraw(token: string, amount: string) {
    return request(app.getHttpServer())
      .post('/wallets/withdrawals')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'BTC', network: 'BITCOIN', amount });
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'inherit',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    await app.init();
  }, 120000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedSystemAccounts(prisma);
  });

  it('creates a successful withdrawal', async () => {
    const { token } = await setupUser();
    await deposit(token, '67');
    const withdrawal = await withdraw(token, '66');

    const tx = await prisma.transaction.findFirst({
      where: { type: 'withdrawal' },
    });
    expect(tx).not.toBeNull();
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { transactionId: tx!.id },
    });
    const ledgerSum = ledgerEntries.reduce(
      (acc, current) => acc + current.amount,
      0n,
    );

    const account = await prisma.account.findFirst({
      where: { type: 'USER' },
    });
    expect(account).not.toBeNull();
    const balance = await prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { accountId: account!.id },
    });
    expect(withdrawal.status).toBe(201);
    expect(balance._sum.amount).toBe(1n);
    expect(ledgerEntries.length).toBe(2);
    expect(ledgerSum).toBe(0n);
  });

  it('rejects a withdrawal bigger than the balance', async () => {
    const { token } = await setupUser();
    await deposit(token, '52');
    const withdrawal = await withdraw(token, '322');
    expect(withdrawal.status).toBe(409);
  });

  it('prevents concurrent overdraw', async () => {
    const { token } = await setupUser();
    await deposit(token, '100');

    const [res1, res2] = await Promise.all([
      withdraw(token, '80'),
      withdraw(token, '80'),
    ]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const account = await prisma.account.findFirst({ where: { type: 'USER' } });
    expect(account).not.toBeNull();
    const balance = await prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { accountId: account!.id },
    });
    expect(balance._sum.amount).toBe(20n);
  });
});
