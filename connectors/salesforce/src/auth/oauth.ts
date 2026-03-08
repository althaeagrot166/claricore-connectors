export interface SalesforceConnectionConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken: string;
}

export function buildAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; loginUrl?: string }): string {
  const base = input.loginUrl ?? "https://login.salesforce.com";
  const url = new URL(`${base}/services/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeAuthCodeForToken(config: Pick<SalesforceConnectionConfig, "clientId" | "clientSecret" | "redirectUri"> & { code: string; loginUrl?: string }) {
  const base = config.loginUrl ?? "https://login.salesforce.com";
  const res = await fetch(`${base}/services/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: config.code
    })
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; instance_url: string }>;
}

export async function refreshAccessToken(config: Pick<SalesforceConnectionConfig, "clientId" | "clientSecret" | "refreshToken"> & { loginUrl?: string }) {
  const base = config.loginUrl ?? "https://login.salesforce.com";
  const res = await fetch(`${base}/services/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken
    })
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  return res.json() as Promise<{ access_token: string; instance_url: string }>;
}
