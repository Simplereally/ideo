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

### Probe: exact user payload with landscape `aspectRatio` plus `size`

Request:

- prompt: `dark silhouette midnight ethereal celestial woman`
- image: `https://anondrop.net/1480906243915649167/reference-1773145958571.jpg`
- aspectRatio: `3:2`
- size: `1280x720`

Result:

- Transport status `200`
- SSE payload returned `{"error":"Provider error (400 Bad Request)"}`

### Probe: same exact prompt + image, keep `aspectRatio`, omit `size`

Request:

- prompt: `dark silhouette midnight ethereal celestial woman`
- image: `https://anondrop.net/1480906243915649167/reference-1773145958571.jpg`
- aspectRatio: `3:2`
- size: omitted

Result:

- Success
- Returned video URL

What this proves:

- The exact same image URL, host, and prompt can succeed once `size` is removed
- The earlier content/safety-only explanation is not sufficient for this case
- `aspectRatio` itself is not the offending field here

### Probe: same exact prompt + image, omit both `aspectRatio` and `size`

Request:

- prompt: `dark silhouette midnight ethereal celestial woman`
- image: `https://anondrop.net/1480906243915649167/reference-1773145958571.jpg`
- aspectRatio: omitted
- size: omitted

Result:

- Transport status `200`
- SSE payload returned `{"error":"Provider error (400 Bad Request)"}`

What this proves:

- Dropping `aspectRatio` is not a reliable fix for Grok image-to-video
- For this image, `aspectRatio` helped, while `size` hurt

### Probe: same exact prompt + image, switch to portrait `aspectRatio` and portrait `size`

Reference image inspection:

- image bytes: JPEG
- dimensions: `784x1168` (portrait)

Request:

- prompt: `dark silhouette midnight ethereal celestial woman`
- image: `https://anondrop.net/1480906243915649167/reference-1773145958571.jpg`
- aspectRatio: `2:3`
- size: `720x1280`

Result:

- Transport status `200`
- SSE payload returned `{"error":"Provider error (400 Bad Request)"}`

What this proves:

- The failure is not explained only by sending a landscape output shape for a portrait source image
- For this image, the presence of `size` still correlates with failure even when the requested output shape matches the source orientation better

### Probe: control xAI sample, keep `aspectRatio`, omit `size`

Request:

- prompt: `gentle cinematic motion through a still night sky`
- image: `https://docs.x.ai/assets/api-examples/video/milkyway-still.png`
- aspectRatio: `3:2`
- size: omitted

Result:

- Success
- Returned video URL

What this proves:

- `aspectRatio` without `size` is a viable Grok image-to-video shape, not just a one-off fluke on the user image

### Probe: exact R2-hosted request shape, keep `aspectRatio`, omit `size`

Request:

- prompt: `celestial beauty, shimmering otherwordly divine femininity`
- image: `https://pub-1cbcf4561977402ea654a6fdc54f09db.r2.dev/703c7c45-6199-4422-b23e-569a8b7c9620.jpg`
- aspectRatio: `3:2`
- size: omitted

Result:

- Transport status `200`
- SSE payload returned `{"error":"Provider error (400 Bad Request)"}`

Reference image inspection:

- image bytes: JPEG
- dimensions: `784x1168` (portrait)

### Probe: same exact image bytes on a different host

Request:

- prompt: `celestial beauty, shimmering otherwordly divine femininity`
- image: `https://anondrop.net/1480916115017171015/rehosted.jpg`
- aspectRatio: `3:2`
- size: omitted

Result:

- Transport status `200`
- SSE payload returned `{"error":"Provider error (400 Bad Request)"}`

What this proves:

- This failure is not explained by `r2.dev` hosting alone
- Changing hosts does not rescue this exact prompt/image pairing

### Probe: same exact image, benign prompt

Request:

- prompt: `a subtle portrait with gentle movement`
- image: `https://anondrop.net/1480916115017171015/rehosted.jpg`
- aspectRatio: `3:2`
- size: omitted

Result:

- Success
- Returned video URL

### Probe: same exact prompt, control image

Request:

- prompt: `celestial beauty, shimmering otherwordly divine femininity`
- image: `https://docs.x.ai/assets/api-examples/video/milkyway-still.png`
- aspectRatio: `3:2`
- size: omitted

Result:

- Success
- Returned video URL

What this proves:

- The prompt alone is not the rejection cause
- The image alone is not the rejection cause
- The upstream rejection is triggered by the specific prompt/image combination

## Working Conclusion

The strongest current evidence points to four upstream constraints:

1. Host acceptance is selective.
   Some direct image hosts/URLs that are fetchable from Ideo still fail upstream.
   Evidence:
   - xAI sample succeeds from `docs.x.ai`
   - same bytes fail from Catbox
   - Wikimedia cat fails direct but succeeds after re-hosting to AnonDrop

2. `size` is a fragile field for Grok image-to-video.
   Evidence:
   - the exact same user image URL + exact same prompt failed with `size`
   - the exact same user image URL + exact same prompt succeeded when `size` was removed and `aspectRatio` was kept
   - omitting both `aspectRatio` and `size` failed, so the successful variant is not simply "drop all shape fields"
   - a known-good xAI sample also succeeds with `aspectRatio` and no `size`

3. Prompt/image interaction can trigger opaque safety rejection even when shape and hosting are otherwise acceptable.
   Evidence:
   - the exact failing R2 image still failed after being moved to a different public host
   - the exact same image succeeded with a benign portrait-motion prompt
   - the exact same prompt succeeded with the xAI control image

4. Airforce still exposes too little detail to know the full validation rule set.
   Evidence:
   - provider-side failures are still surfaced only as opaque `400 Bad Request`
    - some requests succeed with `size`, so `size` is not universally rejected
    - some requests still fail for prompt/image moderation reasons independent of the JSON shape

## Current Leading Hypotheses

1. Ideo should omit `size` for Grok image-to-video requests while still sending `aspectRatio`
2. Some Grok image-to-video failures are pairwise prompt/image safety failures, not contract failures
3. Host acceptance still matters in other cases, but is not the sole explanation for every rejected reference image
4. Airforce does not expose enough error detail to distinguish shape rejection from prompt/image moderation without comparative probing

## Next Probes

1. Ship the safer Grok image-to-video request shape in Ideo: keep `aspectRatio`, omit `size` when `image_urls` are present
2. Preserve `aspectRatio` when using selected-image reference flows in Ideo
3. Improve user-facing error messaging for opaque provider-side `400` failures on image references
