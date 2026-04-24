function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;

if (!apiUrl) {
  throw new Error('Missing VITE_API_URL environment variable');
}

export const API_BASE_URL = normalizeBaseUrl(apiUrl);
export const WS_BASE_URL = normalizeBaseUrl(wsUrl || apiUrl);
