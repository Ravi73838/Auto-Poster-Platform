# Auto Poster Platform - Local Development Runbook (Windows & Cross-Platform)

This runbook provides the verified, step-by-step procedures to run the complete Auto Poster Advertising Platform stack locally on Windows.

---

## 1. Architecture & Port Overview

| Service | Port | Description | Startup Command |
|:---|:---|:---|:---|
| **Redis 8 Server** | `6380` | High-performance in-memory cache, BullMQ task queues, and rate-limiting store | Auto-started by API or `C:\Users\Ravi\.redis\start-redis.bat` |
| **Express API** | `4000` | Core backend REST API (Prisma ORM, business logic, auth) | `cd api && npm run dev` |
| **BullMQ Worker** | - | Background worker processing daily photo audits, payouts, scheduled jobs | `cd api && npm run worker` |
| **Web Portal** | `5173` | React + Vite app (Admin Portal, Company Portal, Public pages) | `cd web && npm run dev` |
| **Driver Mobile** | `8081` | Expo React Native app for Auto-rickshaw drivers | `cd mobile && npm start` |
| **Supabase Postgres** | Remote | Primary PostgreSQL database (schema `public` for dev, `test` for tests) | Managed remotely (no local service) |

---

## 2. Prerequisites & Environment Check

Before launching, verify your environment:
```powershell
# 1. Verify shared contracts are in sync
cd api
npm run sync:shared:check

# 2. Check architecture boundaries, env variables, and secret hygiene
npm run check:boundaries
npm run check:env
npm run check:secrets

# 3. Verify database schema drift (read-only against Supabase public)
npm run db:verify
```

---

## 3. Step-by-Step Stack Startup

Open 4 separate terminal windows (PowerShell or Command Prompt):

### Terminal 1: Redis 8 (If not auto-started)
```powershell
Set-Location "C:\Users\Ravi\.redis"
.\redis-server.exe --port 6380 --save "" --appendonly no
```
*Verification:*
```powershell
curl http://localhost:4000/api/v1/health
```

### Terminal 2: API Backend Server
```powershell
cd api
npm run dev
```
*Expected log output:*
```
[INFO]: Registered discipline event listeners
[INFO]: Auto Poster Platform API running on port 4000 in [development] mode
```

### Terminal 3: Background Worker
```powershell
cd api
npm run worker
```
*Expected log output:*
```
[INFO]: Registered repeatable BullMQ scheduled jobs
[INFO]: BullMQ worker active and listening for scheduled jobs & notification deliveries
```

### Terminal 4: Web Application
```powershell
cd web
npm run dev
```
*Access in browser:* `http://localhost:5173`
- Admin Portal: `http://localhost:5173/admin/login`
- Company Portal: `http://localhost:5173/company/login`

### Terminal 5 (Optional): Mobile App Dev Server
```powershell
cd mobile
npm start
```
- Press `a` to open in Android Emulator, or scan QR code with Expo Go.

---

## 4. Health & Readiness Verification

Run the following curl commands in any terminal:
```powershell
# General Health & Service Connectivity
curl -s http://localhost:4000/api/v1/health

# Readiness Probe (Checks Database & Redis status)
curl -s http://localhost:4000/api/v1/health/ready
```

Expected response for `/health/ready`:
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "checks": {
      "database": "ok",
      "redis": "ok"
    }
  }
}
```

---

## 5. Mobile Device & Emulator Connectivity

When testing on an Android Emulator or physical phone:
- **Android Emulator**: Uses `http://10.0.2.2:4000/api/v1` to communicate with the host PC. Configure `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1` in `mobile/.env`.
- **Physical Device**: Both PC and mobile device must be connected to the same Wi-Fi network. Find your local IP (e.g. `192.168.1.X` via `ipconfig`) and set `EXPO_PUBLIC_API_URL=http://192.168.1.X:4000/api/v1`.

---

## 6. How to Stop Processes

- In any running terminal, press `Ctrl + C` (or `Ctrl + Break`).
- To terminate background processes from PowerShell:
```powershell
# Stop Node dev processes
Get-Process -Name "node", "tsx" -ErrorAction SilentlyContinue | Stop-Process -Force

# Stop Redis 8 server on port 6380
Get-NetTCPConnection -LocalPort 6380 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## 7. Common Errors & Verified Solutions

1. **`connect ECONNREFUSED 127.0.0.1:6380`**:
   - Cause: Redis 8 is not running on port 6380.
   - Fix: Start Redis via `Set-Location "C:\Users\Ravi\.redis"; .\redis-server.exe --port 6380`.
2. **`Redis version needs to be greater or equal than 5.0.0 Current: 3.0.504`**:
   - Cause: Connecting to default port 6379 where legacy Windows Redis service resides instead of Redis 8 on port 6380.
   - Fix: Ensure `REDIS_URL=redis://127.0.0.1:6380`.
3. **`relation "<table_name>" does not exist` in test runs**:
   - Cause: The isolated `test` schema in Supabase has not been prepared.
   - Fix: Run `npm run db:test:prepare` in `api/`.
4. **`Can't reach database server at db.xxx.supabase.co` on Windows**:
   - Cause: IPv6 routing unavailability on direct Supabase hostname.
   - Fix: Handled automatically by `toReachableSupabaseUrl` pooler bridge in `api/src/shared/prisma.ts`.

