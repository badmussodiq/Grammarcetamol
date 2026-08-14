'use server';

import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000';

export async function toggleStudentStatus(formData: FormData) {
  const id = formData.get('id') as string;
  const status = formData.get('status') as string;
  const accessToken = (await cookies()).get('access_token')?.value;

  try {
    await fetch(`${API_URL}/api/users/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Cookie: `access_token=${accessToken}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
  } catch {
    // Backend unreachable — the list will simply re-render unchanged.
  }

  revalidatePath('/students');
}
