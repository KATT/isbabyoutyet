---
name: convex-schema-migration
description: >-
  Plan and execute safe Convex schema migrations on deployed apps using this
  repo's three-phase pattern, stacked PRs, and migrations.ts conventions. Use
  when removing fields or enum values, tightening validators, or fixing deploy
  failures after schema changes.
---

# Convex schema migration (this repo)

Safe migrations on a **live** Convex deployment. Read
[`convex-migrate`](../convex-migrate/SKILL.md) for the generic `@convex-dev/migrations`
basics; this skill covers **this project's** workflow and deploy ordering.

## Critical deploy order

On `convex deploy`, Convex **validates every existing document against the new schema before any migration runs**. A tightened validator that rejects legacy rows will fail deploy even if a backfill migration is registered.

If you remove an enum literal or field from the schema in the same deploy as the migration that strips it, validation fails first — the migration never runs.

## Three-phase pattern (removing fields or enum values)

| Phase                       | Action                                 | Schema                                                                                   | Migration                                                                                                              | Stack PR                         |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **1. Deprecate + optional** | Keep validator tolerant of legacy data | Re-add retired enum literal or make field `v.optional(...)`; mark `@deprecated` in JSDoc (`no-convex-optional/no-undocumented-optional` requires this tag) | None yet (or register idempotent strip migration in same PR)                                                           | **1/N**                          |
| **2. Migrate**              | Strip legacy data from all rows        | Same permissive schema as phase 1                                                        | `migrateOne` removes field / filters enum from arrays; register in `runTableMigrations` + `HISTORICAL_MIGRATION_NAMES` | **1/N** (same deploy as phase 1) |
| **3. Remove**               | Tighten schema and delete dead code    | Drop field from `schema.ts` / remove enum literal from validators                        | Migration already ran; no new migration                                                                                | **2/N**                          |

**Never tighten before backfill/strip completes** — same rule as adding required fields, applied in reverse for removal.

For **adding** required fields, use the inverse: optional → backfill → required.

## Stacked PRs (required for breaking changes)

Use [`.agents/skills/create-stacked-prs/SKILL.md`](../../../../.agents/skills/create-stacked-prs/SKILL.md).

- **PR 1/N:** Permissive schema + migration(s) that clean legacy data + tests. One deploy runs migrations via `runAll`.
- **PR 2/N:** Remove deprecated schema fields after PR 1 has deployed and migrations finished.

Do not combine phase 3 with phase 1 in a single deploy — existing rows must validate first, then migrations strip legacy data, then a follow-up deploy may tighten.

## Repo conventions (`packages/convex/convex/migrations.ts`)

### Define migrations

```typescript
export async function removeLegacyFieldDoc(ctx: MutationCtx, doc: Doc<"table">) {
  if (doc.legacyField === undefined) return;
  const { legacyField: _removed, ...rest } = doc;
  await ctx.db.replace("table", doc._id, rest);
}

export const removeLegacyField = migrations.define({
  table: "table",
  migrateOne: removeLegacyFieldDoc,
});
```

For enum values in arrays, filter to the current allowed set in `migrateOne` (strip unknown strings, keep valid ids).

### Register runners

1. Add to `runTableMigrations` array (runs on every deploy via `runAll`).
2. If the migration must complete before **any** future deploy is safe, add to `HISTORICAL_MIGRATION_NAMES` (used by `historicalDeploymentStatus`).

### Deprecate in validators, not only schema

Union literals and table fields both participate in deploy validation. When removing an enum value or field, keep the validator/schema tolerant until the strip migration has run.

### Tests

Add convex-test coverage in `migrations.test.ts`: insert a doc with legacy shape, run `migrateOne` helper (or `runTableMigrations`), assert clean state and idempotency.

## Checklist

```
Removal migration:
- [ ] Phase 1: validator/schema still accepts legacy rows (`v.optional` + `@deprecated` JSDoc; enforced by `no-convex-optional/no-undocumented-optional`)
- [ ] Phase 2: idempotent migration in runTableMigrations (+ HISTORICAL if gate)
- [ ] Test in migrations.test.ts
- [ ] PR 1/N: permissive schema + migration + deploy
- [ ] Verify deploy + migration status
- [ ] Phase 3 / PR 2/N: remove deprecated schema fields only
- [ ] pnpm checks
```

## Pattern examples

| Change                         | PR 1/N                                             | PR 2/N                      |
| ------------------------------ | -------------------------------------------------- | --------------------------- |
| Remove optional boolean flag   | Keep `v.optional(...)` + strip migration           | Drop field from `schema.ts` |
| Remove enum literal from union | Keep literal with `@deprecated` + filter migration | Drop literal from validator |
| Add required field             | Optional field + backfill migration                | Make field required         |

## References

- Generic migrate skill: [`convex-migrate`](../convex-migrate/SKILL.md)
- Rehearse on preview: [`convex-migrate-rehearse`](../convex-migrate-rehearse/SKILL.md)
- Package agent notes: [`AGENTS.md`](../../AGENTS.md)
