# Airforce Grok Video Investigation

Last updated: 2026-03-10

## Goal

Determine conclusively why some `image_urls` succeed for Airforce `grok-imagine-video` while others fail with:

```text
data: {"error":"Provider error (400 Bad Request)"}
```

## Known Working Request

```json
{
  "model": "grok-imagine-video",
  "prompt": "Looking cute, rolling around",
  "n": 1,
  "response_format": "url",
  "sse": true,
  "aspectRatio": "2:3",
  "size": "480x854",
  "image_urls": [
    "https://anondrop.net/logo.jpg"
  ]
}
```

Result:

- HTTP/SSE transport opened successfully
- Returned final video URL

## Known Failing Request

```json
{
  "model": "grok-imagine-video",
  "prompt": "rolling around on floor",
  "n": 1,
  "response_format": "url",
  "sse": true,
  "aspectRatio": "2:3",
  "size": "480x854",
  "image_urls": [
    "https://anondrop.net/1480823934797742122/Ip7drXftkXkjvWmfbjDlU_oM3w0u0U.jpg"
  ]
}
```

Result:

- Transport status `200`
- SSE payload returned `{"error":"Provider error (400 Bad Request)"}`

## HTTP Comparison

### Failing uploaded file URL

- URL: `https://anondrop.net/1480823934797742122/Ip7drXftkXkjvWmfbjDlU_oM3w0u0U.jpg`
- `HEAD` status: `200`
- `GET` status: `200`
- Content-Type: `image/jpeg`
- Content-Length: `338700`
- Final URL unchanged after redirect resolution

### Working logo URL

- URL: `https://anondrop.net/logo.jpg`
- `HEAD` status: `200`
- `GET` status: `200`
- Content-Type header: `image/jpeg`
- Content-Length: `16006`
- Final URL unchanged after redirect resolution

## Binary/Image Inspection

### Failing uploaded file URL

- Actual bytes: JPEG
- PIL format: `JPEG`
- Size: `1200x896`
- Mode: `RGB`
- Contains EXIF metadata

### Working logo URL

- Actual bytes: PNG, despite `.jpg` path and `image/jpeg` header
- PIL format: `PNG`
- Size: `628x630`
- Mode: `RGBA`

## Live Airforce Probes

### Probe: same failing prompt with working `logo.jpg`

Request:

- prompt: `rolling around on floor`
- aspectRatio: `2:3`
- size: `480x854`
- image: `https://anondrop.net/logo.jpg`

Result:

- Success

What this rules out:

- The prompt alone is not the reason for failure

### Probe: failing uploaded image with geometry corrected to landscape 720p

Request:

- prompt: `rolling around on floor`
- aspectRatio: `3:2`
- size: `1280x720`
- image: `https://anondrop.net/1480823934797742122/Ip7drXftkXkjvWmfbjDlU_oM3w0u0U.jpg`

Result:

- Still failed with provider-side `400`

What this rules out:

- The portrait `2:3` / `480x854` request shape is not the sole cause

### Probe: exact same failing image bytes re-hosted on Catbox

Request:

- prompt: `rolling around on floor`
- aspectRatio: `3:2`
- size: `1280x720`
- image: `https://files.catbox.moe/fg3nxz.jpg`

Result:

- Still failed with provider-side `400`

What this rules out:

- The failure is not specific to the AnonDrop uploaded-file URL path

### Probe: metadata-stripped / re-encoded JPEG on Catbox

Request:

- prompt: `rolling around on floor`
- aspectRatio: `3:2`
- size: `1280x720`
- image: `https://files.catbox.moe/gon5yf.jpg`

Result:

- Still failed with provider-side `400`

What this rules out:

- Original EXIF metadata is not the sole cause
- The original JPEG container encoding is not the sole cause

### Probe: PNG re-encode on Catbox

Request:

- prompt: `rolling around on floor`
- aspectRatio: `3:2`
- size: `1280x720`
- image: `https://files.catbox.moe/m3cd9y.png`

Result:

- Still failed with provider-side `400`

What this rules out:

- JPEG-vs-PNG alone is not the deciding factor
- Host path plus original encoding together are not the sole cause

### Probe: official xAI sample image direct from `docs.x.ai`

Request:

- prompt: `rolling around on floor`
- aspectRatio: `3:2`
- size: `1280x720`
- image: `https://docs.x.ai/assets/api-examples/video/milkyway-still.png`

Result:

- Success

What this proves:

- Airforce Grok image-to-video is not generally broken
- The request contract used by Ideo can succeed with an external image URL

### Probe: exact same xAI sample bytes re-hosted on Catbox

Request:

- prompt: `rolling around on floor`
- aspectRatio: `3:2`
- size: `1280x720`
- image: `https://files.catbox.moe/265uma.png`

Result:

- Failed with provider-side `400`

What this proves:

- Remote host acceptance matters
- The same image bytes can pass or fail depending on where they are hosted

### Probe: Wikimedia cat image direct vs re-hosted through Ideo's `/api/reference-image`

Direct request:

- image: `https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg`
- Result: failed with provider-side `400`

Re-hosted request:

- image: `https://anondrop.net/1480829860392861751/reference-1773127747324.jpg`
- Result: success

What this proves:

- Some otherwise valid public image URLs are rejected directly
- Re-hosting to an accepted public host can flip the same safe image from failure to success

### Probe: failing image re-uploaded to fresh AnonDrop URL

Request:

- image: `https://anondrop.net/1480830675648122931/reference-1773127941840.jpg`

Result:

- Still failed with provider-side `400`

What this proves:

- The failure is not due to a stale or bad AnonDrop upload instance
- For this image, re-hosting alone does not solve the problem

### Probe: benign human portrait re-hosted through Ideo's `/api/reference-image`

Source:

- `https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg`

Re-hosted request:

- image: `https://anondrop.net/1480831132584120494/reference-1773128050220.jpg`
- prompt: `a subtle portrait with gentle movement`
- Result: success

What this proves:

- Human subjects are not rejected categorically
- The failing image is not being rejected just because it contains a person

### Probe: user-provided local `testing-image.jpeg` through Ideo's upload flow

Local file:

- `C:\Users\User\Pictures\image-generations\testing-image.jpeg`
- JPEG
- `784x1168`

Upload result:

- `https://anondrop.net/1480846496583647355/testing-image.jpeg`

Airforce request:

- prompt: `a subtle portrait with gentle movement`
- aspectRatio: `2:3`
- size: `720x1280`
- image: `https://anondrop.net/1480846496583647355/testing-image.jpeg`

Result:

- Success
- Returned video URL: `https://anondrop.net/1480846848875827375/vid.mp4`

What this proves:

- Ideo's current Airforce Grok path can succeed end-to-end with a normal local image
- Re-hosting through the app's public reference-image upload path is viable for safe portrait references

## Visual Inspection

### Failing image

- Sexualized lingerie mirror selfie

### Successful controls

- `logo.jpg`: simple static site asset
- xAI milky-way sample: benign landscape scene
- Obama portrait: benign clothed portrait

## Working Conclusion

The failure is explained by a combination of two upstream constraints:

1. Host acceptance is selective.
   Some direct image hosts/URLs that are fetchable from Ideo still fail upstream.
   Evidence:
   - xAI sample succeeds from `docs.x.ai`
   - same bytes fail from Catbox
   - Wikimedia cat fails direct but succeeds after re-hosting to AnonDrop

2. The specific failing reference image is being rejected on content/safety grounds by the upstream provider.
   Evidence:
   - the failing image remains rejected after:
     - redirect resolution
     - fresh AnonDrop re-upload
     - Catbox re-host
     - JPEG re-encode
     - PNG re-encode
     - exact portrait crop
     - exact landscape crop
     - small square PNG conversion
   - safe controls succeed through the same general pipeline:
     - xAI milky-way sample
     - Wikimedia cat after accepted-host rehosting
     - Obama portrait after accepted-host rehosting
   - the failing image visually appears sexualized / NSFW-adjacent, which is consistent with an opaque upstream safety rejection surfaced only as `Provider error (400 Bad Request)`

## Current Leading Hypotheses

1. Ideo should re-host Airforce Grok reference images to a stable accepted public host when possible
2. Even after accepted-host rehosting, some images will still be rejected for upstream safety/content reasons
3. Airforce does not expose enough error detail to distinguish host rejection from safety rejection without comparative probing

## Next Probes

1. Restore public re-host normalization for Airforce Grok, but never fall back to localhost proxy URLs
2. Improve user-facing error messaging for opaque provider-side `400` failures on image references
