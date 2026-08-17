import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from './src/prisma/prisma.service';
import { cleanDatabase } from './src/test-utils/clean-database';
import {RateLimitGuard} from './src/auth/guards/rate-limit.guard';

describe('auth integration', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    execSync('npx prisma migrate deploy',{
      env: process.env,
      stdio: 'inherit'
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    await app.init()
  });

  afterAll(async () => {
    await app!.close();
    await container.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('registers a new user successfully', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass'
    });
    const inDb = await prisma.user.findUnique({ where: { email: 'test@email.com' } });
    expect(res.status).toBe(201);
    expect(inDb).not.toBeNull();
  });

  it('returns 409 when email already exists', async () => {
    const res1 = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass',
    });
    const res2 = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass',
    });
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(409);
  });

  it('logs in successfully with correct credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@email.com',
        password: 'pass',
      });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@email.com',
        password: 'pass',
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
  });

  it('returns 401 with wrong password', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@email.com',
      password: 'pass',
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@email.com',
        password: 'wrongPassword',
      });
    expect(loginRes.status).toBe(401);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 and user data with a valid token', async () => {
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
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@email.com');
  });
})