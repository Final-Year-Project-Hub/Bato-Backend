/*
  Warnings:

  - Added the required column `purpose` to the `Otp` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'FORGOT_PASSWORD');

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "purpose" "OtpPurpose" NOT NULL;
