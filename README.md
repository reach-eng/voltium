# Voltium - Electric Mobility Platform

A modern electric vehicle rental platform built with Next.js, Prisma, and PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (via Prisma)
- **Auth**: Firebase Auth
- **Testing**: Vitest
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Firebase project

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npm run db:push
npm run db:seed  # optional

# Start development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
JWT_SECRET=...
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 8081) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database with sample data |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── (routes)/          # Page routes
├── components/            # React components
│   ├── admin/            # Admin panel components
│   └── voltium/           # Rider app components
├── lib/                   # Core utilities
│   ├── db.ts             # Database client
│   ├── validators.ts     # Zod validation schemas
│   ├── api-error.ts      # Custom error classes
│   └── cache.ts         # Memory cache
└── store/                # State management
prisma/
└── schema.prisma         # Database schema
tests/
├── unit/                 # Unit tests
└── api/                 # API integration tests
```

## Database Schema

Key models:
- **Rider** - User accounts with KYC, guarantor, wallet
- **Vehicle** - Electric vehicles with status tracking
- **Transaction** - Payment transactions
- **RentalLease** - Vehicle lease agreements
- **SupportTicket** - Customer support tickets

## API Endpoints

### Rider API
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/rider/profile` - Get rider profile
- `PUT /api/rider/profile` - Update profile
- `POST /api/rider/kyc` - Submit KYC
- `POST /api/rider/guarantor` - Submit guarantor
- `GET /api/rider/plans` - List rental plans

### Admin API
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/riders` - List riders
- `POST /api/admin/riders` - Create rider
- `PUT /api/admin/riders/:id` - Update rider
- `GET /api/admin/transactions` - List transactions
- `GET /api/admin/tickets` - List support tickets

## Testing

```bash
# Run unit tests
npm run test:unit

# Run API tests (requires dev server)
npm run dev
npm run test:api

# Run all tests
npm run test
```

## CI/CD

GitHub Actions workflow runs on push/PR:
1. Lint & TypeScript check
2. Prisma schema validation
3. Build
4. Unit tests
5. Deploy preview (PR only)
6. Deploy production (main branch)

## License

Private - All rights reservedtest commit to trigger workflow
