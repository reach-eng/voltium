# ADR 0001: Use Next.js for the Backend API

## Status
Accepted

## Context
Voltium requires a robust backend to serve API routes to both the Flutter mobile app and the administrative dashboard. We needed a framework that supports rapid development, strong TypeScript integration, and easy deployment to serverless or standard node environments.

## Decision
We decided to use **Next.js (App Router)** as the primary backend API framework. While Next.js is primarily known for frontend rendering, its API routes (Route Handlers) provide a lightweight, file-system-based routing mechanism that is excellent for building RESTful APIs.

## Consequences
- **Pros**: Unified stack for admin dashboard and API; excellent TypeScript support; Vercel deployment readiness; built-in middleware.
- **Cons**: Slightly heavier than a raw Express.js setup; some Next.js specific paradigms (like `NextRequest` and `NextResponse`) are required.
