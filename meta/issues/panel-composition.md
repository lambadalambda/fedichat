# Panel composition: character inclusion, placement and facing

## Summary

Panels currently show exactly speaker + previous speaker. The paper (§4.2-4.3)
composes panels with up to 5 characters and chooses their order/orientation by
minimizing a scoring function, keeping conversational pairs adjacent and
facing, and keeping characters' left-right positions stable across panels.

## Requirements

- Include in a panel: the speaker(s), the addressee, and recent participants,
  capped at 5 (paper limit).
- Addressee detection: leading @mention resolved against thread participants,
  falling back to the previous distinct speaker.
- Placement via the paper's greedy search minimizing Facing + Neighbors:
  - Facing penalties: 4 if a hasn't addressed and isn't facing b; 2 if a
    hasn't addressed and b isn't facing a; 4 if a addressed b and isn't facing
    a; 40 if a addressed b and isn't facing b; 4n if a addressed b with n
    characters between them.
  - Neighbors: 1 point per left/right neighbor differing from the character's
    neighbors in the previous panel.
- Characters not speaking in the panel use neutral poses.

## Acceptance Criteria

- Threads with 3+ active participants produce panels with 3+ characters.
- Speakers face their addressees; addressed pairs are adjacent in the panel.
- A character keeps its panel side across consecutive panels when possible.
