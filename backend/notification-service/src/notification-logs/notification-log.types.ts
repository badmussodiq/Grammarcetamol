/** One row per send attempt, written regardless of outcome — this is an audit trail, not a
 * queue or an inbox, so it's append-only: no update/delete endpoint exists anywhere on this
 * collection, on purpose. */
export interface NotificationLog {
  /** The publishing service's own name (from the event payload's `service` field), e.g.
   * "auth-service" — not this service's own name, which would be redundant on every row. */
  service: string;
  templateName: string;
  to: string;
  toName: string;
  status: 'sent' | 'failed';
  /** Set only when status is 'failed' — the EmailProvider's own error, or "no such template"
   * if templateName didn't resolve, or "template is inactive" if an admin turned it off. */
  error: string | null;
  providerMessageId: string | null;
  createdAt: Date;
}
