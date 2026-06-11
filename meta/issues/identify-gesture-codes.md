# Identify gesture codes and add gesture text rules

## Summary

Body images carry emotion codes >9 (10, 11, 12) which per the Comic Chat
paper (§4.1) are gestures, not emotions: waving, pointing at self, pointing
at the other character. Identify which code is which by inspecting the
composed poses, then trigger them from text the way the original did.

## Requirements

- Visually identify codes 10/11/12 across several standard characters.
- Document the mapping in `scripts/extract_poses.py` and `index.html`.
- Text rules from the paper: greetings (hi, hello, bye, goodbye, welcome at
  sentence start) and "brb" → wave; "I/I'll/I'm/IMHO…" at sentence start →
  point at self; "you/are you/will you…" at sentence start → point at other.
- Gesture wins over weak emotion defaults but not over strong emotion cues.

## Acceptance Criteria

- A post saying "hi" renders the speaker waving.
- A post starting with "you …" renders the speaker pointing at the listener.
- Mapping is documented next to the emotion code table.
