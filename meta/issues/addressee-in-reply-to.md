# Addressee should come from in_reply_to, not the first mention

## Summary

`addresseeOf` picks the first mention that's a thread participant.
Replies on Mastodon/Pleroma inherit the whole upstream audience in
`mentions` (order not meaningful), so in branching threads a post's
panel addressee is effectively a random @ from up-thread — often the
root author — instead of the person actually being replied to. This
drives arrangement/facing, so conversations read wrong.

## Requirements

- Prefer the author of the status referenced by `in_reply_to_id` (when
  present in the thread), then `in_reply_to_account_id` matched against
  participants, then the existing mention rule, then previous distinct
  speaker.
- Self-replies fall through (a thread continuation isn't addressed at
  yourself).

## Acceptance Criteria

- Unit tests cover: reply target beats mention order, account-id
  fallback, self-reply fallthrough, no-reply posts unchanged.
- A branching real thread renders with panels pairing replier and
  actual parent author.
