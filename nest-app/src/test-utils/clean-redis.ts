import Redis from 'ioredis';

export async function cleanRedis(redis: Redis) {
  await redis.flushdb();
}
