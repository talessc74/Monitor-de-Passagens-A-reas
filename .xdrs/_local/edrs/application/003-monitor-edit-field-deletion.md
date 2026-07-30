---
name: _local-edr-policy-003-monitor-edit-field-deletion
description: PUT /api/monitors/:id must use Firestore FieldValue.delete() to actually remove date/flexibility fields when an edit switches searchMode to 'anytime', instead of a merge-write that leaves stale values behind. Use when touching the monitor update route or repository.
apply-to: services/api/src/routes/monitors.ts (PUT handler), services/api/src/repositories/monitorsRepository.ts
valid-from: 2026-07-30
---

# _local-edr-policy-003: Monitor edit field deletion on mode switch

## Context and Problem Statement

`_local-bdr-policy-004` requires that editing a monitor from `dated` to `anytime` leaves no
date fields behind, per `_local-adr-policy-001`'s rule that `anytime` monitors carry no date
fields at all. `updateMonitor` in `monitorsRepository.ts` writes with `{ merge: true }`, which
only overwrites keys present in the patch — it cannot remove a field that already exists in
the stored document.

Question: how does the edit route actually remove `departureDate`, `departDaysBefore`,
`departDaysAfter`, `returnDate`, `returnDaysBefore`, `returnDaysAfter` from a monitor being
switched to `anytime`?

## Decision Outcome

**Explicit `FieldValue.delete()` sentinels for the six date/flex fields when the patch sets
`searchMode: 'anytime'`**

The `PUT /api/monitors/:id` handler, on detecting `searchMode === 'anytime'` in the parsed
body, builds the Firestore patch with `FieldValue.delete()` for all six date/flexibility
fields instead of simply omitting them — omitting a key from a merge-write is a no-op, not a
removal.

### Details

- Acceptance criterion (verifiable): editing an existing `dated` monitor to `anytime` and then
  reading it back (`GET /api/monitors`) returns an object with no `departureDate`,
  `departDaysBefore`, `departDaysAfter`, `returnDate`, `returnDaysBefore`, or
  `returnDaysAfter` keys at all — not `undefined` values, absent keys.
- Switching the other direction (`anytime` → `dated`) is a normal merge-write: the patch
  includes the new date/flex values and they're simply written.
- This only applies to the edit route. Monitor creation never has this problem — a new
  document is written from scratch with only the fields the chosen mode has.

## References

- `_local-bdr-policy-004` — product decision requiring full edit capability
- `_local-adr-policy-001` — the "no date fields at all in anytime mode" rule this satisfies
