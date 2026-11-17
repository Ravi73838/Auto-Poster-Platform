# Mobile Public Stack Live Exploration Report

**Execution Mode:** STRICTLY READ-ONLY against Supabase development database (`public` schema)
**Date:** 2026-11-17T11:52:42.656Z

---

## 1. Safety Guard Verification
- **Pre-Exploration Counts:** `{"users":9,"driver_profiles":2,"campaigns":0,"assignments":0,"photos":0,"ledger_transactions":0,"ledger_entries":0}`
- **Post-Exploration Counts:** `{"users":9,"driver_profiles":2,"campaigns":0,"assignments":0,"photos":0,"ledger_transactions":0,"ledger_entries":0}`
- **Mutations (Insert/Update/Delete):** Exactly 0
- **Database Migrations:** None executed

---

## 2. Read-Only Exploration Findings

- Public App Config: minVersion=0.1.0, maintenance=false
- Public Cities Count: 2 (Sample: Ahmedabad)
- Demo Driver Login: SUCCESS (User ID: ab2a8208-b591-43b1-a593-694586ab3423, Status: APPROVED)
- Driver Onboarding: status=APPROVED, canSubmit=false
- Driver Available Campaigns: 0
- Driver Wallet: balancePaise=0
- Driver Unread Notifications Count: 0
- Discipline Rules: strikeLimit=3, validityDays=90

---

## 3. Screen States Verified on Public Data
- **Public App Config:** Valid and operational.
- **Locations & Cities:** Active cities available for driver selection.
- **Driver Authentication:** Read-only session authorization verified.
- **Campaigns Discovery:** Successfully queried available campaigns without mutating reservation state.
- **Driver Wallet & Financial Balance:** Balances and statements fetched in read-only mode.
- **Discipline & Rules:** Guidelines and strike limits fetched without issuing penalties.
