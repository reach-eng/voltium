# Contributing to Voltium

## Development Workflow

1. Create a feature branch from `develop`
2. Make your changes
3. Run tests and typecheck locally
4. Push and create a PR

## Requirements

- Node.js 20+
- PostgreSQL for local development
- All tests must pass
- No TypeScript errors

## Code Style

- Use TypeScript for all new code
- Use ESLint for code quality
- Follow existing patterns in the codebase

## Testing

```bash
# Run typecheck first
npm run typecheck

# Run lint
npm run lint

# Run unit tests
npm run test:unit
```

## Commit Messages

Format: `<type>(<scope>): <description>`

Types:

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Adding tests
- `chore` - Maintenance

## PR Checklist

- [ ] Tests pass locally
- [ ] TypeScript compiles without errors
- [ ] Lint passes (or justified exceptions)
- [ ] Documentation updated (if applicable)

## Database Changes

1. Modify `prisma/schema.prisma`
2. Run `npm run db:push` locally to test
3. Create a migration: `npm run db:migrate`
4. Include migration files in PR

## API Changes

- Update `docs/API.md` for endpoint changes
- Add/update validators in `src/lib/validators.ts`
- Add unit tests in `tests/unit/`
