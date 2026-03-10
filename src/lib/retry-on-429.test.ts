import { describe, expect, it, vi } from "vitest";
import { retryOn429 } from "./retry-on-429";

describe("retryOn429", () => {
  it("retries immediately until the response is not 429", async () => {
    const operation = vi
      .fn<() => Promise<{ status: number; value: string }>>()
      .mockResolvedValueOnce({ status: 429, value: "first" })
      .mockResolvedValueOnce({ status: 429, value: "second" })
      .mockResolvedValueOnce({ status: 200, value: "done" });

    const result = await retryOn429(operation);

    expect(result).toEqual({ status: 200, value: "done" });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("returns immediately for any non-429 response", async () => {
    const operation = vi
      .fn<() => Promise<{ status: number; value: string }>>()
      .mockResolvedValueOnce({ status: 500, value: "failed" });

    const result = await retryOn429(operation);

    expect(result).toEqual({ status: 500, value: "failed" });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
