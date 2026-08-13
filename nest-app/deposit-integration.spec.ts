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
});
