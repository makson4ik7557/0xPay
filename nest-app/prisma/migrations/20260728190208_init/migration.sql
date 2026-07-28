-- CreateEnum
CREATE TYPE "Type" AS ENUM ('deposit', 'withdrawal');

-- CreateEnum
CREATE TYPE "PossibleStatus" AS ENUM ('pending', 'confirmed');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "publicId" TEXT NOT NULL,
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "publicId" TEXT NOT NULL,
    "id" SERIAL NOT NULL,
    "transactionHash" TEXT,
    "idempotencyKey" TEXT,
    "type" "Type" NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PossibleStatus" NOT NULL DEFAULT 'pending',
    "walletId" INTEGER NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "AccountType" NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "walletId" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_publicId_key" ON "Wallet"("publicId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionHash_key" ON "Transaction"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_walletId_idx" ON "Transaction"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_walletId_key" ON "Account"("walletId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
