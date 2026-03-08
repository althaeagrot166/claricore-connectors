export function toCanonicalSalesforce(record: Record<string, unknown>) {
  return { ...record, source: "salesforce" };
}
