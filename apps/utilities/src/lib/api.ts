const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  /** The parsed error response body, when the server returned one (e.g. { data: [...] } for structured validation errors). */
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function refreshTokens(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.ok;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshTokens();
    if (refreshed) return apiFetch<T>(path, options, false);
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    let message = 'An error occurred';
    let body: unknown;
    try {
      body = await res.json();
      message = (body as any)?.error ?? (body as any)?.message ?? message;
    } catch {}
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
