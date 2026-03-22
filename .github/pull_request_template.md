## Summary

<!-- One or two sentences: what does this PR do and why? -->

---

## Code Quality

- [ ] `pnpm turbo lint` passes with zero errors
- [ ] `pnpm turbo typecheck` passes with zero errors
- [ ] No `any` types, no `@ts-ignore`, no `eslint-disable` without a justifying comment
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Error cases are handled (not just the happy path)

## Tests

- [ ] All new service methods have unit tests
- [ ] All new tRPC endpoints have integration tests
- [ ] All tests pass: `pnpm turbo test`
- [ ] Tests cover both success and failure cases
- [ ] No `test.only` or `test.skip` left in without a linked issue number

## Types & Validation

- [ ] All tRPC inputs use Zod schemas (no unvalidated input)
- [ ] Shared types live in `packages/shared`, not duplicated
- [ ] Drizzle schema changes have a migration: `pnpm drizzle-kit generate`

## Database

- [ ] New migrations are generated and tested
- [ ] Migrations are idempotent (can run twice without error)
- [ ] Indexes exist for columns used in WHERE clauses and JOINs

## Frontend (if applicable)

- [ ] Components handle loading, error, and empty states
- [ ] No layout shifts during data fetching (skeletons or placeholders)
- [ ] Accessible: semantic HTML, keyboard navigable, sufficient contrast
- [ ] Responsive: tested at desktop (1200px+) and tablet (768px) widths

## Documentation

- [ ] `Docs/PRD.md` updated if behaviour changed or spec was wrong
- [ ] `Docs/IMPLEMENTATION_NOTES.md` updated if a non-obvious decision was made
- [ ] `Docs/MILESTONES.md` task checked off
- [ ] `CHANGELOG.md` entry added

## Migration Guard

- [ ] If any file under `**/schema/**` changed, a corresponding new file exists under `**/migrations/**`

## Breaking Changes

- **Breaking change?** Yes / No
- <!-- If yes, describe what breaks and what the migration path is -->

---

<!-- Code review: run the §10 protocol from Docs/DEVELOPMENT_GUIDE.md before marking ready. -->
