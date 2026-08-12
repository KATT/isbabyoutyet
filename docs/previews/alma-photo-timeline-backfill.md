# Photo timeline backfill preview — `alma`

Generated against production for **Alma Simone Petra Darvill** (`alma-simone-petra-darvill`).

Slug `alma` resolves via `babyPublicIdHistory` when it is not the current `publicId`.

The audit log (`babyAuditLog`) records `baby` table writes from **2026-01-23** onward.
Each distinct `photoId` in that history becomes a timeline photo update at the storage
file's upload time. Photos deleted by the legacy replace-on-upload flow cannot be recovered.

## Summary

| Metric | Count |
| --- | ---: |
| Audit-log photo changes | 0 |
| **Would inject** (new timeline rows) | 0 |
| Already in feed | 0 |
| Unrecoverable (audit entry but blob gone) | 0 |

## Current page photo (from `baby.photoId`)

- Photo: `kg237rcysy0k266rbgk0mja6g17z179a`
- Uploaded: 2026-01-11 19:00:56.641Z
- In timeline feed: yes

![Current page photo](https://festive-frog-654.convex.cloud/api/storage/e190029c-32be-4c13-b6ea-3d01a8ade1c9)

### Would inject on deploy (`backfillHistoricalPhotosFromAuditLog`)

_None._

### Already in timeline (no-op)

_None._

### Unrecoverable (audit entry but blob gone)

_None._


## Full audit-log photo timeline

_No audit-log photo history for this baby. Photos uploaded before 2026-01-23 (when the audit log started) are not recorded; only the surviving blob remains (see current page photo above). That photo was already backfilled into the timeline during the timeline migration._
