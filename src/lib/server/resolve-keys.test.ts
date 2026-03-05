import { describe, it, expect } from "vitest";
import {
  resolveApiKey,
  resolveVertexCredentials,
} from "./resolve-keys";

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

describe("resolveApiKey", () => {
  it("prefers client key over env value", () => {
    const result = resolveApiKey("client-key", "env-key", "Test");
    expect(result).toEqual({ ok: true, value: "client-key" });
  });

  it("falls back to env when client key is undefined", () => {
    const result = resolveApiKey(undefined, "env-key", "Test");
    expect(result).toEqual({ ok: true, value: "env-key" });
  });

  it("falls back to env when client key is null", () => {
    const result = resolveApiKey(null, "env-key", "Test");
    expect(result).toEqual({ ok: true, value: "env-key" });
  });

  it("falls back to env when client key is empty string", () => {
    const result = resolveApiKey("", "env-key", "Test");
    expect(result).toEqual({ ok: true, value: "env-key" });
  });

  it("falls back to env when client key is whitespace-only", () => {
    const result = resolveApiKey("   ", "env-key", "Test");
    expect(result).toEqual({ ok: true, value: "env-key" });
  });

  it("returns error when both are missing", () => {
    const result = resolveApiKey(undefined, undefined, "Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Test");
      expect(result.error).toContain("No API key available");
    }
  });

  it("returns error when both are empty", () => {
    const result = resolveApiKey("", "", "Google");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Google");
    }
  });

  it("trims the resolved key", () => {
    const result = resolveApiKey("  my-key  ", undefined, "Test");
    expect(result).toEqual({ ok: true, value: "my-key" });
  });

  it("does not echo the key value in error messages", () => {
    const result = resolveApiKey(undefined, undefined, "Fal");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Ensure no key value leaks — only the provider label appears
      expect(result.error).not.toContain("undefined");
      expect(result.error).toContain("Fal");
    }
  });
});

// ---------------------------------------------------------------------------
// resolveVertexCredentials
// ---------------------------------------------------------------------------

describe("resolveVertexCredentials", () => {
  it("prefers client fields over env values", () => {
    const result = resolveVertexCredentials(
      { accessToken: "c-token", projectId: "c-proj", location: "europe-west1" },
      { accessToken: "e-token", projectId: "e-proj", location: "asia-east1" },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "c-token",
        projectId: "c-proj",
        location: "europe-west1",
      },
    });
  });

  it("falls back to env when client fields are undefined", () => {
    const result = resolveVertexCredentials(undefined, {
      accessToken: "e-token",
      projectId: "e-proj",
      location: "asia-east1",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "e-token",
        projectId: "e-proj",
        location: "asia-east1",
      },
    });
  });

  it("falls back to env when client is null", () => {
    const result = resolveVertexCredentials(null, {
      accessToken: "e-token",
      projectId: "e-proj",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "e-token",
        projectId: "e-proj",
        location: "us-central1",
      },
    });
  });

  it("mixes client and env fields (partial BYOK)", () => {
    const result = resolveVertexCredentials(
      { accessToken: "c-token" },
      { accessToken: "e-token", projectId: "e-proj", location: "us-west1" },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "c-token",
        projectId: "e-proj",
        location: "us-west1",
      },
    });
  });

  it("defaults location to us-central1 when neither provided", () => {
    const result = resolveVertexCredentials(
      { accessToken: "tok", projectId: "proj" },
      {},
    );
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "tok",
        projectId: "proj",
        location: "us-central1",
      },
    });
  });

  it("returns error listing missing fields when accessToken is absent", () => {
    const result = resolveVertexCredentials(undefined, {
      projectId: "proj",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("accessToken");
      expect(result.error).not.toContain("projectId");
    }
  });

  it("returns error listing missing fields when projectId is absent", () => {
    const result = resolveVertexCredentials(undefined, {
      accessToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("projectId");
      expect(result.error).not.toContain("accessToken");
    }
  });

  it("returns error listing both fields when neither is present", () => {
    const result = resolveVertexCredentials(undefined, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("accessToken");
      expect(result.error).toContain("projectId");
    }
  });

  it("treats empty-string fields as missing", () => {
    const result = resolveVertexCredentials(
      { accessToken: "", projectId: "" },
      {},
    );
    expect(result.ok).toBe(false);
  });

  it("does not echo credential values in error messages", () => {
    const result = resolveVertexCredentials(undefined, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("undefined");
    }
  });
});
