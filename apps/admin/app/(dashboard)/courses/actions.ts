'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

async function authHeaders(): Promise<Record<string, string>> {
  const accessToken = (await cookies()).get('access_token')?.value;
  return accessToken ? { Cookie: `access_token=${accessToken}` } : {};
}

export async function archiveCourse(formData: FormData) {
  const id = formData.get('id') as string;
  try {
    await fetch(`${API_URL}/api/courses/${id}/archive`, { method: 'POST', headers: await authHeaders() });
  } catch {
    // Backend unreachable — the list will simply re-render unchanged.
  }
  revalidatePath('/courses');
}

export async function deleteCourse(formData: FormData) {
  const id = formData.get('id') as string;
  try {
    await fetch(`${API_URL}/api/courses/${id}`, { method: 'DELETE', headers: await authHeaders() });
  } catch {
    // Backend unreachable — the list will simply re-render unchanged.
  }
  revalidatePath('/courses');
}
