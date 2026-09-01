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
    const { token } = await setupUser();

    const dep = await request(app.getHttpServer())
      .post('/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'BTC', network: 'BITCOIN', amount: '67' });

    expect(dep.status).toBe(201);
  });

  it('sum of system and user accounts gives 0', async () => {
    const { token } = await setupUser();

    await request(app.getHttpServer())
      .post('/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'BTC', network: 'BITCOIN', amount: '67' });

    const tx = await prisma.transaction.findFirst({
      where: { type: 'deposit' },
    });
    expect(tx).not.toBeNull();

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { transactionId: tx!.id },
    });

    const sum = ledgerEntries.reduce(
      (acc, current) => acc + current.amount,
      0n,
    );
    expect(ledgerEntries.length).toBe(2);
    expect(sum).toBe(0n);
  });

  it('keeps balances isolated per user', async () => {
    const a = await setupUser('a@email.com');
    const b = await setupUser('b@email.com');

    await request(app.getHttpServer())
      .post('/deposits')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ currency: 'BTC', network: 'BITCOIN', amount: '67' });

    const balanceB = await request(app.getHttpServer())
      .get('/balance?currency=BTC&network=BITCOIN')
      .set('Authorization', `Bearer ${b.token}`);

    expect(balanceB.body.balance).toBe('0');
  });

  it('returns the deposited balance', async () => {
    const { token } = await setupUser();

    await request(app.getHttpServer())
      .post('/deposits')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'BTC', network: 'BITCOIN', amount: '67' });

    const balance = await request(app.getHttpServer())
      .get('/balance?currency=BTC&network=BITCOIN')
      .set('Authorization', `Bearer ${token}`);

    expect(balance.body.balance).toBe('67');
  });
});
