# ADR 0003: Zod for Validation

## Status
Accepted

## Context
API endpoints and frontend forms require strict schema validation for security and data integrity. 

## Decision
We chose **Zod** as the schema validation library over Yup, Joi, or class-validator.

## Consequences
- **Pros**: Zod's static type inference perfectly aligns with TypeScript, meaning we only write the schema once and extract the types from it. It's functional, immutable, and integrates well with React Hook Form.
- **Cons**: Bundle size is slightly larger than some lightweight alternatives.
