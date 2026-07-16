# Integrate thread view into the client + real sign-in dialog

## Summary

Clicking a timeline panel currently navigates away to `index.html`, which
feels bolted-on. The thread strip should open as a screen inside the
client with a Back button. And sign-in should be the mocked-up "Connect
to the Fediverse" dialog (greeter, software detection, stay-signed-in),
not a bare toolbar button that immediately redirects.

## Requirements

- Extract the strip renderer + thread fetching + canvas/PNG export from
  `index.html` into `strip.js`; both pages consume it (no duplication).
  Viewer behavior unchanged.
- Client: panel click swaps the feed for a thread screen (same window
  chrome) with Back, post count/truncation note, and Save PNG. Thread is
  fetched from the browsed instance by local status id (works for remote
  posts too).
- Sign-in dialog per the mockup: instance field, detected software (via
  `/api/v1/instance`), OAuth explainer, "stay signed in" (localStorage
  vs sessionStorage), Browse anonymously, Sign in.

## Acceptance Criteria

- agent-browser: timeline → click panel → strip renders in-app → Back
  returns to the same feed without refetch; viewer fixture unchanged;
  sign-in dialog shows detected "Pleroma" for lain.com and proceeds to
  the authorize page.

## Notes

- Follows [[client-prototype]].
