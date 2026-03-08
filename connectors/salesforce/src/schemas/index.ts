import type { SchemaDefinition } from "@claricore/core";

export const salesforceSchemas: SchemaDefinition[] = [
  { resource: "Account", fields: [
    { name: "Id", type: "string", required: true },
    { name: "Name", type: "string", required: true },
    { name: "LastModifiedDate", type: "datetime" }
  ] },
  { resource: "Contact", fields: [
    { name: "Id", type: "string", required: true },
    { name: "AccountId", type: "string" },
    { name: "Email", type: "string" },
    { name: "LastModifiedDate", type: "datetime" }
  ] }
];
