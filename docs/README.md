# Voltium Electric Mobility

Voltium is a premium electric vehicle rental and management platform, designed for optimal rider experience and administrative efficiency.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Database**: [Prisma](https://www.prisma.io/) with PostgreSQL (managed via Railway/Supabase)
- **Frontend Logic**: [React 18](https://reactjs.org/), [Zustand](https://zustand-demo.pmnd.rs/) (State Management)
- **Styling**: Vanilla CSS, TailwindCSS, Framer Motion (Animations)
- **Backend Validation**: [Zod](https://zod.dev/)
- **Authentication**: JWT-based session cookies (HttpOnly, Secure)

## Prerequisites

- **Node.js**: 18.17.0 or higher
- **Package Manager**: npm or Bun (optional but recommended for speed)
- **Database**: A PostgreSQL instance with the connection URL in `.env`

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup Database**:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```
3. **Run Development Server**:
   ```bash
   npm run dev
   ```
4. **Build for Production**:
   ```bash
   npm run build
   ```

## Testing

- **Unit/API Tests**: `bun test` or `npm run test`
- **End-to-End Tests**: `npm run test:e2e` (using Playwright)

## Environment Variables

Create a `.env` file in the root directory:
DATABASE_URL="postgresql://user:password@localhost:5432/voltium"
JWT_SECRET="your_secure_random_secret"
NODE_ENV="development"
VOLTFLEET_DEV_BYPASS_RATELIMIT="true"
ALLOWED_ORIGINS="http://localhost:8081,http://localhost:3000"

```

## Security & Reliability
- All admin routes are hardened with `force-dynamic` rendering.
- Session cookies are strictly configured: `HttpOnly`, `SameSite=lax`, and `Secure` (in production).
- API responses are standardized for consistent frontend handling.
```
