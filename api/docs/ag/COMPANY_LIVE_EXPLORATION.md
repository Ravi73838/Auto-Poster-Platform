# Auto Poster Platform - Company Portal Live Exploratory Pass Report

## 1. Overview & Execution Context

An automated, read-only exploratory walkthrough of the Auto Poster Platform Company Portal was executed using Playwright against live demo data.

* **Target Application**: Company Web Portal (`http://localhost:5173`)
* **Test Fixture Spec**: `web/e2e/company/live-exploratory.spec.ts`
* **Test Environments**: Desktop Chrome (1280x800) and Mobile Chrome (390x844)
* **Execution Status**: **16/16 PASSED** (0 failures, 0 console errors, 0 overflow warnings)
* **Screenshots Directory**: `web/e2e/__screenshots__/company-live/`

---

## 2. Safety Policy & Read-Only Guardrails

To strictly protect development and demo data in accordance with repository safety rules:
1. **Network Mutation Interceptor**: Playwright `page.route` intercepted all network traffic.
   * `GET`, `HEAD`, and `OPTIONS` requests were allowed.
   * Authentication endpoints (`/api/v1/auth/*`) and pure query previews (`/price-preview`) were allowed.
   * Any modifying HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) targeting entity endpoints were automatically aborted (`route.abort('blockedbyclient')`).
2. **Zero Database Writes**: No modifications were executed against database tables during the exploratory pass.

---

## 3. Explored Screens & Verification Results

| Screen / Feature | Route | Desktop Viewport | Mobile Viewport | A11y / Console Guard | Screenshot File |
|:---|:---|:---|:---|:---|:---|
| **Dashboard & KPIs** | `/company/dashboard` | Pass | Pass | Clean (0 violations) | `desktop-live-01-dashboard.png`<br/>`mobile-live-01-dashboard.png` |
| **Business Profile & KYC** | `/company/business-profile` | Pass | Pass | Clean (0 violations) | `desktop-live-02-business-profile.png`<br/>`mobile-live-02-business-profile.png` |
| **Campaigns Marketplace** | `/company/campaigns` | Pass | Pass | Clean (0 violations) | `desktop-live-03-campaigns-list.png`<br/>`mobile-live-03-campaigns-list.png` |
| **Campaign Creation Wizard** | `/company/campaigns/new` | Pass | Pass | Clean (0 violations) | `desktop-live-05-campaign-wizard.png`<br/>`mobile-live-05-campaign-wizard.png` |
| **Fleet Tracking & Heatmap** | `/company/tracking` | Pass | Pass | Clean (0 violations) | `desktop-live-06-tracking.png`<br/>`mobile-live-06-tracking.png` |
| **Payments & Escrow** | `/company/payments` | Pass | Pass | Clean (0 violations) | `desktop-live-07-payments.png`<br/>`mobile-live-07-payments.png` |
| **Disputes & Claims** | `/company/disputes` | Pass | Pass | Clean (0 violations) | `desktop-live-08-disputes.png`<br/>`mobile-live-08-disputes.png` |
| **Support & Help Center** | `/company/support` | Pass | Pass | Clean (0 violations) | `desktop-live-09-support.png`<br/>`mobile-live-09-support.png` |

---

## 4. Key UX & Quality Observations

1. **Responsive Adaptability**:
   * Desktop layout renders a persistent collapsible sidebar (`w-64`) with user identity, status indicator, and navigation items.
   * Mobile layout cleanly hides the sidebar and renders a fixed bottom navigation bar (`md:hidden fixed bottom-0`), ensuring 0 horizontal scrollbar overflow.
   * Mobile header features an accessible, dedicated logout trigger (`LogOut` button).
2. **Privacy & Data Protection**:
   * No auto-rickshaw registration numbers or driver phone numbers are exposed on overview cards or progress grids.
   * Assigned drivers are referenced by privacy-preserving identifiers.
3. **Trilingual & Theming**:
   * Switching between English, Hindi, and Gujarati renders translated strings with zero raw missing keys (no `common.key` or `undefined`).
   * Light and Dark modes switch smoothly with high-contrast text and surface tokens.
