/*
  Warnings:

  - You are about to drop the column `amount` on the `Invoice` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[txHash,logIndex]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expectedAmount` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'MANUAL_REVIEW';

-- DropIndex
DROP INDEX "Invoice_txHash_key";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "amount",
ADD COLUMN     "expectedAmount" BIGINT NOT NULL,
ADD COLUMN     "fee" BIGINT,
ADD COLUMN     "fromAddress" TEXT,
ADD COLUMN     "logIndex" INTEGER,
ADD COLUMN     "paidAmount" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_txHash_logIndex_key" ON "Invoice"("txHash", "logIndex");
