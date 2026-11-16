// Public connection details only. Never put a service-role key here.
export const backendConfig = {
  url: "https://syakgqzoxwrttrveaiig.supabase.co",
  publishableKey: "sb_publishable___DwFC7TmXs-MNmhDbA4yg_iXXq0P-f",
} as const;

export const backendAuthIssuer = `${backendConfig.url}/auth/v1`;

export function backendFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  if (headers.get("Authorization") === `Bearer ${backendConfig.publishableKey}`) {
    headers.delete("Authorization");
  }
  headers.set("apikey", backendConfig.publishableKey);
  return fetch(input, { ...init, headers });
}