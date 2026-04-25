import { API_BASE_URL } from './config';
import { ApiError } from './errors';
import { getAccessToken } from './storage';

type JsonRecord = Record<string, unknown>;

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const baseUrl = API_BASE_URL.startsWith('http')
    ? `${API_BASE_URL}/`
    : `${window.location.origin}${API_BASE_URL}/`;
  const url = new URL(path.replace(/^\/+/, ''), baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => null);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await readErrorBody(response);
    let message = response.statusText || 'Request failed';
    if (body && typeof body === 'object') {
      const detail = (body as JsonRecord).detail;
      const bodyMessage = (body as JsonRecord).message;
      if (typeof detail === 'string' && detail.trim()) {
        message = detail;
      } else if (typeof bodyMessage === 'string' && bodyMessage.trim()) {
        message = bodyMessage;
      }
    }
    throw new ApiError(message, response.status, body);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return response.text() as Promise<T>;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const { query, headers, signal, ...rest } = options;
  const token = getAccessToken();
  const hasBody = rest.body !== undefined && rest.body !== null;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    signal,
    headers: {
      ...(hasBody && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  return parseResponse<T>(response);
}

export function buildApiUrl(path: string, query?: Record<string, string | number | undefined>): string {
  return buildUrl(path, query);
}

export async function pingApiServer(signal?: AbortSignal): Promise<number> {
  const startedAt = performance.now();
  await fetch(buildUrl('/openapi.json'), {
    cache: 'no-store',
    signal,
  });
  return Math.round(performance.now() - startedAt);
}
