# Balloon styles: wavy outlines, balloon types, comic lettering

## Summary

Balloons are plain CSS rounded rectangles. The paper (§5.1, §5.3, §5.5)
describes Woodring-style balloons: wavy organic outlines (B-splines with
small low-frequency waves added to long segments), and a vocabulary of
balloon types. Map fediverse post properties onto them.

## Requirements

- Render balloons as SVG: rounded body with subtle low-frequency waviness in
  the outline (deterministic per balloon, seeded by post id).
- Balloon types:
  - speech: solid outline, straight/arc tail (default, public posts)
  - whisper: dashed outline, italic text (followers-only / direct posts)
  - thought: oval-chain tail (could be used for content-warned posts, with
    the CW text)
  - shout: jagged outline (posts that trigger the shouting emotion) — the
    paper mentions this type was never implemented in the original; we get to
    finish the job.
- All-caps comic lettering like the original (display transform only).

## Acceptance Criteria

- Balloon outlines are visibly hand-drawn-ish and differ between balloons.
- A followers-only post renders as a whisper balloon.
- A shouting post renders with a jagged balloon.
