process.env.DATABASE_URL = "postgresql://0xpay_user:local_dev_password@localhost:5432/0xpay_test";
let vitestWorkerId = process.env.VITEST_WORKER_ID ?? "unknown";
let id = Number(vitestWorkerId) % 15 + 1;
process.env.REDIS_URL = `redis://localhost:6379/${id}`;