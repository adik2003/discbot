/*
  Warnings:

  - The primary key for the `Attendance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_pkey",
ADD COLUMN     "username" TEXT NOT NULL DEFAULT 'Unknown',
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "clockIn" DROP NOT NULL,
ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id");
