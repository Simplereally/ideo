# Airforce API — Grok Video (`grok-imagine-video`)

## Endpoint

```
POST https://api.airforce/v1/images/generations
Authorization: Bearer <AIRFORCE_API_KEY>
Content-Type: application/json
```

---

## Request Body

```json
{
  "model": "grok-imagine-video",
  "prompt": "string",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "size": "1280x720",
  "aspectRatio": "3:2",
  "image_urls": ["https://..."]
}
```

### Field Reference

| Field | Type | Required | Options / Notes |
|-------|------|----------|-----------------|
| `model` | string | Yes | Always `"grok-imagine-video"` |
| `prompt` | string | Yes | Text description of the video |
| `n` | number | Yes | Always `1` |
| `sse` | boolean | Yes | Always `true` |
| `response_format` | string | Yes | Always `"url"` |
| `size` | string | No | See size table below |
| `aspectRatio` | string | No | `"3:2"` (landscape) or `"2:3"` (portrait). Does NOT accept `"16:9"` / `"9:16"` |
| `image_urls` | string[] | No | Array of public image URLs for image-to-video. Omit entirely for text-to-video |

### Size Options

| Orientation | 480p | 720p | 1080p |
|-------------|------|------|-------|
| Landscape (`"3:2"`) | `"854x480"` | `"1280x720"` | `"1920x1080"` |
| Portrait (`"2:3"`) | `"480x854"` | `"720x1280"` | `"1080x1920"` |

---

## Response (SSE stream)

```
data: {"data":[{"url":"https://cdn.airforce/result.mp4"}]}
data: [DONE]
```

May also contain:
- `data: : keepalive` — ignore
- `data: {"error":"..."}` — generation failed

### Parsing

1. Read full response as text
2. Split by `\n`, process lines starting with `data: `
3. Skip `data: [DONE]` and `data: : keepalive`
4. `JSON.parse(line.slice(6))`
5. If `.error` exists — throw
6. Extract `.data[0].url` — take the **last** URL seen
7. Download the mp4 from that URL

---

## Examples

### Text-to-video (landscape 720p)

```json
{
  "model": "grok-imagine-video",
  "prompt": "A cat walking through a garden",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "size": "1280x720",
  "aspectRatio": "3:2"
}
```

### Text-to-video (portrait 1080p)

```json
{
  "model": "grok-imagine-video",
  "prompt": "A waterfall in a forest",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "size": "1080x1920",
  "aspectRatio": "2:3"
}
```

### Image-to-video

```json
{
  "model": "grok-imagine-video",
  "prompt": "Animate this landscape with gentle wind",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "size": "1280x720",
  "aspectRatio": "3:2",
  "image_urls": ["https://example.com/photo.jpg"]
}
```

### Image-to-video (multiple reference images)

```json
{
  "model": "grok-imagine-video",
  "prompt": "Blend these scenes together",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "size": "1280x720",
  "aspectRatio": "3:2",
  "image_urls": [
    "https://example.com/start.jpg",
    "https://example.com/end.jpg"
  ]
}
```

---

## UI Surface Recommendations

Based on what Pollinations exposes to users:

| Control | Type | Values |
|---------|------|--------|
| Prompt | text input | free text |
| Aspect ratio | toggle/select | Landscape (3:2) / Portrait (2:3) |
| Resolution | select | 480p, **720p** (default), 1080p |
| Reference image(s) | file upload / URL input | Optional, enables img2vid mode |

**Not surfaced** (API may or may not support): `seed`, `negative_prompt`, `duration`, `quality`, `guidance_scale`. Pollinations never sends these for grok video.

---

## Operational Notes

- Output is always `video/mp4`
- Retry up to 3x on any failure, no backoff
- `image_urls` must be publicly accessible, direct URLs (resolve redirects beforehand)
- `size` should always be sent, even when `image_urls` is present
- Always use the **last** URL from the SSE stream (not the first)
- Default aspect ratio in Pollinations is landscape (`3:2`)
- Integration test timeout: 180 seconds — expect generation to be slow
- **Actual output resolution:** Regardless of the `size` requested, the API currently returns **688x464** (landscape) or **464x688** (portrait). These are ~3:2 / ~2:3 aspect ratio but at a fixed low resolution. The `size` and resolution parameters appear to be ignored by the API at this time.
