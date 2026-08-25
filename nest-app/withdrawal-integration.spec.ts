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

describe('deposit integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let app: INestApplication;

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
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@email.com',
        password: 'pass',
      });

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        currency: 'BTC',
        network: 'BITCOIN',
      });

    await request(app.getHttpServer())
      .post(`/wallets/${wallet.body.publicId}/deposits`)
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        amount: '67',
      });

    const withdrawal = await request(app.getHttpServer())
      .post(`/wallets/${wallet.body.publicId}/withdrawal`)
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        amount: '66',
      });

    const tx = await prisma.transaction.findFirst({
      where: {
        type: 'withdrawal',
      },
    });
    expect(tx).not.toBeNull();
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        transactionId: tx!.id,
      },
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

  it('creates a bigger withdrawal than deposit', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@email.com',
        password: 'pass',
      });

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        currency: 'BTC',
        network: 'BITCOIN',
      });

    await request(app.getHttpServer())
      .post(`/wallets/${wallet.body.publicId}/deposits`)
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        amount: '52',
      });

    const withdrawal = await request(app.getHttpServer())
      .post(`/wallets/${wallet.body.publicId}/withdrawal`)
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        amount: '322',
      });
    expect(withdrawal.status).toBe(409);
  });

  it('prevents concurrent overdraw', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@email.com',
        password: 'pass',
      });

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        currency: 'BTC',
        network: 'BITCOIN',
      });

    await request(app.getHttpServer())
      .post(`/wallets/${wallet.body.publicId}/deposits`)
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        amount: '100',
      });

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/wallets/${wallet.body.publicId}/withdrawal`)
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .send({ amount: '80' }),
      request(app.getHttpServer())
        .post(`/wallets/${wallet.body.publicId}/withdrawal`)
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .send({ amount: '80' }),
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
