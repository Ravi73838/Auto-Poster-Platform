# Driver Mobile Application Guide & Architecture

**Date:** 2026-11-07  
**Platform:** React Native (Expo SDK 52, New Architecture enabled)  
**Target Device Audience:** Auto-rickshaw partners operating on entry-level Android smartphones with intermittent 2G/3G connectivity.

---

## 1. Development Networking & Connecting a Phone to the Local API

When testing on physical Android devices or development builds, `localhost` refers to the device itself, NOT the development computer hosting the backend Node API. Attempting to use `http://localhost:4000/api/v1` on a physical device will result in network timeouts.

### Connection Strategy

#### Option A: Local Wi-Fi (Same Network)
1. Ensure the development machine and the Android test device are connected to the exact same Wi-Fi router.
2. Find the development computer's local IP address:
   ```powershell
   # Windows PowerShell
   ipconfig
   # Look for IPv4 Address under Wireless LAN adapter Wi-Fi (e.g. 192.168.1.15)
   ```
3. Set `EXPO_PUBLIC_API_URL` in `mobile/.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.15:4000/api/v1
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:4000/api/v1
   EXPO_PUBLIC_ENV=development
   ```
4. Verify the backend API server is listening on `0.0.0.0` or all interfaces (default in development).
5. **Cleartext Traffic Policy:** Cleartext (`http://`) HTTP traffic is explicitly permitted **ONLY** in development builds via `expo-build-properties`:
   ```ts
   [
     'expo-build-properties',
     {
       android: {
         usesCleartextTraffic: process.env.EXPO_PUBLIC_ENV === 'development' || !process.env.EXPO_PUBLIC_ENV,
       },
     },
   ]
   ```
   Preview and production builds strictly enforce `https://`.

#### Option B: Secure Cloud Tunnel (Cloudflare Tunnel or ngrok)
1. Launch an HTTPS tunnel to local port 4000:
   ```bash
   ngrok http 4000
   # OR
   cloudflared tunnel --url http://localhost:4000
   ```
2. Set the public HTTPS URL in `mobile/.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://<your-tunnel-subdomain>.ngrok-free.app/api/v1
   EXPO_PUBLIC_API_BASE_URL=https://<your-tunnel-subdomain>.ngrok-free.app/api/v1
   EXPO_PUBLIC_ENV=development
   ```

---

## 2. Native Capabilities & Device Trust Layer

| Capability | Module | Configuration & Rationale |
|---|---|---|
| Camera | `expo-camera` | Live-only camera capture for installation & daily photos. Gallery picker is forbidden for proof photos to prevent spoofing. |
| Precise GPS | `expo-location` | Foreground-only fine location at the moment of photo capture (`ACCESS_FINE_LOCATION`). No background location tracking. |
| Push Notifications | `expo-notifications` | Push token registration via `POST /api/v1/devices`. Android notification channels: `urgent`, `reminders`, `money`, `normal`. |
| Device Info | `expo-device`, `expo-application` | Hardware model, OS version, app version, build number. `deviceInstallId` securely generated and stored in `expo-secure-store`. |
| Storage & Resumes | `expo-file-system`, `AsyncStorage` | Persistent offline upload queue for low-connectivity environments. |
| Typography | `expo-font` | Offline bundled Noto Sans Devanagari and Gujarati fonts for native Indian language rendering. |
| Screen Protection | `expo-screen-capture` | Prevents unauthorized screenshotting and screen recording on KYC and banking/UPI screens. |

---

## 3. Route Map & Auth Gating Overview

The mobile application utilizes **Expo Router** with strict file-based routing and centralized auth gating:

1. `(public)`:
   - `/language`: First-launch language selector (English, Hindi, Gujarati).
   - `/login`: Mobile number entry and SMS OTP verification.
   - `/maintenance`: Server-directed maintenance mode lock screen.
   - `/update-required`: Hard app version gate (`mobile_min_version`).
2. `(onboarding)`:
   - `/kyc`: Multi-step KYC wizard (Personal details, Vehicle details, Documents, Payout UPI/bank, Consents, Review).
   - `/kyc/status`: Real-time KYC review status (Pending Review, Need More Info, Rejected, Approved).
3. `(tabs)`:
   - `/`: Aggregated driver home dashboard (Today's photo task, active campaign card, earnings snapshot, discipline alerts).
   - `/campaigns`: Campaign discovery (Browse available campaigns and Mine).
   - `/wallet`: Driver balance, statement, withdrawal requests, payout tracking.
   - `/notifications`: In-app notification center with unread badges and deep linking.
   - `/profile`: Driver profile, vehicle specs, sessions, language and theme settings.
4. Core Stacks:
   - `/campaigns/[id]`: Campaign detail specifications and reservation.
   - `/assignments/[id]`: Assignment lifecycle, print guide, poster artwork download, installation upload.
   - `/assignments/[id]/daily-camera`: Real-time live camera capture with GPS accuracy checks.
   - `/assignments/[id]/calendar`: 30-day proof calendar and day-by-day photo verification timeline.
   - `/upload-queue`: Real-time queue manager for background photo uploads.
   - `/discipline`: Strikes, bans, vehicle fix notices, and disciplinary rules.
   - `/disputes`: Driver disputes, evidence attachments, and support messaging.
   - `/help`: Help center articles and FAQ.

---

## 4. Ports & Adapters Composition Architecture

To enable deterministic testing in headless Node environments (unit tests and the app-faithful driver simulator) without native crashes, core business logic, the offline upload queue, capture validation, and token storage do NOT import native platform modules directly.

* **Port Interfaces** (`src/services/adapters/types.ts`): `IStorage`, `ISecureStore`, `INetwork`, `IClock`, `ILocationProvider`, `ICameraProvider`, `IDeviceInfoProvider`, `IFileStore`, `INotifier`.
* **Production Adapters** (`src/services/adapters/production.ts`): Default implementations wrapping Expo and React Native modules (`@react-native-async-storage/async-storage`, `expo-secure-store`, `@react-native-community/netinfo`, `expo-location`, `expo-file-system`, `expo-notifications`).
* **In-Memory Fakes** (`src/services/adapters/fakes.ts`): High-fidelity, controllable in-memory fakes for unit testing and simulator scenarios.
* **Composition Root** (`src/services/container.ts`): Exposes singleton adapter access and allows injecting fake adapters via `setContainerAdapters()` for tests.

