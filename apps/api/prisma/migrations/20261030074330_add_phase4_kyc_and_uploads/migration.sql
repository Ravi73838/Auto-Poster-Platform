-- CreateEnum
CREATE TYPE "KycSubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'NEED_MORE_INFO');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('KYC_DOCUMENT', 'CAMPAIGN_POSTER', 'INSTALLATION_PHOTO', 'DAILY_PHOTO', 'DISPUTE_EVIDENCE', 'VEHICLE_PHOTO');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'LOCATION', 'CAMERA', 'POSTER_POLICY');

-- CreateEnum
CREATE TYPE "KycReasonCode" AS ENUM ('DOCUMENT_UNCLEAR', 'DOCUMENT_EXPIRED', 'DOCUMENT_MISSING', 'NAME_MISMATCH', 'VEHICLE_NUMBER_MISMATCH', 'OWNER_PERMISSION_MISSING', 'DUPLICATE_ACCOUNT', 'INVALID_GST', 'PAYOUT_DETAILS_INVALID', 'OTHER');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reject_reason_code" "KycReasonCode",
ADD COLUMN     "uploaded_file_id" UUID,
ALTER COLUMN "file_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "bank_account_fingerprint" VARCHAR(64),
ADD COLUMN     "payout_details_changed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "sha256" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" "KycSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "review_reasons" JSONB,
    "profile_snapshot" JSONB NOT NULL,
    "duplicate_flags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_files_file_key_key" ON "uploaded_files"("file_key");

-- CreateIndex
CREATE INDEX "uploaded_files_owner_user_id_idx" ON "uploaded_files"("owner_user_id");

-- CreateIndex
CREATE INDEX "uploaded_files_status_idx" ON "uploaded_files"("status");

-- CreateIndex
CREATE INDEX "consent_records_user_id_idx" ON "consent_records"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_user_id_type_version_key" ON "consent_records"("user_id", "type", "version");

-- CreateIndex
CREATE INDEX "kyc_submissions_status_submitted_at_idx" ON "kyc_submissions"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "kyc_submissions_assigned_to_id_status_idx" ON "kyc_submissions"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "kyc_submissions_user_id_idx" ON "kyc_submissions"("user_id");

-- CreateIndex
CREATE INDEX "documents_uploaded_file_id_idx" ON "documents"("uploaded_file_id");

-- CreateIndex
CREATE INDEX "documents_user_id_document_type_is_current_idx" ON "documents"("user_id", "document_type", "is_current");

-- CreateIndex
CREATE INDEX "driver_profiles_bank_account_fingerprint_idx" ON "driver_profiles"("bank_account_fingerprint");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_file_id_fkey" FOREIGN KEY ("uploaded_file_id") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
