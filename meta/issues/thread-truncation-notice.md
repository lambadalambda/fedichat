# Note possible truncation on capped context responses

## Summary

Mastodon caps unauthenticated `/context` at 40 ancestors / 60 descendants,
so deep threads silently render partial. Pleroma returns full context and
is unaffected. The status line should be honest about it.

## Requirements

- When the root context returns exactly the Mastodon unauth descendant cap
  (60), append "(thread may be truncated)" to the status line.

## Acceptance Criteria

- Unit test for the detection helper.
- Pleroma threads under the cap show no notice.

## Notes

- Heuristic by design: the API gives no truncation signal. Related:
  [[mastodon-urls]].
