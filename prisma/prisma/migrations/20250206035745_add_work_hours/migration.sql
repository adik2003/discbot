/*
  Warnings:

  - Made the column `clockIn` on table `Attendance` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "clockIn" SET NOT NULL,
ALTER COLUMN "clockIn" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "WorkHours" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalHours" INTEGER NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkHours_userId_key" ON "WorkHours"("userId");
