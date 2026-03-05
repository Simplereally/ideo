import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/providers/status
// Returns a boolean map of which providers are configured on the server.
// No secrets are leaked — only presence/absence is reported.
// ---------------------------------------------------------------------------

export interface ProviderStatus {
  google: boolean;
  vertex: boolean;
  fal: boolean;
  aiml: boolean;
}

export function GET() {
  const status: ProviderStatus = {
    google: !!process.env.GOOGLE_API_KEY,
    vertex: !!process.env.VERTEX_ACCESS_TOKEN && !!process.env.VERTEX_PROJECT_ID,
    fal: !!process.env.FAL_API_KEY,
    aiml: !!process.env.AIML_API_KEY,
  };

  return NextResponse.json(status);
}
