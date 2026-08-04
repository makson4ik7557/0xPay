import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';

describe('redis testcontainer', () => {
  let container: StartedRedisContainer;
  let redis: Redis;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7').start();
    redis = new Redis(container.getConnectionUrl());
  }, 60000);

  afterAll(async () => {
    redis.disconnect();
    await container.stop();
  });

  it('sets and gets a value', async () => {
    await redis.set('mykey', 'hello');
    const value = await redis.get('mykey');
    expect(value).toBe('hello');
  });
});
