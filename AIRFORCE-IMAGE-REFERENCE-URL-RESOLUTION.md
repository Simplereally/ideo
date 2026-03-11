# Airforce Image Reference URL Resolution

This is a must-have preflight step for Ideo before sending image references to Airforce.

## Requirement

Before sending `image_urls` to Airforce, resolve redirects for every input URL.

Do this with:

- HTTP `HEAD`
- `redirect: "follow"`
- use the final `response.url`

If redirect resolution fails, fall back to the original URL.

## Why

Pollinations does this before sending image references to Airforce for Grok Video.

The purpose is simple:

- many user-supplied image URLs are indirect links
- some hosts redirect to a different CDN or final asset URL
- Airforce may behave better with the final direct asset URL than with a redirecting URL

This does not guarantee Airforce acceptance, but it is part of the traced Pollinations behavior and should be mirrored if Ideo wants the same request preparation.

## Exact Behavior To Mirror

Pseudo-code:

```ts
async function resolveRedirects(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });

    return response.url;
  } catch {
    return url;
  }
}
```

Then:

```ts
const image_urls = await Promise.all(inputUrls.map(resolveRedirects));
```

## Example

Input URL:

```text
https://example.com/my-image-link
```

If that URL redirects like:

```text
302 -> https://cdn.example.com/assets/cat.jpg
```

Then Ideo should send:

```json
{
  "image_urls": [
    "https://cdn.example.com/assets/cat.jpg"
  ]
}
```

Not:

```json
{
  "image_urls": [
    "https://example.com/my-image-link"
  ]
}
```

## What This Step Does Not Do

This step does not:

- download the image bytes
- inspect image contents
- re-encode the image
- proxy the file
- upload the file to another host
- guarantee the final URL is accessible to Airforce

It only converts redirecting URLs into their final destination URLs when possible.

## Important Constraint

If the original URL does not redirect, Ideo should send it unchanged.

If the URL already resolves to a host Airforce likes, this helps.

If the URL never redirects to a host Airforce likes, this step alone will not fix provider rejection.

## Implementation Rule For Ideo

Before any Airforce request that includes image references:

1. take every input image URL
2. resolve redirects via `HEAD` with redirect following
3. build `image_urls` from the final resolved URLs
4. if resolution fails, keep the original URL

## Practical Recommendation

Treat this as mandatory request normalization for Airforce image references in Ideo.
