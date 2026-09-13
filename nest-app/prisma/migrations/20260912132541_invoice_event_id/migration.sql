/*
  Warnings:

  - A unique constraint covering the columns `[eventId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - The required column `eventId` was added to the `Invoice` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "eventId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_eventId_key" ON "Invoice"("eventId");
