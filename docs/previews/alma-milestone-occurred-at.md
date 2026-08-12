# Milestone `postedAt` vs `occurredAt` — Alma preview

## Problem

Milestone timeline rows used the **event clock** as `postedAt` (feed sort key).
Encouragements use **when they were written**. After backdating birth/labour times,
milestones jumped earlier in the feed than the congratulatory messages that followed
the notification — looking like people replied before the announcement.

## Fix

| Field | Meaning | Used for |
| --- | --- | --- |
| `timelineItems.postedAt` | When announced / posted to the feed | Feed order |
| `updates.occurredAt` | When the milestone actually happened | Badge display (local TZ) |

Redating a milestone in settings updates `occurredAt` only — feed position stays put.

## Alma production (before → after migration)

| Milestone | Event (`occurredAt`) | Current feed slot | After: announce (`postedAt`) | Source |
| --- | --- | --- | --- | --- |
| Labour started | Jan 8, 07:30 UTC | Jan 8, 07:30 UTC | **Jan 8, 10:57 UTC** | `labor_started` notification `createdAt` |
| Gone to hospital | Jan 8, 14:30 UTC | Jan 8, 14:30 UTC | **Jan 8, 16:56 UTC** | `gone_to_hospital` notification `createdAt` |
| Born | Jan 11, 04:14 UTC | Jan 11, 04:14 UTC | **Jan 11, 10:13 UTC** | `born` notification `createdAt` (cancelled; still marks announce attempt) |

UI badge example (viewer local time): **`Born · Jan 11, 5:14 AM`** with relative “posted …” from announce time.
