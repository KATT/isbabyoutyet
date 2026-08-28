# Vendored Anti-Slop rules

Source: <https://github.com/dmmulroy/anti-slop>

Revision: `6d538555cb151d4121ed51a27db81890eacf8ae9`

All generic rules, shared helpers, and upstream tests live in
`packages/oxlint-plugins/src/` (same package as the repo's other Oxlint plugins).
`anti-slop.ts` registers every rule; `.oxlintrc.json` enables them one at a
time in stacked follow-up PRs that also fix violations.

The sources are vendored under the accompanying MIT license (`ANTI_SLOP_LICENSE`).
