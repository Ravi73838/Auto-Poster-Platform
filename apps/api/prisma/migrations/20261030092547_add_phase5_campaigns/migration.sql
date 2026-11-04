-- CreateEnum
CREATE TYPE "CampaignReviewReason" AS ENUM ('POSTER_CONTENT_POLICY', 'POSTER_LOW_QUALITY', 'POSTER_MISLEADING', 'PRICE_TOO_LOW', 'DETAILS_UNCLEAR', 'UNSUPPORTED_AREA', 'START_DATE_TOO_SOON', 'OTHER');

-- CreateEnum
CREATE TYPE "PrintMaterial" AS ENUM ('FLEX', 'VINYL_STICKER', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignSort" AS ENUM ('NEWEST', 'HIGHEST_RENT', 'STARTING_SOON');

-- CreateEnum
CREATE TYPE "CampaignReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assigned_to_id" UUID,
ADD COLUMN     "city_id" UUID,
ADD COLUMN     "commission_bps" INTEGER,
ADD COLUMN     "enrolment_closes_at" TIMESTAMP(3),
ADD COLUMN     "gst_bps" INTEGER,
ADD COLUMN     "last_submitted_at" TIMESTAMP(3),
ADD COLUMN     "live_at" TIMESTAMP(3),
ADD COLUMN     "payment_deadline_at" TIMESTAMP(3),
ADD COLUMN     "poster_file_id" UUID,
ADD COLUMN     "pricing_snapshot" JSONB,
ADD COLUMN     "print_material" "PrintMaterial" NOT NULL DEFAULT 'VINYL_STICKER',
ADD COLUMN     "print_size" TEXT,
ADD COLUMN     "review_reasons" JSONB,
ADD COLUMN     "revision_count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "creative_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "uploaded_files" ADD COLUMN     "preview_key" TEXT,
ADD COLUMN     "thumbnail_key" TEXT;

-- CreateTable
CREATE TABLE "campaign_reviews" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "CampaignReviewDecision" NOT NULL,
    "reasons" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_reviews_campaign_id_idx" ON "campaign_reviews"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_reviews_reviewer_id_idx" ON "campaign_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "campaigns_city_id_idx" ON "campaigns"("city_id");

-- CreateIndex
CREATE INDEX "campaigns_assigned_to_id_idx" ON "campaigns"("assigned_to_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_poster_file_id_fkey" FOREIGN KEY ("poster_file_id") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_reviews" ADD CONSTRAINT "campaign_reviews_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_reviews" ADD CONSTRAINT "campaign_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
