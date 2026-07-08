import { beforeEach, afterAll, test, expect } from "vitest";
import { prisma } from "../prisma.js";
import request from 'supertest';
import app from "../app.js"

beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany();
});

afterAll(async () => {
    await prisma.$disconnect();
});

test('POST /auth/register → 201', async () => {
    const email = "test@email.com";
    const registration = {
        email: email ,
        password: "labubu212",
        confirmPassword: "labubu212"
    }
    const res = await request(app).post('/auth/register').send(registration);
    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(res.status).toBe(201);
    expect(userInDb).not.toBeNull();
});

test("POST /auth/register дубль email → 409", async () => {
    const email = "test@email.com";
    const registration = {
        email: email ,
        password: "labubu212",
        confirmPassword: "labubu212"
    }
    const res = await request(app).post('/auth/register').send(registration);
    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(res.status).toBe(201);
    expect(userInDb).not.toBeNull();
    const res2 = await request(app).post('/auth/register').send(registration);
    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);
    expect(res2.status).toBe(409);
});