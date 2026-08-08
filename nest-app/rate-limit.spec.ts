import { cleanRedis } from './src/test-utils/clean-redis';
import Redis from 'ioredis';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './src/prisma/prisma.service';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { cleanDatabase } from './src/test-utils/clean-database';
import request from 'supertest';

describe('rate-limiter integration', () => {
  let redisContainer: StartedRedisContainer;
  let postgresContainer: StartedPostgreSqlContainer;
  let redis: Redis;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    redisContainer = await new RedisContainer('redis:7').start();
    process.env.REDIS_URL = redisContainer.getConnectionUrl();
    redis = new Redis(process.env.REDIS_URL);
    postgresContainer = await new PostgreSqlContainer('postgres:17').start();
    process.env.DATABASE_URL = postgresContainer.getConnectionUri();
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'inherit',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    await app.init();
  }, 60000);

  beforeEach(async () => {
    await cleanRedis(redis);
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await postgresContainer.stop();
    redis.disconnect();
    await redisContainer.stop();
  });

  it('blocks after limit', async () => {
    const body = { email: 'nope@test.com', password: 'whatever123' };
    const res1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    const res2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    const res3 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    const res4 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    const res5 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    const res6 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res3.status).toBe(401);
    expect(res4.status).toBe(401);
    expect(res5.status).toBe(401);
    expect(res6.status).toBe(429);
  });

  it('resets counter between tests', async () => {
    const body = { email: 'nope@test.com', password: 'whatever123' };
    const res1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body);
    expect(res1.status).not.toBe(429);
  });
})

