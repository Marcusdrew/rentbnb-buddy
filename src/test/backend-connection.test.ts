import { afterEach, describe, expect, it, vi } from "vitest";
import { backendConfig, backendAuthIssuer, backendFetch } from "@/lib/backend-config";

afterEach(() => vi.unstubAllGlobals());

describe("External carnet connection", () => {
  it("uses the supplied backend for account and agent authentication", () => {
    expect(backendConfig.url).toBe("https://syakgqzoxwrttrveaiig.supabase.co");
    expect(backendAuthIssuer).toBe("https://syakgqzoxwrttrveaiig.supabase.co/auth/v1");
  });

  it("sends opaque publishable keys as apikey, never as bearer JWTs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await backendFetch(`${backendConfig.url}/rest/v1/tenants`, {
      headers: { Authorization: `Bearer ${backendConfig.publishableKey}` },
    });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("apikey")).toBe(backendConfig.publishableKey);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("preserves the signed-in user's bearer token for owner-only access", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await backendFetch(`${backendConfig.url}/rest/v1/tenants`, {
      headers: { Authorization: "Bearer test-user-token" },
    });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-user-token");
    expect(headers.get("apikey")).toBe(backendConfig.publishableKey);
  });
});