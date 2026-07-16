# Media polish: all images, sensitive blur, video stills

## Summary

Only the first image attachment renders (the rest collapse into
"[attachment]"), the `sensitive` flag is ignored so NSFW-flagged images
show immediately even under a CW narration, and videos are text markers
although they ship a poster frame.

## Requirements

- All image attachments render in the balloon as one side-by-side row
  (aspect-ratio aware, shared height), so the existing single-image height
  math and relax-shrink logic generalize.
- `sensitive: true` media renders blurred; click toggles reveal. Hover
  preview only when revealed.
- `video`/`gifv` attachments with a `preview_url` join the image row with a
  play-marker overlay; only audio/unknown keep the "[attachment]" text.

## Acceptance Criteria

- Unit tests for the row-sizing function (widths sum to fit, height shrinks
  when relax demands it).
- Fixture cases: multi-image post, sensitive post, video post.

## Notes

- Related: [[testable-module]].
