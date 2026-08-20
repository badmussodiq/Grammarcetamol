export interface Subscription {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  planCode: string;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  paystackEmailToken: string | null;
  status: 'pending' | 'active' | 'payment_failed' | 'past_due' | 'cancelled' | 'expired';
  amount: string;
  currency: string;
  interval: string;
  gatewayRef: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  item_type: string;
  item_id: string;
  plan_code: string;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
  paystack_email_token: string | null;
  status: string;
  amount: string;
  currency: string;
  interval: string;
  gateway_ref: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapSubscriptionRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    itemType: row.item_type,
    itemId: row.item_id,
    planCode: row.plan_code,
    paystackCustomerCode: row.paystack_customer_code,
    paystackSubscriptionCode: row.paystack_subscription_code,
    paystackEmailToken: row.paystack_email_token,
    status: row.status as Subscription['status'],
    amount: row.amount,
    currency: row.currency,
    interval: row.interval,
    gatewayRef: row.gateway_ref,
    currentPeriodEnd: row.current_period_end,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
