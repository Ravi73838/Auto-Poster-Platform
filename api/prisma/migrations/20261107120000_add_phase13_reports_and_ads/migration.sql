-- AlterEnum: FilePurpose
ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'LOCAL_AD_IMAGE';
ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'REPORT_DOCUMENT';

-- AlterEnum: ConsentType
ALTER TYPE "ConsentType" ADD VALUE IF NOT EXISTS 'ADS_PERSONALIZATION';

-- CreateEnum: ReportType
DO $$ BEGIN
  CREATE TYPE "ReportType" AS ENUM ('CAMPAIGN_INTERIM', 'CAMPAIGN_FINAL', 'DRIVER_EARNINGS', 'FINANCE_MONTHLY_PACK', 'LOCAL_AD_PERFORMANCE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ReportStatus
DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AdSource
DO $$ BEGIN
  CREATE TYPE "AdSource" AS ENUM ('ADMOB', 'LOCAL', 'DIRECT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: LocalAdCategory
DO $$ BEGIN
  CREATE TYPE "LocalAdCategory" AS ENUM ('TYRE_SHOP', 'FUEL_PUMP', 'MECHANIC', 'AUTO_PARTS', 'INSURANCE', 'FINANCE', 'DRIVER_SERVICES', 'OTHER_APPROVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: LocalAdStatus
DO $$ BEGIN
  CREATE TYPE "LocalAdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'ENDED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: LocalAdFormat
DO $$ BEGIN
  CREATE TYPE "LocalAdFormat" AS ENUM ('BANNER', 'CARD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: LocalAdCtaType
DO $$ BEGIN
  CREATE TYPE "LocalAdCtaType" AS ENUM ('CALL', 'WHATSAPP', 'MAPS', 'LINK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: LocalAdRejectReason
DO $$ BEGIN
  CREATE TYPE "LocalAdRejectReason" AS ENUM ('POLICY_CATEGORY', 'MISLEADING_CLAIMS', 'POOR_IMAGE', 'WRONG_LANGUAGE', 'INVALID_CTA', 'NEEDS_DISCLAIMER', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: generated_reports
CREATE TABLE IF NOT EXISTS "generated_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "superseded_by_id" UUID,
    "file_key" TEXT,
    "file_sha256" TEXT,
    "snapshot_hash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "requested_by_id" UUID,
    "owner_company_id" UUID,
    "owner_driver_id" UUID,
    "generated_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: local_advertisers
CREATE TABLE IF NOT EXISTS "local_advertisers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_name" TEXT NOT NULL,
    "category" "LocalAdCategory" NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_mobile" TEXT NOT NULL,
    "contact_email" TEXT,
    "address" TEXT,
    "city_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: local_ads
CREATE TABLE IF NOT EXISTS "local_ads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "advertiser_id" UUID NOT NULL,
    "title_by_language" JSONB NOT NULL,
    "body_by_language" JSONB NOT NULL,
    "image_file_key" TEXT NOT NULL,
    "format" "LocalAdFormat" NOT NULL DEFAULT 'BANNER',
    "cta_type" "LocalAdCtaType" NOT NULL,
    "cta_value" TEXT NOT NULL,
    "targeting" JSONB,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "daily_impression_cap" INTEGER,
    "pricing_model" TEXT NOT NULL DEFAULT 'FLAT_MONTHLY',
    "agreed_amount_paise" BIGINT NOT NULL DEFAULT 0,
    "status" "LocalAdStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_id" UUID,
    "review_reason_codes" JSONB,
    "review_note" TEXT,
    "created_by_id" UUID NOT NULL,
    "paused_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: local_ad_stats_daily
CREATE TABLE IF NOT EXISTS "local_ad_stats_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ad_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_ad_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_placements_daily
CREATE TABLE IF NOT EXISTS "ad_placements_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "placement" TEXT NOT NULL,
    "source" "AdSource" NOT NULL,
    "loaded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "app_version_bucket" TEXT NOT NULL DEFAULT 'all',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_placements_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_revenue_entries
CREATE TABLE IF NOT EXISTS "ad_revenue_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "month" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "advertiser_id" UUID,
    "amount_paise" BIGINT NOT NULL DEFAULT 0,
    "currency_note" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "entered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_revenue_entries_pkey" PRIMARY KEY ("id")
);

-- Constraints and Indexes: generated_reports
CREATE UNIQUE INDEX IF NOT EXISTS "generated_reports_public_id_key" ON "generated_reports"("public_id");
CREATE INDEX IF NOT EXISTS "generated_reports_type_subject_id_idx" ON "generated_reports"("type", "subject_id");
CREATE INDEX IF NOT EXISTS "generated_reports_status_idx" ON "generated_reports"("status");
CREATE INDEX IF NOT EXISTS "generated_reports_owner_company_id_idx" ON "generated_reports"("owner_company_id");
CREATE INDEX IF NOT EXISTS "generated_reports_owner_driver_id_idx" ON "generated_reports"("owner_driver_id");
CREATE INDEX IF NOT EXISTS "generated_reports_expires_at_idx" ON "generated_reports"("expires_at");

-- Constraints and Indexes: local_advertisers
CREATE INDEX IF NOT EXISTS "local_advertisers_city_id_idx" ON "local_advertisers"("city_id");
CREATE INDEX IF NOT EXISTS "local_advertisers_status_idx" ON "local_advertisers"("status");

-- Constraints and Indexes: local_ads
CREATE INDEX IF NOT EXISTS "local_ads_advertiser_id_idx" ON "local_ads"("advertiser_id");
CREATE INDEX IF NOT EXISTS "local_ads_status_idx" ON "local_ads"("status");
CREATE INDEX IF NOT EXISTS "local_ads_start_date_end_date_idx" ON "local_ads"("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "local_ads_priority_weight_idx" ON "local_ads"("priority", "weight");

-- Constraints and Indexes: local_ad_stats_daily
CREATE UNIQUE INDEX IF NOT EXISTS "local_ad_stats_daily_ad_id_date_key" ON "local_ad_stats_daily"("ad_id", "date");
CREATE INDEX IF NOT EXISTS "local_ad_stats_daily_date_idx" ON "local_ad_stats_daily"("date");

-- Constraints and Indexes: ad_placements_daily
CREATE UNIQUE INDEX IF NOT EXISTS "ad_placements_daily_date_placement_source_app_version_bucket_key" ON "ad_placements_daily"("date", "placement", "source", "app_version_bucket");
CREATE INDEX IF NOT EXISTS "ad_placements_daily_date_placement_idx" ON "ad_placements_daily"("date", "placement");

-- Constraints and Indexes: ad_revenue_entries
CREATE INDEX IF NOT EXISTS "ad_revenue_entries_month_idx" ON "ad_revenue_entries"("month");
CREATE INDEX IF NOT EXISTS "ad_revenue_entries_source_idx" ON "ad_revenue_entries"("source");

-- Foreign Keys: generated_reports
ALTER TABLE "generated_reports" DROP CONSTRAINT IF EXISTS "generated_reports_requested_by_id_fkey";
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_reports" DROP CONSTRAINT IF EXISTS "generated_reports_owner_company_id_fkey";
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_owner_company_id_fkey" FOREIGN KEY ("owner_company_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_reports" DROP CONSTRAINT IF EXISTS "generated_reports_owner_driver_id_fkey";
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_owner_driver_id_fkey" FOREIGN KEY ("owner_driver_id") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys: local_advertisers
ALTER TABLE "local_advertisers" DROP CONSTRAINT IF EXISTS "local_advertisers_city_id_fkey";
ALTER TABLE "local_advertisers" ADD CONSTRAINT "local_advertisers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "local_advertisers" DROP CONSTRAINT IF EXISTS "local_advertisers_created_by_id_fkey";
ALTER TABLE "local_advertisers" ADD CONSTRAINT "local_advertisers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys: local_ads
ALTER TABLE "local_ads" DROP CONSTRAINT IF EXISTS "local_ads_advertiser_id_fkey";
ALTER TABLE "local_ads" ADD CONSTRAINT "local_ads_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "local_advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "local_ads" DROP CONSTRAINT IF EXISTS "local_ads_reviewed_by_id_fkey";
ALTER TABLE "local_ads" ADD CONSTRAINT "local_ads_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "local_ads" DROP CONSTRAINT IF EXISTS "local_ads_created_by_id_fkey";
ALTER TABLE "local_ads" ADD CONSTRAINT "local_ads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys: local_ad_stats_daily
ALTER TABLE "local_ad_stats_daily" DROP CONSTRAINT IF EXISTS "local_ad_stats_daily_ad_id_fkey";
ALTER TABLE "local_ad_stats_daily" ADD CONSTRAINT "local_ad_stats_daily_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "local_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys: ad_revenue_entries
ALTER TABLE "ad_revenue_entries" DROP CONSTRAINT IF EXISTS "ad_revenue_entries_entered_by_id_fkey";
ALTER TABLE "ad_revenue_entries" ADD CONSTRAINT "ad_revenue_entries_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

