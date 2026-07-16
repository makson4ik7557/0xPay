/*
  Warnings:

  - The required column `publicId` was added to the `Transaction` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `publicId` was added to the `Wallet` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "publicId" TEXT NOT NULL;
