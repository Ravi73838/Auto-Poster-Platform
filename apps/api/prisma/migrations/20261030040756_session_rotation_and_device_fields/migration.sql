-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "app_version" TEXT,
ADD COLUMN     "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "platform" "DevicePlatform" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "previous_token_hash" TEXT;

-- CreateIndex
CREATE INDEX "sessions_previous_token_hash_idx" ON "sessions"("previous_token_hash");
