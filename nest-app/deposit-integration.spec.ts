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
import {seedSystemAccounts} from './src/ledger/seed-system-accounts'

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

  it('creates a successful deposit', async () => {
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

    const wallet = await request(app.getHttpServer()).post('/wallets').set('Authorization', `Bearer ${loginRes.body.token}`).send({
      currency: 'BTC',
      network: 'BITCOIN',
    });

    const dep = await request(app.getHttpServer())
      .post(`/wallets/${wallet.body.publicId}/deposits`)
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        amount: '67',
      });
    expect(dep.status).toBe(201);
  });

  it('sum of system and user accounts gives 0', async () => {
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

    const tx = await prisma.transaction.findFirst({
      where: {
        type: 'deposit'
      }
    });
    expect(tx).not.toBeNull();
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        transactionId: tx!.id
      }
    });
    const sum = ledgerEntries.reduce((acc,current) => acc + current.amount, 0n);
    expect(ledgerEntries.length).toBe(2);
    expect(sum).toBe(0n);
  });

  it('deposit to user wallet with different token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test1@email.com',
        password: 'pass',
      });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test2@email.com',
        password: 'pass',
      });

    const loginRes1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@email.com',
        password: 'pass',
      });

    const loginRes2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test2@email.com',
        password: 'pass',
      });

    const user1Wallet = await request(app.getHttpServer())
      .post('/wallets')
      .set('Authorization', `Bearer ${loginRes1.body.token}`)
      .send({
        currency: 'BTC',
        network: 'BITCOIN',
      });

    const tx = await request(app.getHttpServer())
      .post(`/wallets/${user1Wallet.body.publicId}/deposits`)
      .set('Authorization', `Bearer ${loginRes2.body.token}`)
      .send({
        amount: '67',
      });
    expect(tx.status).toBe(404);
  });

  it('returns wallet balance', async () => {
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

    const balance = await request(app.getHttpServer())
      .get(`/wallets/${wallet.body.publicId}/balance`)
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(balance.body.balance).toBe('67');
  });
});
