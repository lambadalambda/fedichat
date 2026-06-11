# Multiple balloons per panel with routing-channel layout

## Summary

One post per panel makes long threads sprawl. The paper (§5.2, §6.1) packs
several utterances into a panel: balloons laid out above the characters in
comic reading order (top-down, then left-right) using the PlaceBalloons /
routing-channel algorithm, with panel breaks when balloons no longer fit.

## Requirements

- Implement PlaceBalloons: per balloon, estimate width from text area; place
  bodies greedily; maintain disjoint routing channels guaranteeing each tail a
  clear vertical corridor to its speaker's head; shrink/shift channels as new
  balloons arrive (MaxAllowable / ReduceChannel from the paper).
- Reading order: a balloon must be no higher than the bottom of balloons to
  its right is allowed... follow the paper: each balloon placed as high as
  possible while no higher than the top of balloons already placed to its
  left, and below the bottom of balloons placed to its right when needed for
  reading order.
- Panel breaks (§6.1): break when a balloon no longer fits, when a 6th
  character would be needed, when the same character speaks again, and with
  15% probability after a one-character panel with a non-trivial utterance.
- Tails point toward the speaker's face (mouth anchor is in the manifest).

## Acceptance Criteria

- Consecutive short posts by different speakers share a panel with correctly
  ordered balloons whose tails point at the right characters.
- No balloon overlaps another balloon or a character's face.
- Same speaker twice in a row always starts a new panel.
