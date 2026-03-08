import type { ExtractContext } from "@claricore/core";
import type { SalesforceConnectionConfig } from "../auth/oauth";

async function salesforceRequest(url: string, token: string, retries = 3): Promise<Response> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await new Promise((r) => setTimeout(r, (4 - retries) * 500));
    return salesforceRequest(url, token, retries - 1);
  }
  return res;
}

function buildSoql(resource: string, cursor?: string | null): string {
  const fields = resource === "Contact" ? "Id,AccountId,Email,LastModifiedDate" : "Id,Name,LastModifiedDate";
  const where = cursor ? ` WHERE LastModifiedDate > ${cursor}` : "";
  return `SELECT ${fields} FROM ${resource}${where} ORDER BY LastModifiedDate ASC`;
}

export async function* extractAccountsAndContacts(ctx: ExtractContext, config: SalesforceConnectionConfig): AsyncGenerator<Record<string, unknown>> {
  const resource = ctx.resource ?? "Account";
  const soql = buildSoql(resource, ctx.checkpoint?.cursor);
  let nextUrl = `${config.instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`;

  while (nextUrl) {
    const res = await salesforceRequest(nextUrl, config.accessToken);
    if (!res.ok) throw new Error(`Salesforce query failed (${res.status})`);
    const data = await res.json() as { records: Array<Record<string, unknown>>; nextRecordsUrl?: string };
    for (const record of data.records) {
      yield record;
    }
    nextUrl = data.nextRecordsUrl ? `${config.instanceUrl}${data.nextRecordsUrl}` : "";
  }
}

export async function testSalesforceConnection(config: SalesforceConnectionConfig): Promise<void> {
  const required = ["clientId","clientSecret","redirectUri","instanceUrl","accessToken","refreshToken"] as const;
  for (const key of required) {
    if (!config[key]) throw new Error(`Missing Salesforce config field: ${key}`);
  }
  const res = await salesforceRequest(`${config.instanceUrl}/services/data/v60.0/limits`, config.accessToken, 1);
  if (!res.ok) throw new Error(`Salesforce limits request failed (${res.status})`);
}
