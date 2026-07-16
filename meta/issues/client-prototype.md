# Client prototype: Timeline A (comic panels) with OAuth and posting

## Summary

Build mockup 2 (timeline as one comic panel per post) into a working
prototype at `client.html`, alongside the thread viewer. Direction picked
2026-07-16: "huge and kind of unwieldy but nice for such a fun project".

## Requirements

- **Anonymous browsing**: pick an instance, read local/federated public
  timelines with no login.
- **OAuth 2 + PKCE**: register via `/api/v1/apps`, authorize, exchange the
  code in-browser (the Pinafore/Elk pattern; works on Pleroma and
  Mastodon). Token in localStorage; sign-out clears it.
- **Timelines**: Home (signed in), Local, Federated; "Load more"
  pagination via `max_id`; each post renders as a comic panel (character
  by stable account hash, emotion poses, balloon types by visibility,
  media rows, CW narration boxes, semantic backgrounds) with a side card:
  account, relative time, visibility, reply/boost/fav, counts.
- **Boosts** render the boosted post's panel with attribution in the card.
- **Actions**: fav/boost toggle live; Reply opens compose with mention +
  `in_reply_to_id`; Compose posts text with CW + visibility (media upload
  out of scope for the prototype).
- **Clicking a panel** opens the whole thread in the strip viewer
  (`index.html#<status-url>`).
- Shared DOM helpers extracted to `panel.js` so viewer and client reuse
  the same balloon/character rendering; OAuth helpers in `auth.js` with
  node tests (WebCrypto is in node).

## Acceptance Criteria

- Anonymous: lain.com public timeline renders as panels in a real browser
  (agent-browser), screenshots look right.
- Sign-in navigates to the instance's real authorize page with a valid
  client_id/redirect_uri (full token exchange needs interactive login —
  manual step).
- `node --test` passes including new auth/time helpers.
- Viewer (`index.html`) unaffected: fixture renders as before.

## Notes

- Follows [[client-mockups]]. Emotion-wheel compose stays future work.

## Outcome (2026-07-16)

Shipped as `client.html`. Verified with agent-browser against live
lain.com: local + federated timelines render (20/page, Load more works,
no balloon overflows — long posts keep their first splitLong chunk with
an ellipsis), panel click opens the thread in the strip viewer, compose
dialog renders, and Sign in reaches lain.com's real /oauth/authorize
consent page with a valid registration. Not verified live (needs
credentials): the token exchange, home timeline, boost/fav/reply POSTs —
first real login will exercise them. Media upload not included.
