/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Wallet_publicId_key" ON "Wallet"("publicId");
