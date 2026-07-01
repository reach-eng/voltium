# ADR 0002: Prisma over Drizzle

## Status
Accepted

## Context
We need an Object-Relational Mapper (ORM) to interface with PostgreSQL. The two primary contenders for modern TypeScript ecosystems are Prisma and Drizzle.

## Decision
We chose **Prisma**.

## Consequences
- **Pros**: The schema file (`schema.prisma`) provides a very clear, declarative single source of truth for the database layout. The auto-generated types are exhaustive and heavily reduce boilerplate. Excellent migration tooling (`prisma migrate`).
- **Cons**: Slightly heavier runtime than Drizzle; some complex SQL queries can be harder to express natively in the Prisma client.
