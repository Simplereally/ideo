function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function logGenerationRequest(scope: string, payload: unknown): void {
  console.log(`[${scope}] upstream request:\n${stringify(payload)}`);
}

export function logGenerationResponse(scope: string, payload: unknown): void {
  console.log(`[${scope}] upstream response:\n${stringify(payload)}`);
}

export function logGenerationTextResponse(
  scope: string,
  status: number,
  body: string,
): void {
  console.log(`[${scope}] upstream transport status: ${status}`);
  console.log(`[${scope}] upstream response body:\n${body}`);
}

export function logGenerationProviderError(
  scope: string,
  transportStatus: number,
  providerStatus: number,
  payload: unknown,
): void {
  console.log(
    `[${scope}] upstream provider error: transport=${transportStatus}, provider=${providerStatus}`,
  );
  console.log(`[${scope}] upstream provider payload:\n${stringify(payload)}`);
}
