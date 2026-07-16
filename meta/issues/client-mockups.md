# Mockups: fedichat as a full fediverse client

## Summary

Explore what fedichat would look like as a proper client (prototype):
login/OAuth, timelines, posting. Timelines may not suit the comic-strip
form (posts are unrelated), so mock at least two treatments. Static HTML
mockups in `mockups/`, using the real character/background art, in the
Win95/MS-Chat chrome the viewer already gestures at.

## Requirements

- `mockups/index.html` hub linking the screens.
- `login.html` — instance picker + OAuth flow dialog.
- `timeline-panels.html` — one comic panel per post, action bar under each.
- `timeline-list.html` — MS Chat text-mode look: post list with character
  icons, member pane, compose row.
- `compose.html` — compose window with emotion wheel, self-view pose
  preview, CW/visibility mapped to balloon types, live panel preview.
- No real logic; static screens for direction-picking.

## Acceptance Criteria

- Each screen renders in a browser and reads as a plausible client.

## Notes

- Related: [[backlog-small-ideas]] (cast pinning would feed the self-view).
