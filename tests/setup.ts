let vitestWorkerId = process.env.VITEST_WORKER_ID ?? "unknown";
let idForRedis = Number(vitestWorkerId) % 15 + 1;
process.env.REDIS_URL = `redis://localhost:6379/${idForRedis}`;
process.env.DATABASE_URL = `postgresql://0xpay_user:local_dev_password@localhost:5432/0xpay_test`;