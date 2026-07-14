/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "idempotencyKey" TEXT,
ALTER COLUMN "transactionHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");
