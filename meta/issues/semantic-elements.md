# Semantic elements: keyword backgrounds and narration boxes

## Summary

The paper (§6.3) changes the panel scene when topical keywords appear, and
(§8) renders IRC action messages in narration boxes. Adapt both to fediverse
threads.

## Requirements

- Keyword → background switches for a single panel, using the five extracted
  backgrounds (e.g. heated/flame keywords → volcano; cozy/home → den;
  nature/outdoors → field or pastoral). Deterministic, documented list.
- Narration boxes (rectangular, top of panel) for non-speech events worth
  showing: content warnings, and "X boosted this thread"-style notes if
  present in the data.
- Balloons placed below the narration box per the paper.

## Acceptance Criteria

- A post containing a configured keyword renders its panel with the themed
  background while neighboring panels keep the thread background.
- A content-warned post shows the CW text in a narration box.
