# Auto Poster Platform - Mobile Environment & Tooling Check (AG-5)

**Execution Date:** 2026-11-17  
**Operating System:** Windows 10.0.26300  
**Repository Working Directory:** `d:\Ravi\Radhe\Auto-Poster-Platform\mobile`

---

## 1. Environment & SDK Verification

| Tool / Component | Detection Command | Installed Version / Path | Status |
|:---|:---|:---|:---|
| **Node.js** | `node -v` | `v22.23.5` (>= 20.0.0 requirement met) | **AVAILABLE** |
| **Java JDK** | `java -version` | `21.0.12 LTS` (Java HotSpot 64-Bit Server VM) | **AVAILABLE** |
| **Android SDK / ADB** | `adb version` | `1.0.41` (Version 37.0.0-14910828)<br/>`C:\Users\Ravi\AppData\Local\Android\Sdk\platform-tools\adb.exe` | **AVAILABLE** |
| **Android Virtual Devices (AVD)** | `emulator -list-avds` | 0 AVDs configured | **NOT CONFIGURED** |
| **Maestro CLI** | `maestro --version` | Not installed on host PATH | **NOT INSTALLED** |
| **Expo Framework** | `mobile/package.json` | Expo SDK 52 (`~52.0.37`), React Native `0.76.9` | **AVAILABLE** |
| **Test Runner** | `npm run test` | Vitest `v3.2.7` | **AVAILABLE** |

---

## 2. Test Execution Layer Strategy

Based on detected tooling and repository safety policy (zero unapproved SDK downloads / heavy installations without user instruction):

### Layer 1: Screen & Logic Tests (Vitest + Component Mocks)
* **Status**: **FULLY EXECUTABLE LOCALLY**
* Runs unit, component, formatting, calculation, validation, and state machine tests using Vitest with mocked native modules (`expo-camera`, `expo-location`, `expo-secure-store`, `@react-native-community/netinfo`, `expo-notifications`, `expo-screen-capture`).

### Layer 2: App-Faithful Driver Simulator (`mobile/tools/driver-sim/`)
* **Status**: **FULLY EXECUTABLE LOCALLY**
* Node / TypeScript runner (`sim:driver:all`) executing against the running backend API in the isolated `test` schema. Uses real app client code, capture rules, offline queue persistence, and error mapping with in-memory adapters (synthetic JPEG generators with number plate/poster rectangles, simulated GPS coordinates, and mock clocks).

### Layer 3: Maestro Emulator Flows (`mobile/maestro/*.yaml`)
* **Status**: **AUTHORED & MARKED AS 'NEEDS MANUAL RUN'**
* Complete declarative Maestro flows authored for all key driver journeys. Because no Android Virtual Device (AVD) is currently provisioned and Maestro is not installed on this host, Layer 3 flows are documented with exact replay commands and marked as manual validation targets.

### Layer 4: Read-Only Public Stack Exploratory Pass
* **Status**: **AUTOMATED NODE SCRIPT PASS (UI MARKED MANUAL)**
* Node script logging in as each demo driver role from `TEST_ACCOUNTS.md`, calling app GET endpoints with network mutation interceptor blocking all mutating HTTP verbs, verifying response schemas against demo data.
