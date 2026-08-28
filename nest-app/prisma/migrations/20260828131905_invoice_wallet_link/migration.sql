/*
  Warnings:

  - A unique constraint covering the columns `[address]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `walletId` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "walletId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_address_key" ON "Invoice"("address");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
