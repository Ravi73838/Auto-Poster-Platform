# Deployment Guide

The Auto Poster Advertising Platform is organized into three independent folders (`api`, `web`, `mobile`). Each folder has its own `package.json`, isolated dependencies, and deployment target.

---

## 1. Architecture & Topologies

```
                        +----------------------------+
                        |       Internet Users       |
                        +----------------------------+
                           /           |          \
                          /            |           \
                    Web Browsers   Mobile App   API Clients
                        /              |             \
                       v               |              v
       +-----------------------+       |    +--------------------+
       | Web Portal (Company & |       |    |   API & Workers    |
       |  Admin SPA: React 18) |       |    |  (Node.js / Express|
       +-----------------------+       |    |      & BullMQ)     |
                   \                   v    +--------------------+
                    \---------> HTTPS API /          |
                                                     v
                                            +--------------------+
                                            | Postgres 16 (DB)   |
                                            | Redis 7 (Queues)   |
                                            | S3 (Storage)       |
                                            +--------------------+
```

The platform supports two primary server hosting topologies:
1. **Single VPS (All-in-One)**: Small to medium scale. API, Worker, PostgreSQL, Redis, and Caddy reverse proxy run via Docker Compose on a single Ubuntu VPS (Hetzner, DigitalOcean, Linode, AWS EC2).
2. **Split Managed Hosting**: Enterprise/Scale. API on Railway/Render/ECS, Web on Vercel/Cloudflare Pages, DB on AWS RDS / Neon / Supabase, Redis on Upstash / ElastiCache, Mobile via Expo EAS.

---

## 2. Option A: Single VPS All-in-One Deployment (Docker Compose + Caddy)

### Prerequisites
- Ubuntu 22.04 / 24.04 LTS VPS (minimum 2 vCPU, 4GB RAM, 40GB SSD).
- Docker Engine 24+ and Docker Compose v2.
- A registered domain (e.g., `autoposter.example.com`) with DNS records:
  - `A @ -> <VPS_IP>`
  - `A api -> <VPS_IP>`

### Steps

1. **Clone repository onto the VPS**:
   ```bash
   git clone https://github.com/your-org/auto-poster-platform.git /srv/autoposter
   cd /srv/autoposter/api/infra
   ```

2. **Configure production environment variables**:
   ```bash
   cp .env.prod.example .env
   nano .env
   # Set strong passwords, DOMAIN, ACME_EMAIL, JWT_SECRET, and ENCRYPTION_KEY_32B
   ```

3. **Build and start services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **Run database migrations**:
   ```bash
   docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
   ```

5. **Deploy web portal assets (Static SPA)**:
   ```bash
   # On local machine or CI runner:
   cd web
   npm ci
   VITE_API_BASE_URL="https://api.autoposter.example.com" npm run build
   # Copy dist/ to VPS /srv/web
   rsync -avz --delete dist/ user@<VPS_IP>:/srv/web/
   ```

6. **Verify health**:
   ```bash
   curl -i https://api.autoposter.example.com/health
   # HTTP/2 200 OK
   ```

---

## 3. Option B: Split Managed Hosting

### 3.1 Backend API & Background Worker (`api`)

Platforms: **Render**, **Railway**, **Fly.io**, or **AWS App Runner / ECS**.

- **Repository Root**: Point service to the repository, with **Root Directory** set to `api`.
- **Build Command**: `npm ci && npx prisma generate && npm run build`
- **Start Command (API Server)**: `node dist/main.js`
- **Start Command (Worker)**: `node dist/worker.js`
- **Environment Variables**:
  - `DATABASE_URL`: Connection string to managed PostgreSQL (e.g. Neon, Supabase, RDS).
  - `REDIS_URL`: Connection string to managed Redis (e.g. Upstash, AWS ElastiCache).
  - `JWT_SECRET`: Random 64-char string.
  - `ENCRYPTION_KEY_32B`: 32-character encryption key for KYC documents.
  - `CORS_ORIGIN`: `https://app.autoposter.example.com`

#### Database Migration on Managed Deployments:
Configure a pre-deploy release command:
```bash
npx prisma migrate deploy
```

---

### 3.2 Web Frontend (`web`)

Platforms: **Vercel**, **Cloudflare Pages**, or **Netlify**.

- **Root Directory**: `web`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://api.autoposter.example.com`
- **SPA Routing Support**:
  - Vercel automatically reads `web/vercel.json`.
  - Cloudflare Pages / Netlify automatically reads `web/public/_redirects`.

---

### 3.3 Mobile App (`mobile`)

Platform: **Expo Application Services (EAS)**.

- **Prerequisites**: `npm install -g eas-cli`
- **Login**: `eas login`
- **Configure project**: `eas project:init`

#### Profiles in `mobile/eas.json`:
- **Development**:
  ```bash
  cd mobile
  eas build --profile development --platform android
  ```
- **Preview (Internal Testing APK)**:
  ```bash
  cd mobile
  eas build --profile preview --platform android
  ```
- **Production (AAB for Google Play Store / IPA for Apple App Store)**:
  ```bash
  cd mobile
  eas build --profile production --platform all
  eas submit --platform android
  ```

---

## 4. Production Operations & Maintenance

### 4.1 Running Database Migrations
Always test migrations against staging first.
```bash
# In api/ folder:
npx prisma migrate deploy
```
If rolling zero-downtime updates:
- Migrations must be backwards-compatible (expand before contract).
- Add new columns as nullable or with defaults.
- Deploy new backend code.
- Remove deprecated columns in a subsequent release.

### 4.2 Automated Backups
On VPS:
```bash
# Daily postgres backup script
docker compose -f api/infra/docker-compose.prod.yml exec -T postgres pg_dump -U autoposter autoposter_prod | gzip > /backups/db-$(date +%F).sql.gz
```
Upload backup archives to offsite cold storage (S3 Glacier / R2).

### 4.3 Zero-Downtime Updates (Docker Compose)
```bash
git pull origin master
docker compose -f api/infra/docker-compose.prod.yml build api worker
docker compose -f api/infra/docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f api/infra/docker-compose.prod.yml up -d --no-deps --scale api=2 --no-recreate api
# Caddy load-balances across healthy containers during replacement
```
