export interface Payment {
  id: string;
  userId: string;
  courseId: string | null;
  serviceRequestId: string | null;
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  paymentMethod: string;
  gateway: string;
  gatewayRef: string | null;
  description: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: string;
  currency: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processedBy: string | null;
  processedAt: string | null;
  gatewayRef: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRow {
  id: string;
  user_id: string;
  course_id: string | null;
  service_request_id: string | null;
  amount: string;
  currency: string;
  status: string;
  payment_method: string;
  gateway: string;
  gateway_ref: string | null;
  description: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface RefundRow {
  id: string;
  payment_id: string;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  processed_by: string | null;
  processed_at: string | null;
  gateway_ref: string | null;
  created_at: string;
  updated_at: string;
}

export function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    serviceRequestId: row.service_request_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status as Payment['status'],
    paymentMethod: row.payment_method,
    gateway: row.gateway,
    gatewayRef: row.gateway_ref,
    description: row.description,
    paidAt: row.paid_at,
    failedAt: row.failed_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRefundRow(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentId: row.payment_id,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    status: row.status as Refund['status'],
    processedBy: row.processed_by,
    processedAt: row.processed_at,
    gatewayRef: row.gateway_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
