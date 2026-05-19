# Voltium — Electric Vehicle Rental Platform

> Complete EV rental management system with rider mobile app, admin dashboard, and fleet operations.

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![Flutter](https://img.shields.io/badge/Flutter-3.41.4-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Prisma](https://img.shields.io/badge/Prisma-6.11-blue)
![Tests](https://img.shields.io/badge/E2E_Tests-39-green)

---

##  Overview

Voltium is a full-stack electric vehicle rental platform designed for fleet operators and riders. It consists of:

- **Rider Mobile App** (Flutter) — 46 screens covering the complete rider journey from onboarding to rental management
- **Admin Dashboard** (Next.js) — 20+ screens for fleet management, KYC verification, analytics, and operations
- **REST API** (Next.js API Routes) — 50+ endpoints with rate limiting, authentication, and audit logging
- **Database** (PostgreSQL/SQLite via Prisma) — 15+ models with optimized indexes

---

## 📱 Rider App (Flutter)

### Features

| Category | Screens | Key Features |
|----------|---------|-------------|
| **Auth & Onboarding** | 11 screens | Phone OTP login, legal acceptance, permissions, intent selection, user form, guarantor onboarding |
| **Core App** | 4 screens | Dashboard with bento grid, wallet, support center, profile |
| **Wallet & Payments** | 6 screens | Top-up flow (amount → purpose → UPI → receipt), transaction history, rewards |
| **Profile & Settings** | 5 screens | Edit profile, documents, app settings, emergency contacts, referral |
| **Support & Help** | 4 screens | FAQ, feedback, support checklist, troubleshooter |
| **Rental & Vehicle** | 10 screens | Plan selection, pickup flow (hub → vehicle → inspection → verification → success), vehicle photos, rental details, end rental |
| **Notifications** | 4 screens | Smart notifications (categorized), preferences, notification center, TL details |
| **Earnings** | 1 screen | Trip & earnings log with weekly summary and insights |
| **Emergency** | 1 screen | SOS button with pulsing animation, emergency contacts |

### Tech Stack

- **Framework**: Flutter 3.41.4 (Dart 3.11.1)
- **State Management**: Provider
- **Localization**: ARB files (English + Hindi)
- **Storage**: SharedPreferences, Flutter Secure Storage, SQFlite
- **Networking**: HTTP client with interceptors
- **Charts**: fl_chart (custom earnings chart)
- **Animations**: Lottie, Confetti
- **Testing**: Integration tests (39 E2E tests)

### Quick Start

```bash
cd flutter

# Install dependencies
flutter pub get

# Generate app icons and splash screen
dart run flutter_launcher_icons
dart run flutter_native_splash:create

# Run on emulator
flutter run -d emulator-5554 \
  --dart-define=API_URL=http://localhost:8081 \
  --dart-define=TEST_MODE=true
```

### E2E Test Suite

```bash
# Run all 39 tests in 17 phases
cd flutter
bash integration_test/e2e_individual/run_phased_tests.sh emulator-5554

# Run parallel (4 shards)
bash integration_test/e2e_individual/run_parallel_tests.sh 4 emulator-5554

# Run single test
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/e2e_individual/04_login_screen_test.dart \
  -d emulator-5554 \
  --dart-define=API_URL=http://localhost:8081 \
  --dart-define=TEST_MODE=true
```

---

## 🖥️ Admin Dashboard (Next.js)

### Features

| Category | Screens | Key Features |
|----------|---------|-------------|
| **Overview** | 1 screen | Dashboard with KPIs, recent transactions, tickets, audit log |
| **Rider Management** | 1 screen | Full CRUD, filters, sorting, pagination, bulk actions, view-as-rider |
| **KYC Management** | 1 screen | Document viewer, approve/reject/info_required, bulk KYC, audit trail |
| **Fleet Map** | 1 screen | Real-time rider locations, battery levels, filters, quick actions |
| **Analytics** | 1 screen | MRR, churn rate, cohort analysis, revenue trends, CSV export |
| **Bulk Messaging** | 1 screen | Create announcements, target segments, schedule, delivery tracking |
| **Rider Scoring** | 1 screen | Composite scores, risk levels, leaderboard, recalculation |
| **Incident Management** | 1 screen | Report incidents, assign, track resolution, generate reports |
| **Vehicle Management** | 1 screen | Vehicle list, status, assignment, battery tracking |
| **Hub Management** | 1 screen | Hub CRUD, capacity management |
| **Rental Management** | 1 screen | Active rentals, lease agreements, return processing |
| **Transaction Management** | 1 screen | Payment history, filters, export |
| **Ticket Management** | 1 screen | Support tickets, assignment, resolution |
| **Offers & Coupons** | 1 screen | Promo code management |
| **Rewards** | 1 screen | Points management, award points |
| **Referrals** | 1 screen | Referral tracking, analytics |
| **Notifications** | 1 screen | Push notification management |
| **Team Leaders** | 1 screen | TL assignment, management |
| **FAQs** | 1 screen | FAQ CRUD |
| **Legal** | 1 screen | Terms & privacy management |
| **Settings** | 1 screen | System configuration, feature flags |
| **Admin Users** | 1 screen | Admin account management, RBAC |

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS 4, Radix UI, shadcn/ui, Framer Motion
- **Database**: Prisma ORM with PostgreSQL/SQLite
- **Auth**: Firebase Auth + JWT sessions
- **Charts**: Recharts
- **State**: Zustand
- **Validation**: Zod
- **Testing**: Vitest (unit), Playwright (E2E)

### Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npm run db:push
npm run db:generate

# Start development server
npm run dev
# → http://localhost:8081
```

### Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"          # SQLite (dev)
# DATABASE_URL="postgresql://..."      # PostgreSQL (prod)

# Firebase Auth
FIREBASE_PROJECT_ID="your-project"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"

# Admin Auth
NEXT_PUBLIC_ADMIN_EMAIL="admin@voltium.app"
ADMIN_PASSWORD="your-admin-password"

# JWT
JWT_SECRET="your-jwt-secret-min-32-chars"

# Redis (optional — for rate limiting & OTP in production)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# Storage (optional)
GCS_BUCKET_NAME="voltium-uploads"
GCS_PROJECT_ID="your-gcp-project"

# Feature Flags
NEXT_PUBLIC_ENABLE_REFERRAL="true"
NEXT_PUBLIC_ENABLE_REWARDS="true"
NEXT_PUBLIC_ENABLE_KYC="true"
NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS="true"
```

### Key Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 8081 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript validation |
| `npm run test:unit` | Unit tests |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed database |

---

## 🗄️ Database Schema

### Core Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| **Rider** | User accounts | phone, fullName, riderId, accountStatus, rentalStatus, batteryLevel, lastKnownLat/Lng |
| **KycProfile** | KYC documents & status | status, aadhaarFront/Back, panCard, bankDetails, rejectionReason |
| **Guarantor** | Guarantor information | name, phone, relation, aadhaar, pan, status |
| **Wallet** | Rider wallet | balanceInPaise, securityDeposit, depositStatus, paymentStreak |
| **Vehicle** | EV fleet | vehicleId, batteryLevel, status, hubId, assignedRiderId |
| **RentalLease** | Rental agreements | planId, startDate, endDate, status, totalAmount |
| **Transaction** | Payment records | type, amount, purpose, status, riderId |
| **SupportTicket** | Support requests | category, priority, status, description, attachments |
| **Notification** | Push notifications | type, title, message, isRead, riderId |
| **Reward** | Loyalty points | title, points, riderId |
| **AuditLog** | Admin action log | action, entity, actorId, details, expiresAt |
| **Announcement** | Bulk messages | title, message, channel, targetAudience, status, delivery tracking |
| **Incident** | Fleet incidents | type, severity, status, riderId, vehicleId, photos, resolution |
| **RiderEarning** | Rider income log | date, platform, amount, trips, hoursOnline |
| **RiderScore** | Performance scoring | paymentScore, kycScore, activityScore, supportScore, compositeScore, riskLevel |

### Indexes

- Rider: `phone`, `riderId`, `referralCode`, `state`, `accountStatus`, `[state, accountStatus]`
- KycProfile: `status`, `riderId`, `[status, riderId]`
- Wallet: `riderId`, `depositStatus`
- Notification: `riderId`, `isRead`, `type`
- AuditLog: `actorId`, `entity`, `action`, `createdAt`, `expiresAt`
- Incident: `riderId`, `vehicleId`, `status`, `type`, `severity`, `createdAt`

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **Rate Limiting** | IP + phone-based limits with Redis/in-memory fallback |
| **Circuit Breaker** | SMS, Firebase Auth, Storage service protection |
| **CSP Headers** | Dev/Prod separated, HSTS in production |
| **XSS Protection** | DOMPurify sanitization on all text inputs |
| **CSRF Protection** | Origin validation middleware |
| **Audit Logging** | All admin actions logged with TTL-based retention |
| **RBAC** | Role-based access control (Super Admin, Admin, Manager, Fleet Manager, TL) |
| **Session Management** | HTTP-only cookies, JWT tokens |
| **Input Validation** | Zod schemas on all API endpoints |
| **Mass Assignment Protection** | Allowlist-based field filtering |

---

## 🧪 Testing

### Backend

```bash
# Unit tests
npm run test:unit

# API tests (requires dev server)
npm run dev &
npm run test:api

# All tests
npm run test
```

### Flutter E2E (39 tests)

| Phase | Tests | Description |
|-------|-------|-------------|
| 1 | 00-01 | Diagnostic, Splash |
| 2 | 02-03 | Legal, Permissions |
| 3 | 04-05 | Login, OTP |
| 4 | 06-07 | Full Auth, Dashboard Elements |
| 5 | 08-09 | Navigation, Notifications |
| 6 | 10-11 | Referral, Wallet Balance |
| 7 | 12-13 | Wallet Top-up, Filters |
| 8 | 14-15 | Profile Display, Edit |
| 9 | 16-17 | KYC Status, OTP Resend |
| 10 | 18-19 | OTP Back, Logout |
| 11 | 20-21 | Support, FAQ |
| 12 | 22-23 | Chat, Ticket |
| 13 | 24-25 | Settings, Theme |
| 14 | 26-28 | Biometric, Edge Cases, Offline |
| 15 | 29-33 | Full Journeys |
| 16 | 34-36 | Guarantor, KYC Notifications, Offline Edge |
| 17 | 37-39 | Wallet Top-up Balance, KYC Notification Flow, Vehicle Return |

---

## 📁 Project Structure

```
voltfleet/
├── flutter/                    # Rider mobile app
│   ├── lib/
│   │   ├── screens/           # 46 screens
│   │   ├── widgets/           # Reusable components
│   │   ├── providers/         # State management
│   │   ├── services/          # API, cache, connectivity
│   │   ├── utils/             # Validators, accessibility
│   │   └── navigation/        # App routing
│   ├── integration_test/      # 39 E2E tests
│   └── assets/                # Images, icons, l10n
├── src/
│   ├── app/
│   │   ├── api/               # 50+ API endpoints
│   │   │   ├── admin/         # Admin routes
│   │   │   ├── auth/          # Auth routes
│   │   │   └── rider/         # Rider routes
│   │   └── (routes)/          # Web pages
│   ├── components/
│   │   ├── admin/             # 20+ admin screens
│   │   └── ui/                # shadcn/ui components
│   ├── lib/                   # Core utilities
│   │   ├── circuit-breaker.ts
│   │   ├── rate-limit.ts
│   │   ├── sanitize.ts
│   │   ├── apm.ts
│   │   └── ...
│   └── store/                 # Zustand stores
├── prisma/
│   └── schema.prisma          # 15+ models
├── tests/
│   ├── unit/                  # Backend unit tests
│   └── api/                   # API integration tests
└── .github/workflows/         # CI/CD
```

---

## 🚦 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP & login |
| POST | `/api/admin/auth/login` | Admin login |
| POST | `/api/admin/auth/auto-login` | Dev auto-login |
| GET | `/api/admin/auth/me` | Get admin session |

### Rider
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rider/profile` | Get rider profile |
| PUT | `/api/rider/profile` | Update profile |
| POST | `/api/rider/kyc` | Submit KYC |
| POST | `/api/rider/guarantor` | Submit guarantor |
| GET | `/api/rider/plans` | List rental plans |
| GET | `/api/rider/earnings` | Get earnings |
| POST | `/api/rider/earnings` | Add earning entry |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/riders` | List riders (paginated) |
| POST | `/api/admin/riders` | Create rider |
| PUT | `/api/admin/riders` | Update rider |
| DELETE | `/api/admin/riders` | Delete rider (cascade) |
| POST | `/api/admin/riders/bulk` | Bulk actions |
| GET | `/api/admin/fleet` | Fleet map data |
| GET | `/api/admin/analytics` | Analytics dashboard |
| GET/POST | `/api/admin/announcements` | Bulk messaging |
| GET/POST | `/api/admin/incidents` | Incident management |
| GET/POST | `/api/admin/scores` | Rider scoring |
| POST | `/api/admin/scores/recalculate` | Recalculate all scores |
| GET/POST | `/api/admin/audit/cleanup` | Audit log retention |
| GET/PUT | `/api/admin/feature-flags` | Feature flag management |
| GET | `/api/admin/cache/invalidate` | Cache invalidation |
| GET | `/api/health` | Health check |
| GET | `/api/metrics` | Performance metrics |

---

## 🎨 Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0053C1` | Buttons, links, accents |
| Surface | `#FFFFFF` | Card backgrounds |
| On Surface | `#1E293B` | Primary text |
| On Surface Variant | `#64748B` | Secondary text |
| Success | `#10B981` | Approved, active states |
| Warning | `#F59E0B` | Pending, caution |
| Error | `#DC2626` | Rejected, errors |
| Info | `#3B82F6` | Informational |

### Typography
| Scale | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 32px | 700 | Hero headings |
| H1 | 24px | 700 | Screen titles |
| H2 | 20px | 600 | Section headers |
| Body | 16px | 400 | Primary text |
| Caption | 14px | 400 | Secondary text |
| Micro | 12px | 500 | Labels, badges |

---

## 🔧 Development

### Prerequisites

- **Node.js** 20+
- **Flutter** 3.41.4+
- **Android SDK** (for emulator)
- **PostgreSQL** (or SQLite for dev)
- **Firebase** project (for auth)

### Local Development

```bash
# 1. Start backend
npm install
cp .env.example .env
npm run db:push
npm run dev

# 2. Set up port forwarding (for emulator)
adb reverse tcp:8081 tcp:8081

# 3. Start Flutter app
cd flutter
flutter pub get
flutter run -d emulator-5554 \
  --dart-define=API_URL=http://localhost:8081 \
  --dart-define=TEST_MODE=true
```

### Testing OTP

The OTP is hardcoded to `111111` for development. Any 10-digit phone number works.

### Admin Access

Default admin credentials (set in `.env`):
- Email: `admin@voltium.app`
- Password: (set in `ADMIN_PASSWORD`)

---

##  Performance

### Backend Optimizations
- **N+1 Query Prevention**: Parallelized `flattenRider` + `signRiderUrls` with `Promise.all`
- **Connection Pooling**: Configurable pool size, timeout, idle timeout
- **Caching**: In-memory cache with TTL, version stamps, pattern invalidation
- **Database Indexes**: 15+ indexes on frequently queried fields

### Flutter Optimizations
- **Image Caching**: `cacheWidth`/`cacheHeight` on all network images
- **Smart Settle**: E2E test helper detects loading indicators instead of fixed delays
- **Lazy Loading**: Heavy screens loaded on demand

### Monitoring
- **APM**: Response time tracking, error rates, slow query detection (>100ms)
- **Health Check**: `/api/health` with DB, Redis, disk, uptime checks
- **Audit Logs**: All admin actions logged with TTL-based retention

---

## 🚀 Deployment

### Backend (Vercel / Node)

```bash
# Build
npm run build

# Start
npm run start
```

### Flutter (Android APK)

```bash
cd flutter
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### Environment Setup

| Environment | Database | Rate Limit | OTP |
|-------------|----------|------------|-----|
| Development | SQLite | In-memory | `111111` |
| Staging | PostgreSQL | Redis | Real SMS |
| Production | PostgreSQL | Redis | Real SMS |

---

## 📝 License

Private — All rights reserved.

---

## 👥 Team

Built with ❤️ for Voltium Electric Mobility.
