import { ConnectorConfig, ConnectorHealth, ExtractContext, SourceConnector, StreamConnector, TestConnectionResult } from "@claricore/core";
import { exchangeAuthCodeForToken, refreshAccessToken, buildAuthorizationUrl, type SalesforceConnectionConfig } from "./auth/oauth";
import { extractAccountsAndContacts, testSalesforceConnection } from "./extractors/account-contact";
import { salesforceSchemas } from "./schemas";
import { verifySalesforceWebhookSignature } from "./webhooks";

export * from "./auth/oauth";
export * from "./webhooks";

export class SalesforceConnector implements SourceConnector, StreamConnector {
  id = "salesforce";
  name = "Salesforce";
  version = "0.6.0";

  async healthCheck(): Promise<ConnectorHealth> { return { ok: true, message: "Salesforce healthy" }; }

  private parseConfig(config: ConnectorConfig): SalesforceConnectionConfig {
    return (config.credentials ?? {}) as unknown as SalesforceConnectionConfig;
  }

  async testConnection(config: ConnectorConfig): Promise<TestConnectionResult> {
    try {
      await testSalesforceConnection(this.parseConfig(config));
      return { ok: true, message: "Salesforce connection validated" };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unknown Salesforce test error" };
    }
  }

  async discoverSchema() { return salesforceSchemas; }

  async *extract(ctx: ExtractContext): AsyncGenerator<Record<string, unknown>> {
    const config = ctx.config as SalesforceConnectionConfig;
    yield* extractAccountsAndContacts(ctx, config);
  }

  async subscribe(): Promise<void> { return; }
  async handleWebhook(payload: unknown): Promise<void> { console.log("Received Salesforce webhook", payload); }

  oauth = { buildAuthorizationUrl, exchangeAuthCodeForToken, refreshAccessToken, verifySalesforceWebhookSignature };
}
