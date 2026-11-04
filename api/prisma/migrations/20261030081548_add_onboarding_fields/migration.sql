-- AlterTable
ALTER TABLE "company_profiles" ADD COLUMN     "city_id" UUID;

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "city_id" UUID,
ADD COLUMN     "full_name" TEXT;

-- AlterTable
ALTER TABLE "driver_zones" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vehicles" ALTER COLUMN "owner_name" DROP NOT NULL,
ALTER COLUMN "owner_mobile" DROP NOT NULL,
ALTER COLUMN "rc_number" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "company_profiles_city_id_idx" ON "company_profiles"("city_id");

-- CreateIndex
CREATE INDEX "driver_profiles_city_id_idx" ON "driver_profiles"("city_id");

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
