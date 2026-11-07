-- CreateEnum: CompanyMemberRole
DO $$ BEGIN
  CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'MANAGER', 'FINANCE', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MemberStatus
DO $$ BEGIN
  CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: InvitationStatus
DO $$ BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ContactMessageStatus
DO $$ BEGIN
  CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'REPLIED', 'SPAM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: company_members
CREATE TABLE IF NOT EXISTS "company_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'VIEWER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invited_by_id" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: company_invitations
CREATE TABLE IF NOT EXISTS "company_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'VIEWER',
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "accepted_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: billing_profiles
CREATE TABLE IF NOT EXISTS "billing_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "legal_name" TEXT,
    "tax_id" TEXT,
    "tax_id_type" TEXT DEFAULT 'GSTIN',
    "billing_address" JSONB,
    "invoice_emails" JSONB,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contact_messages
CREATE TABLE IF NOT EXISTS "contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "message" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
    "handled_by_id" UUID,
    "handled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes: company_members
CREATE UNIQUE INDEX IF NOT EXISTS "company_members_company_id_user_id_key" ON "company_members"("company_id", "user_id");
CREATE INDEX IF NOT EXISTS "company_members_user_id_idx" ON "company_members"("user_id");
CREATE INDEX IF NOT EXISTS "company_members_company_id_idx" ON "company_members"("company_id");

-- Unique & Indexes: company_invitations
CREATE UNIQUE INDEX IF NOT EXISTS "company_invitations_token_hash_key" ON "company_invitations"("token_hash");
CREATE INDEX IF NOT EXISTS "company_invitations_company_id_idx" ON "company_invitations"("company_id");
CREATE INDEX IF NOT EXISTS "company_invitations_email_idx" ON "company_invitations"("email");
CREATE INDEX IF NOT EXISTS "company_invitations_mobile_idx" ON "company_invitations"("mobile");

-- Unique & Indexes: billing_profiles
CREATE UNIQUE INDEX IF NOT EXISTS "billing_profiles_company_id_key" ON "billing_profiles"("company_id");

-- Indexes: contact_messages
CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages"("status");
CREATE INDEX IF NOT EXISTS "contact_messages_created_at_idx" ON "contact_messages"("created_at");

-- Foreign Keys: company_members
ALTER TABLE "company_members" DROP CONSTRAINT IF EXISTS "company_members_company_id_fkey";
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_members" DROP CONSTRAINT IF EXISTS "company_members_user_id_fkey";
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_members" DROP CONSTRAINT IF EXISTS "company_members_invited_by_id_fkey";
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys: company_invitations
ALTER TABLE "company_invitations" DROP CONSTRAINT IF EXISTS "company_invitations_company_id_fkey";
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_invitations" DROP CONSTRAINT IF EXISTS "company_invitations_invited_by_id_fkey";
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_invitations" DROP CONSTRAINT IF EXISTS "company_invitations_accepted_user_id_fkey";
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys: billing_profiles
ALTER TABLE "billing_profiles" DROP CONSTRAINT IF EXISTS "billing_profiles_company_id_fkey";
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys: contact_messages
ALTER TABLE "contact_messages" DROP CONSTRAINT IF EXISTS "contact_messages_handled_by_id_fkey";
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

