import {apiFetch} from '@grammarcetamol/utilities';

export interface InitializePaymentResult {
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  publicKey: string;
  amount: string;
  currency: string;
}

export interface PaymentStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const checkoutApi = {
  initialize(courseId: string, email?: string) {
    return apiFetch<ApiResponse<InitializePaymentResult>>('/api/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({ courseId, email }),
    });
  },

  confirm(reference: string) {
    return apiFetch<ApiResponse<PaymentStatus>>(`/api/payments/${reference}/confirm`, {
      method: 'POST',
    });
  },
};

/** Paystack expects the amount in the currency's smallest subunit (kobo/cents) — pure so it's
 * testable without loading the actual Paystack script. */
export function toPaystackSubunit(amount: string): number {
  return Math.round(Number(amount) * 100);
}
