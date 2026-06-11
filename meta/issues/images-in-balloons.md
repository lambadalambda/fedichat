# Render post images inside speech balloons

## Summary

Posts with image attachments currently show a "[picture]" text marker.
Render the image itself inside the speech balloon, under the text.

## Requirements

- First image attachment renders inside the balloon below the text (or as
  the whole balloon content for caption-less image posts).
- Balloon layout accounts for the image: width floor, height includes the
  scaled image (use the attachment's aspect ratio from `meta`, preview URL
  for bandwidth).
- Comic styling: black border, grayscale to match the Woodring art.
- Non-image attachments (video/audio) keep a text marker.

## Acceptance Criteria

- A post with an image shows that image inside its balloon in the panel.
- An image-only post (no text) renders a balloon containing just the image.
- Balloons with images don't overlap other balloons or characters' faces.
