import { describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl, SalesforceConnector } from "./index";

describe("salesforce oauth", () => {
  it("builds authorization URL", () => {
    const url = buildAuthorizationUrl({ clientId: "cid", redirectUri: "http://localhost/cb", state: "s1" });
    expect(url).toContain("response_type=code");
    expect(url).toContain("client_id=cid");
  });

  it("testConnection fails on missing config", async () => {
    const connector = new SalesforceConnector();
    const result = await connector.testConnection({ credentials: {} });
    expect(result.ok).toBe(false);
  });

  it("extractor paginates", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ records: [{ Id: "1" }], nextRecordsUrl: "/next" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ records: [{ Id: "2" }] }) }));
    const connector = new SalesforceConnector();
    const out: unknown[] = [];
    for await (const r of connector.extract({ orgId: "o1", connectionId: "c1", runId: "r1", mode: "incremental", resource: "Account", checkpoint: null, config: {
      clientId: "x", clientSecret: "x", redirectUri: "x", instanceUrl: "https://example.my.salesforce.com", accessToken: "a", refreshToken: "r"
    } })) out.push(r);
    expect(out).toHaveLength(2);
  });
});
