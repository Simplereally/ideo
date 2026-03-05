import { describe, it, expect } from "vitest";
import {
  extractApiKey,
  extractVertexCredentials,
} from "./extract-credentials";

// ---------------------------------------------------------------------------
// extractApiKey
// ---------------------------------------------------------------------------

describe("extractApiKey", () => {
  it("returns credentials.apiKey when present", () => {
    expect(
      extractApiKey({ credentials: { apiKey: "nested-key" } }),
    ).toBe("nested-key");
  });

  it("returns legacy body.apiKey when credentials is absent", () => {
    expect(extractApiKey({ apiKey: "legacy-key" })).toBe("legacy-key");
  });

  it("prefers credentials.apiKey over legacy body.apiKey", () => {
    expect(
      extractApiKey({
        credentials: { apiKey: "nested-key" },
        apiKey: "legacy-key",
      }),
    ).toBe("nested-key");
  });

  it("falls back to legacy when credentials exists but has no apiKey", () => {
    expect(
      extractApiKey({ credentials: {}, apiKey: "legacy-key" }),
    ).toBe("legacy-key");
  });

  it("returns undefined when neither is present", () => {
    expect(extractApiKey({})).toBeUndefined();
  });

  it("returns undefined when both are non-string values", () => {
    expect(
      extractApiKey({ credentials: { apiKey: 123 }, apiKey: 456 }),
    ).toBeUndefined();
  });

  it("ignores non-string apiKey in credentials and falls back to legacy string", () => {
    expect(
      extractApiKey({ credentials: { apiKey: null }, apiKey: "legacy" }),
    ).toBe("legacy");
  });
});

// ---------------------------------------------------------------------------
// extractVertexCredentials
// ---------------------------------------------------------------------------

describe("extractVertexCredentials", () => {
  it("returns body.credentials when present (nested form)", () => {
    const creds = { accessToken: "tok", projectId: "proj" };
    expect(
      extractVertexCredentials({ credentials: creds }),
    ).toEqual(creds);
  });

  it("returns legacy body.vertex when credentials is absent", () => {
    const vertex = { accessToken: "tok", projectId: "proj" };
    expect(
      extractVertexCredentials({ vertex }),
    ).toEqual(vertex);
  });

  it("prefers body.credentials over legacy body.vertex", () => {
    const nested = { accessToken: "nested-tok", projectId: "nested-proj" };
    const legacy = { accessToken: "legacy-tok", projectId: "legacy-proj" };
    expect(
      extractVertexCredentials({ credentials: nested, vertex: legacy }),
    ).toEqual(nested);
  });

  it("returns undefined when neither is present", () => {
    expect(extractVertexCredentials({})).toBeUndefined();
  });

  it("falls back to legacy when credentials is explicitly undefined", () => {
    const vertex = { accessToken: "tok", projectId: "proj" };
    expect(
      extractVertexCredentials({ credentials: undefined, vertex }),
    ).toEqual(vertex);
  });
});
