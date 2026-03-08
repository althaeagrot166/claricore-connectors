# Connector SDK (V6)

## Salesforce connector modules
- `src/auth`: OAuth URL builder, auth-code exchange, token refresh.
- `src/extractors`: paginated SOQL extraction + retry handling.
- `src/schemas`: static schema discovery for Account/Contact.
- `src/webhooks`: signature verification stub.
- `src/transformers`: canonicalization helper.

## OAuth flow
1. Build authorize URL with `buildAuthorizationUrl`.
2. Exchange callback code via `exchangeAuthCodeForToken`.
3. Persist `accessToken`, `refreshToken`, `instanceUrl` in encrypted connection secrets.
4. Refresh on expiry via `refreshAccessToken`.
