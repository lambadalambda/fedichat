# Extract pure functions into a tested module

## Summary

All logic lives in `index.html` (1000+ lines) with zero tests, although
most of it — `panelCost`, `arrange`, `layoutBalloons`, `wordTokens`,
`wrapTokens`, `splitLong`, `emotionFor`, `makeCast`, `pickPose`,
`parseNoticeUrl`, `balloonPath` — is already pure. Extracting it unlocks
TDD for every feature that follows.

## Requirements

- Move the pure functions into `comic.mjs` (ES module) loaded by both the
  browser (`<script type="module">`) and node.
- Text measurement (canvas `measureText`) becomes an injected dependency so
  node tests can use a fake.
- Characterization tests in `test/comic.test.mjs` using node's built-in
  `node:test` runner — no npm dependencies.
- Retire the `wrapLines`/`wrapTokens` duplication (narration boxes are the
  only `wrapLines` caller).

## Acceptance Criteria

- `node --test` passes, covering wrapping, splitting, emotion rules,
  arrangement costs, balloon layout invariants (no overlaps, reading
  order), casting collisions, URL parsing.
- The viewer renders the `test` fixture identically to before (visual
  check).

## Notes

- Related: [[balloon-links]], [[png-export]].
