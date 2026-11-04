-- =========================================================
-- Phase 2: Raw SQL Constraints, Partial Indexes & Triggers
-- =========================================================

-- 1. CHECK CONSTRAINTS
-- Campaigns
ALTER TABLE "campaigns"
  ADD CONSTRAINT "chk_campaigns_target_auto_count" CHECK ("target_auto_count" > 0),
  ADD CONSTRAINT "chk_campaigns_dates" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "chk_campaigns_amounts" CHECK (
    "daily_rent_paise" >= 0 AND
    "printing_allowance_paise" >= 0 AND
    "total_budget_paise" >= 0 AND
    "platform_fee_paise" >= 0 AND
    "gst_amount_paise" >= 0 AND
    "total_charged_paise" >= 0
  );

-- Campaign payments
ALTER TABLE "campaign_payments"
  ADD CONSTRAINT "chk_campaign_payments_amount" CHECK ("amount_paise" > 0);

-- Payouts
ALTER TABLE "payouts"
  ADD CONSTRAINT "chk_payouts_amount" CHECK ("amount_paise" > 0);

-- Ledger entries
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "chk_ledger_entries_amount" CHECK ("amount_paise" > 0);

-- Assignments
ALTER TABLE "assignments"
  ADD CONSTRAINT "chk_assignments_days" CHECK (
    "total_days" > 0 AND
    "verified_days" >= 0 AND
    "missed_days" >= 0 AND
    "rejected_days" >= 0
  );

-- Photos coordinates
ALTER TABLE "photos"
  ADD CONSTRAINT "chk_photos_coordinates" CHECK (
    "lat" >= -90.0 AND "lat" <= 90.0 AND
    "lng" >= -180.0 AND "lng" <= 180.0
  );

-- Zones geometry
ALTER TABLE "zones"
  ADD CONSTRAINT "chk_zones_geometry" CHECK (
    "center_lat" >= -90.0 AND "center_lat" <= 90.0 AND
    "center_lng" >= -180.0 AND "center_lng" <= 180.0 AND
    "radius_meters" > 0
  );

-- 2. PARTIAL UNIQUE INDEXES
-- Single active assignment per vehicle
CREATE UNIQUE INDEX "uniq_active_vehicle_assignment"
  ON "assignments"("vehicle_id")
  WHERE "status" IN ('RESERVED', 'INSTALLING', 'INSTALL_SUBMITTED', 'INSTALL_APPROVED', 'RUNNING');

-- One verified daily photo per assignment per photo_date
CREATE UNIQUE INDEX "uniq_verified_daily_photo"
  ON "photos"("assignment_id", "photo_date")
  WHERE "kind" = 'DAILY' AND "status" = 'VERIFIED';

-- Unique ledger accounts per owner/campaign
CREATE UNIQUE INDEX "uniq_ledger_user_account"
  ON "ledger_accounts"("account_type", "user_id")
  WHERE "user_id" IS NOT NULL;

CREATE UNIQUE INDEX "uniq_ledger_campaign_account"
  ON "ledger_accounts"("account_type", "campaign_id")
  WHERE "campaign_id" IS NOT NULL;

-- 3. IMMUTABLE TABLES (APPEND-ONLY TRIGGERS)
CREATE OR REPLACE FUNCTION prevent_modification_immutable_table()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable. UPDATE and DELETE operations are strictly prohibited.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_immutable_ledger_transactions"
  BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION prevent_modification_immutable_table();

CREATE TRIGGER "trg_immutable_ledger_entries"
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION prevent_modification_immutable_table();

CREATE TRIGGER "trg_immutable_audit_logs"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_modification_immutable_table();

-- 4. BALANCED LEDGER TRANSACTION CONSTRAINT TRIGGER
CREATE OR REPLACE FUNCTION check_ledger_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debits BIGINT;
  v_credits BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount_paise" ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN "direction" = 'CREDIT' THEN "amount_paise" ELSE 0 END), 0)
  INTO v_debits, v_credits
  FROM "ledger_entries"
  WHERE "transaction_id" = NEW."transaction_id";

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced: debits (%) != credits (%)',
      NEW."transaction_id", v_debits, v_credits;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_ledger_entries_balanced"
  AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_ledger_transaction_balance();
