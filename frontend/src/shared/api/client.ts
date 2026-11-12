import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL } from './config';
import { ApiError } from './errors';
import { getAccessToken, getOpenRouterKey } from './storage';

type ApiQuery = Record<string, string | number | undefined>;
type ApiRequestConfig = AxiosRequestConfig & { query?: ApiQuery };
type ErrorBody = {
  detail?: unknown;
  message?: unknown;
};

function getBrowserBaseUrl(): string {
  if (API_BASE_URL.startsWith('http')) return API_BASE_URL;
  return `${window.location.origin}${API_BASE_URL}`;
}

function cleanQuery(query?: ApiQuery): Record<string, string | number> | undefined {
  if (!query) return undefined;

  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params[key] = value;
    }
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

function getErrorMessageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;

  const { detail, message } = body as ErrorBody;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError('Request cancelled', 0, error);
  }

  if (axios.isAxiosError(error)) {
    const response = error.response;
    const status = response?.status ?? 0;
    const fallback = response?.statusText || error.message || 'Request failed';
    const message = getErrorMessageFromBody(response?.data, fallback);

    return new ApiError(message, status, response?.data ?? error);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 0, error);
  }

  return new ApiError('Request failed', 0, error);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const openRouterKey = getOpenRouterKey();
  if (openRouterKey) {
    config.headers['X-OpenRouter-Key'] = openRouterKey;
  }
  return config;
});

function unwrapResponse<T>(response: AxiosResponse<T>): T {
  return response.data;
}

export async function apiRequest<T>(
  path: string,
  config: ApiRequestConfig = {}
): Promise<T> {
  const { query, ...axiosConfig } = config;

  try {
    const response = await apiClient.request<T>({
      ...axiosConfig,
      url: path,
      params: cleanQuery(query),
    });
    return unwrapResponse(response);
  } catch (error) {
    throw toApiError(error);
  }
}

export function buildApiUrl(path: string, query?: ApiQuery): string {
  const url = new URL(path.replace(/^\/+/, ''), `${getBrowserBaseUrl()}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function pingApiServer(signal?: AbortSignal): Promise<number> {
  const startedAt = performance.now();
  await apiClient.get('/openapi.json', {
    signal,
    headers: { 'Cache-Control': 'no-store' },
  });
  return Math.round(performance.now() - startedAt);
}
