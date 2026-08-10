/** Two states only: open -> closed. No "in_progress", no reply/response field — the admin
 * replies via their own email client, not through the platform. See PLAN.md's resolved decision
 * on Support scope: this is deliberately thin, not the Phase 5 Service Request Catalog. */
export interface SupportTicket {
  name: string;
  email: string;
  /** Set when the submitter was logged in at submission time; null for a guest. */
  userId: string | null;
  subject: string;
  message: string;
  courseId: string | null;
  status: 'open' | 'closed';
  closedBy: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
