-- ============================================================================
-- Phase 15: Pilot Launch Tools, Guardrails, Quality Review & Support Desk
-- ============================================================================

-- AlterEnum: FilePurpose
ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'FEEDBACK_ATTACHMENT';

-- AlterEnum: LegalDocumentType
ALTER TYPE "LegalDocumentType" ADD VALUE IF NOT EXISTS 'PILOT_TERMS';

-- AlterEnum: ReportType
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'PILOT_WEEKLY';

-- CreateTable: invite_codes
CREATE TABLE IF NOT EXISTS "invite_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "campaign_id" UUID,
    "city_id" UUID,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ,
    "metadata" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: waitlist_entries
CREATE TABLE IF NOT EXISTS "waitlist_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "city_id" UUID,
    "city_name" TEXT,
    "vehicle_type" TEXT,
    "company_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: anomaly_findings
CREATE TABLE IF NOT EXISTS "anomaly_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_key" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: review_second_looks
CREATE TABLE IF NOT EXISTS "review_second_looks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "photo_id" UUID NOT NULL,
    "original_reviewer_id" UUID,
    "original_outcome" TEXT NOT NULL,
    "second_reviewer_id" UUID,
    "second_outcome" TEXT,
    "decision_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "review_second_looks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: feedbacks
CREATE TABLE IF NOT EXISTS "feedbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "category" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "nps_score" INTEGER,
    "comment" TEXT,
    "attachment_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: support_requests
CREATE TABLE IF NOT EXISTS "support_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_number" TEXT NOT NULL,
    "user_id" UUID,
    "role" "Role",
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "type" TEXT NOT NULL DEFAULT 'TICKET',
    "preferred_time" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" UUID,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: print_shops
CREATE TABLE IF NOT EXISTS "print_shops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "city_id" UUID,
    "city_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT NOT NULL,
    "operating_hours" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pilot_report_notes
CREATE TABLE IF NOT EXISTS "pilot_report_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "author_id" UUID NOT NULL,
    "narrative" TEXT NOT NULL,
    "blockers" TEXT,
    "highlights" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_report_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndices
CREATE UNIQUE INDEX IF NOT EXISTS "invite_codes_code_key" ON "invite_codes"("code");
CREATE INDEX IF NOT EXISTS "invite_codes_role_status_idx" ON "invite_codes"("role", "status");
CREATE INDEX IF NOT EXISTS "invite_codes_code_idx" ON "invite_codes"("code");

CREATE INDEX IF NOT EXISTS "waitlist_entries_role_status_idx" ON "waitlist_entries"("role", "status");
CREATE INDEX IF NOT EXISTS "waitlist_entries_phone_idx" ON "waitlist_entries"("phone");
CREATE INDEX IF NOT EXISTS "waitlist_entries_email_idx" ON "waitlist_entries"("email");

CREATE INDEX IF NOT EXISTS "anomaly_findings_status_severity_idx" ON "anomaly_findings"("status", "severity");
CREATE INDEX IF NOT EXISTS "anomaly_findings_entity_type_entity_id_idx" ON "anomaly_findings"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "review_second_looks_status_idx" ON "review_second_looks"("status");
CREATE INDEX IF NOT EXISTS "review_second_looks_photo_id_idx" ON "review_second_looks"("photo_id");

CREATE INDEX IF NOT EXISTS "feedbacks_role_category_idx" ON "feedbacks"("role", "category");
CREATE INDEX IF NOT EXISTS "feedbacks_status_idx" ON "feedbacks"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "support_requests_ticket_number_key" ON "support_requests"("ticket_number");
CREATE INDEX IF NOT EXISTS "support_requests_status_priority_idx" ON "support_requests"("status", "priority");
CREATE INDEX IF NOT EXISTS "support_requests_type_idx" ON "support_requests"("type");

CREATE INDEX IF NOT EXISTS "print_shops_city_name_status_idx" ON "print_shops"("city_name", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "pilot_report_notes_year_week_number_key" ON "pilot_report_notes"("year", "week_number");

-- ForeignKeys
ALTER TABLE "invite_codes" DROP CONSTRAINT IF EXISTS "invite_codes_created_by_id_fkey";
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "anomaly_findings" DROP CONSTRAINT IF EXISTS "anomaly_findings_resolved_by_id_fkey";
ALTER TABLE "anomaly_findings" ADD CONSTRAINT "anomaly_findings_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_second_looks" DROP CONSTRAINT IF EXISTS "review_second_looks_photo_id_fkey";
ALTER TABLE "review_second_looks" ADD CONSTRAINT "review_second_looks_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_second_looks" DROP CONSTRAINT IF EXISTS "review_second_looks_original_reviewer_id_fkey";
ALTER TABLE "review_second_looks" ADD CONSTRAINT "review_second_looks_original_reviewer_id_fkey" FOREIGN KEY ("original_reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_second_looks" DROP CONSTRAINT IF EXISTS "review_second_looks_second_reviewer_id_fkey";
ALTER TABLE "review_second_looks" ADD CONSTRAINT "review_second_looks_second_reviewer_id_fkey" FOREIGN KEY ("second_reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feedbacks" DROP CONSTRAINT IF EXISTS "feedbacks_user_id_fkey";
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_requests" DROP CONSTRAINT IF EXISTS "support_requests_user_id_fkey";
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_requests" DROP CONSTRAINT IF EXISTS "support_requests_assigned_to_id_fkey";
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pilot_report_notes" DROP CONSTRAINT IF EXISTS "pilot_report_notes_author_id_fkey";
ALTER TABLE "pilot_report_notes" ADD CONSTRAINT "pilot_report_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

