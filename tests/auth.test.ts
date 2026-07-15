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

async function registerAndLogin(){
    const email = `test-${crypto.randomUUID()}@example.com`;
    const registration = {
        email: email ,
        password: "labubu212",
        confirmPassword: "labubu212"
    }
    const registrationRes = await request(app).post('/auth/register').send(registration);
    const userInDb = await prisma.user.findUnique({ where: { email } });
    expect(registrationRes.status).toBe(201);
    expect(userInDb).not.toBeNull();
    const loginRes = await request(app).post('/auth/login').send({email:email,password:"labubu212"});
    const token = loginRes.body.token;
    expect(loginRes.status).toBe(200);
    expect(token).toBeDefined();
    return token;
}

async function createWallet(token:string){
    const walletCreationRes = await request(app).post('/wallets').send({currency: "BTC", network: "BITCOIN"}).set('Authorization',`Bearer ${token}`);
    expect(walletCreationRes.status).toBe(201);
    return walletCreationRes.body.id;
}

test('GET /auth/me no token -> 401', async() => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
})

test('POST /auth/register -> 201', async () => {
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

test("POST /auth/register email double -> 409", async () => {
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

test("POST /wallets/:id/deposits - Valid deposit -> 201", async() => {
    const token = await registerAndLogin();
    const walletId = await createWallet(token);
    const depositAmount = 100;
    const depositData = {
        hash: "0xabc5252h1su1",
        amount: depositAmount
    }
    const depositRes = await request(app).post(`/wallets/${walletId}/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    const walletInDb = await prisma.wallet.findUnique({where: {id: walletId}});
    expect(walletInDb).not.toBeNull();
    expect(walletInDb!.balance).toBe(BigInt(depositAmount));
    expect(depositRes.status).toBe(201);
})

test("POST /wallets/:id/deposits - Duplicate hash keeps balance -> 200", async() => {
    const token = await registerAndLogin();
    const walletId = await createWallet(token);
    const depositAmount = 100;
    const depositData = {
        hash: "0xabc5252h1su1",
        amount: depositAmount
    }
    const depositRes = await request(app).post(`/wallets/${walletId}/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    const walletInDb = await prisma.wallet.findUnique({where: {id: walletId}});
    expect(walletInDb).not.toBeNull();
    expect(walletInDb!.balance).toBe(BigInt(depositAmount));
    expect(depositRes.status).toBe(201);
    const secondDepositRes = await request(app).post(`/wallets/${walletId}/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    const updatedWallet = await prisma.wallet.findUnique({where: {id: walletId}});
    const txCount = await prisma.transaction.count({where: {walletId: walletId}});
    expect(txCount).toBe(1);
    expect(secondDepositRes.status).toBe(200);
    expect(updatedWallet!.balance).toBe(BigInt(depositAmount));
})

test("POST /wallets/:id/deposits - deposit to not existed wallet -> 404", async() => {
    const token = await registerAndLogin();
    const depositAmount = 100;
    const depositData = {
        hash: "0xabc5252h1su1",
        amount: depositAmount
    }
    const depositRes = await request(app).post(`/wallets/-1/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    expect(depositRes.status).toBe(404);
})

test("POST /wallets/:id/withdrawals - withdrawal is successful -> 201", async() => {
    const token = await registerAndLogin();
    const walletId = await createWallet(token);
    const depositAmount = 100;
    const depositData = {
        hash: "0xabc5252h1su1",
        amount: depositAmount
    }
    const depositRes = await request(app).post(`/wallets/${walletId}/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    const walletInDb = await prisma.wallet.findUnique({where: {id: walletId}});
    expect(walletInDb).not.toBeNull();
    expect(walletInDb!.balance).toBe(BigInt(depositAmount));
    expect(depositRes.status).toBe(201);
    const withdrawAmount = 50;
    const withdrawData = {
        idempotencyKey: "0xabc5252h1su0-dhg12",
        amount: withdrawAmount
    }
    const withdrawalRes = await request(app).post(`/wallets/${walletId}/withdrawals`).send(withdrawData).set('Authorization',`Bearer ${token}`);
    const walletAfterWithdrawal = await prisma.wallet.findUnique({where: {id: walletId}});
    const tx = await prisma.transaction.findUnique({where: {idempotencyKey: withdrawData.idempotencyKey}});
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe("withdrawal");
    expect(tx!.amount).toBe(BigInt(withdrawAmount));
    expect(walletAfterWithdrawal).not.toBeNull();
    expect(walletAfterWithdrawal!.balance).toBe(50n);
    expect(withdrawalRes.status).toBe(201);
})

test("POST /wallets/:id/withdrawals - idempotency check -> 200", async() => {
    const token = await registerAndLogin();
    const walletId = await createWallet(token);
    const depositAmount = 100;
    const depositData = {
        hash: "0xabc5252h1su1",
        amount: depositAmount
    }
    const depositRes = await request(app).post(`/wallets/${walletId}/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    const withdrawAmount = 50;
    const withdrawData = {
        idempotencyKey: "0xabc5252h1su0-dhg12",
        amount: withdrawAmount
    }
    const withdrawalRes = await request(app).post(`/wallets/${walletId}/withdrawals`).send(withdrawData).set('Authorization',`Bearer ${token}`);
    const secondWithdrawalRes = await request(app).post(`/wallets/${walletId}/withdrawals`).send(withdrawData).set('Authorization',`Bearer ${token}`);
    const tx = await prisma.transaction.findUnique({where: {idempotencyKey: withdrawData.idempotencyKey}});
    const walletAfterWithdrawal = await prisma.wallet.findUnique({where: {id: walletId}});
    const txCount = await prisma.transaction.count({where: {walletId: walletId, type: "withdrawal"}})
    expect(txCount).toBe(1);
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe("withdrawal");
    expect(tx!.amount).toBe(BigInt(withdrawAmount));
    expect(walletAfterWithdrawal).not.toBeNull();
    expect(walletAfterWithdrawal!.balance).toBe(50n);
    expect(secondWithdrawalRes.status).toBe(200);
})

test("POST /wallets/:id/withdrawals - not enough funds -> 409", async() => {
    const token = await registerAndLogin();
    const walletId = await createWallet(token);
    const depositAmount = 100;
    const depositData = {
        hash: "0xabc5252h1su1",
        amount: depositAmount
    }
    const depositRes = await request(app).post(`/wallets/${walletId}/deposits`).send(depositData).set('Authorization',`Bearer ${token}`);
    const walletInDb = await prisma.wallet.findUnique({where: {id: walletId}});
    expect(walletInDb).not.toBeNull();
    expect(walletInDb!.balance).toBe(BigInt(depositAmount));
    expect(depositRes.status).toBe(201);
    const withdrawAmount = 200;
    const withdrawData = {
        idempotencyKey: "0xabc5252h1su0-dhg1221",
        amount: withdrawAmount
    }
    const withdrawalRes = await request(app).post(`/wallets/${walletId}/withdrawals`).send(withdrawData).set('Authorization',`Bearer ${token}`);
    const walletAfterWithdrawal = await prisma.wallet.findUnique({where: {id: walletId}});
    const tx = await prisma.transaction.findUnique({where: {idempotencyKey: withdrawData.idempotencyKey}});
    expect(tx).toBeNull();
    expect(walletAfterWithdrawal).not.toBeNull();
    expect(walletAfterWithdrawal!.balance).toBe(100n);
    expect(withdrawalRes.status).toBe(409);
})