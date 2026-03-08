export interface Checkpoint {
  orgId: string;
  connectionId: string;
  resource: string;
  cursor?: string | null;
  updatedAt?: string | null;
}
