# Grok Video Airforce Contract

This document is intentionally strict about what is known.

It describes:

- what Pollinations is guaranteed to send to Airforce for Grok Video
- what field/value combinations can be emitted by Pollinations business logic

It does **not** claim that Airforce accepts every emitted combination.

## Hard Limit Of The Evidence

From the traced Pollinations codebase, the only thing that is fully provable is the outbound request contract Pollinations emits.

It is **not** provable from that code alone that any specific Grok Video payload is accepted by Airforce.

In fact, the recorded integration snapshots in Pollinations include `400 Bad Request` responses for Grok Video requests, so do not treat the emitted payload set as an Airforce acceptance guarantee.

## Endpoint

```http
POST https://api.airforce/v1/images/generations
Content-Type: application/json
Authorization: Bearer <AIRFORCE_API_KEY>
```

## Guaranteed Pollinations Emission Contract

When Pollinations calls Airforce for Grok Video, the JSON body always starts from this shape:

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url"
}
```

Then Pollinations always adds:

- `aspectRatio`
- `size`

And conditionally adds:

- `image_urls`

So the full emitted shape is:

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "aspectRatio": "3:2 | 2:3",
  "size": "854x480 | 1280x720 | 1920x1080 | 480x854 | 720x1280 | 1080x1920",
  "image_urls": ["<url>", "..."]
}
```

## Only Combinations Pollinations Can Emit

These are the only Grok Video body variants Pollinations business logic can generate.

### 1. Landscape Text-To-Video

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "aspectRatio": "3:2",
  "size": "854x480 | 1280x720 | 1920x1080"
}
```

### 2. Landscape Image-To-Video

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "aspectRatio": "3:2",
  "size": "854x480 | 1280x720 | 1920x1080",
  "image_urls": ["<url>", "..."]
}
```

### 3. Portrait Text-To-Video

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "aspectRatio": "2:3",
  "size": "480x854 | 720x1280 | 1080x1920"
}
```

### 4. Portrait Image-To-Video

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "aspectRatio": "2:3",
  "size": "480x854 | 720x1280 | 1080x1920",
  "image_urls": ["<url>", "..."]
}
```

## Orientation Rule

Pollinations derives orientation from dimensions like this:

- `width > height` -> `aspectRatio: "3:2"`
- `width <= height` -> `aspectRatio: "2:3"`

Square input counts as portrait.

## Resolution Bucket Rule

Pollinations derives the size tier from total pixels:

- `< 645120` pixels -> 480P
- `>= 645120` and `< 1451520` pixels -> 720P
- `>= 1451520` pixels -> 1080P

## Exact AspectRatio/Size Pairing Pollinations Emits

| Emitted `aspectRatio` | Emitted `size` values |
| --- | --- |
| `3:2` | `854x480`, `1280x720`, `1920x1080` |
| `2:3` | `480x854`, `720x1280`, `1080x1920` |

Important:

- these `size` values are geometrically 16:9 and 9:16 style dimensions
- Pollinations still pairs them with `3:2` and `2:3`
- this mismatch is present in the traced source
- do not "fix" this mismatch if your goal is to replicate Pollinations exactly

## Default If You Omit Dimensions

Pollinations defaults Grok Video to `1024x1024` before building the Airforce payload.

That produces:

```json
{
  "model": "grok-imagine-video",
  "prompt": "<string>",
  "n": 1,
  "sse": true,
  "response_format": "url",
  "aspectRatio": "2:3",
  "size": "720x1280"
}
```

## Image Input Rule

If image input is present:

- Pollinations sends `image_urls`
- `image_urls` is always an array
- a single image is still wrapped in an array
- multiple images are allowed by Pollinations and passed through as an array
- URLs are redirect-resolved first

Examples:

```json
{
  "image_urls": ["https://example.com/input.jpg"]
}
```

```json
{
  "image_urls": [
    "https://example.com/input-1.jpg",
    "https://example.com/input-2.jpg"
  ]
}
```

## Fields Pollinations Does Not Send For Grok Video

These fields are not part of the outbound Airforce JSON body for Grok Video:

- `duration`
- `seed`
- `quality`
- `negative_prompt`
- `audio`
- `safe`
- `enhance`
- `transparent`
- `guidance_scale`
- raw `image`

## What Ideo Should Treat As Safe Truth

If Ideo wants to mirror Pollinations exactly, the only source-backed rule set is:

1. Send only:
   - `model`
   - `prompt`
   - `n`
   - `sse`
   - `response_format`
   - `aspectRatio`
   - `size`
   - `image_urls` when doing image-to-video
2. Use only these `aspectRatio` values:
   - `3:2`
   - `2:3`
3. Use only these paired sizes:
   - `3:2` -> `854x480`, `1280x720`, `1920x1080`
   - `2:3` -> `480x854`, `720x1280`, `1080x1920`
4. Do not claim these combinations are Airforce-validated unless you test them directly against Airforce.
