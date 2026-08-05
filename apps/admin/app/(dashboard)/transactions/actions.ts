'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

async function authHeaders(): Promise<Record<string, string>> {
  const accessToken = (await cookies()).get('access_token')?.value;
  return accessToken ? { Cookie: `access_token=${accessToken}` } : {};
}

export interface RefundActionState {
  error: string | null;
}

export async function refundPayment(_prevState: RefundActionState, formData: FormData): Promise<RefundActionState> {
  const id = formData.get('id') as string;
  const amount = formData.get('amount') as string;
  const reason = formData.get('reason') as string;

  if (!reason?.trim()) {
    return { error: 'A reason is required.' };
  }
  if (!amount || Number(amount) <= 0) {
    return { error: 'Enter a valid refund amount.' };
  }

  try {
    const res = await fetch(`${API_URL}/api/payments/${id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ amount: Number(amount), reason: reason.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { error: body?.error ?? 'Refund failed.' };
    }
  } catch {
    return { error: 'Could not reach the payment service.' };
  }

  revalidatePath('/transactions');
  return { error: null };
}
