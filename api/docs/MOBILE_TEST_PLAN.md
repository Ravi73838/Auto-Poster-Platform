# Mobile Driver App - Physical Device Test Plan & Manual QA Checklist

This document provides the mandatory manual verification checklist for the Auto Poster Driver Mobile App (`mobile/`).
Automated unit tests and headless simulators cannot simulate real mobile hardware behaviors (lens optics, optical camera sensor, OS power management, thermal throttling, real GPS GNSS chips, native mock location provider detection, hardware push notifications, and native screen readers).
Before releasing any production build, QA must execute and record this checklist on physical Android devices.

---

## Device Test Matrix (Minimum Recommendation)

| Tier | Sample Device | Android Version | RAM | Target Test Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Budget / Low-End** | Xiaomi Redmi 9A / Realme C-series | Android 10 - 11 | 2GB - 3GB | Low memory crash resistance, camera memory footprint, cold start performance |
| **Mid-Range (Baseline)** | Samsung Galaxy M34 / Vivo Y-series | Android 12 - 13 | 4GB - 6GB | Normal driver target demographic, outdoor glare readability, standard GPS locking |
| **Modern Flagship** | Google Pixel 7 / Samsung Galaxy S23 | Android 14+ | 8GB+ | Dynamic per-app permissions, photo picker restrictions, high-refresh rate fluidity |

---

## Physical Hardware Verification Checklist

### 1. Optical Camera Hardware & Capture Pipeline
- [ ] **Hardware Camera Launch & Preview Fluidity:** Camera preview initializes in `< 1.5s` without viewfinder lag, stutter, or aspect-ratio distortion on 2GB RAM device.
- [ ] **Framing Guides & Overlays:** The auto-rickshaw rear silhouette guide correctly overlays on top of the live feed without obscuring lighting conditions.
- [ ] **Focus & Exposure Dynamics:** Tap-to-focus functions reliably across direct noon sunlight, evening twilight, and shaded alleyways.
- [ ] **Low-Memory Crash Resistance:** App does not restart or crash when the system camera HAL allocates peak buffer memory during 1080p/4K photo capture on a 2GB RAM device.
- [ ] **Image Compression & Watermarking:** Captured photo is compressed client-side to target bounds (JPEG, max 2MB) with accurate EXIF metadata stripping while preserving timestamp.
- [ ] **Gallery Restriction:** Verify that the daily proof camera strictly forces hardware lens capture and provides **no option** to select or upload pre-existing photos from device gallery.

### 2. Physical GNSS / GPS & Mock Location Security
- [ ] **Cold Start GNSS Locking:** Device achieves valid satellite fix (`accuracy <= 50m`) within standard OS timeout (`< 15s`) outdoors.
- [ ] **Indoor / Degraded Signal Handling:** In basement parking or indoor stalls where GPS is poor, app clearly displays "Weak GPS signal: move outdoors" rather than indefinitely stalling.
- [ ] **OS Developer Mock Locations (e.g. Fake GPS):** Enable "Select mock location app" in Android Developer Options. Launch app and attempt to submit daily proof. Verify app detects `isMockLocation: true` and blocks submission with error code `MOCK_LOCATION_DETECTED`.
- [ ] **Location Permission Downgrade:** Revoke location permission in Android Settings while app is open. Verify app transitions gracefully to permission request banner without crashing.
- [ ] **Geofence Proximity:** Capture proof at campaign boundary boundary (within 100m vs outside boundary). Verify API confirms geofence validation.

### 3. Push Delivery & Background Wakeup (FCM / APNs)
- [ ] **Token Registration:** On fresh login, device registers FCM device push token with backend (`POST /api/v1/notifications/push-token`).
- [ ] **Foreground Notification:** While app is in foreground, trigger a reminder or strike notice. In-app banner / toast displays non-intrusively.
- [ ] **Background & Terminated State Delivery:** Lock device screen or swipe app away from recent apps. Send a push notification. Verify heads-up notification arrives within 5 seconds.
- [ ] **Deep Link Routing on Tap:** Tap the incoming push notification (e.g., `autoposter://assignments/:id/daily-camera` or `autoposter://disputes/:id`). Verify the app launches directly into the target screen without landing on default home screen.
- [ ] **Token Cleanup on Logout:** Log out from the app. Verify push token is invalidated on server so subsequent alerts for that account are not sent to the device.

### 4. Accessibility, TalkBack & Display Adaptations
- [ ] **TalkBack Navigation:** Enable Google TalkBack. Verify every button, tab, and card has an informative `accessibilityLabel` in the active language (English, Hindi, or Gujarati).
- [ ] **Font Scaling / Display Size:** Set Android system font size to "Largest" (130%). Verify no text clips, overflows into parent containers, or cuts off currency amounts (`₹Paise`).
- [ ] **Outdoor Contrast & Legibility:** Test both Light and Dark themes under direct sunlight. Primary CTA buttons, countdown timers, and warning chips remain legible.
- [ ] **Trilingual Voice Readout:** Switch app language to Hindi and Gujarati. Verify TalkBack / screen reader synthesizes translated labels smoothly without phonetic stutter.

### 5. Network Transitions & Offline Resiliency
- [ ] **Mid-Upload Disconnect:** Start daily photo upload on 4G, enable Airplane Mode halfway through upload. Verify job safely pauses, transitions to offline queue, and shows offline pill.
- [ ] **Reconnection Auto-Flush:** Disable Airplane Mode. Verify the queue manager resumes from the upload checkpoint without duplicating the file or triggering duplicate submission errors.
- [ ] **Battery Saver Throttling:** Turn on Android "Ultra Battery Saver". Verify background sync respects network throttling and does not cause unbounded wake-lock drains.

---

## QA Execution Sign-Off Template

```text
Tester Name: ___________________________
Device Model: __________________________   Android OS: _____________
Build Number: __________________________   Date: ____________________

Checklist Results:
- Camera Pipeline:          [ ] PASS   [ ] FAIL   Notes: ____________________
- GPS & Anti-Mock:          [ ] PASS   [ ] FAIL   Notes: ____________________
- Push Notifications:       [ ] PASS   [ ] FAIL   Notes: ____________________
- TalkBack & Accessibility: [ ] PASS   [ ] FAIL   Notes: ____________________
- Offline & Network:        [ ] PASS   [ ] FAIL   Notes: ____________________

Overall Release Recommendation: [ ] APPROVED FOR PLAY STORE / INTERNAL TRACK   [ ] BLOCKED
Sign-off Signature: ______________________
```
