# Accept Mastodon status URLs (and friendlier fetch errors)

## Summary

`parseNoticeUrl` only matches `/notice/<id>` and `/objects/<id>`, so a
Mastodon permalink (`https://instance/@user/123456`) can't be pasted.
Mastodon serves CORS on its public API, so support is just URL parsing.
Pleroma stays first-class.

## Requirements

- Accept `https://host/@user/<id>` (including `@user@domain`),
  `https://host/users/<name>/statuses/<id>`, and bare
  `https://host/statuses/<id>`, alongside the existing notice/objects
  forms. Pleroma object UUIDs may contain hyphens.
- On `fetch` network failure, the status line explains the likely cause
  (instance not serving CORS) instead of bare "Failed to fetch".

## Acceptance Criteria

- Unit tests cover all URL forms, with and without trailing junk.
- A Mastodon thread URL renders end-to-end.

## Notes

- Related: [[thread-truncation-notice]].
