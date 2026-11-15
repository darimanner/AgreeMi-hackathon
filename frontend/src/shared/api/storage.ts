const ACCESS_TOKEN_KEY = 'reqlens-access-token';
const OPENROUTER_KEY = 'reqlens-openrouter-key';

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getOpenRouterKey(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(OPENROUTER_KEY);
}

export function setOpenRouterKey(key: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(OPENROUTER_KEY, key);
}

export function clearOpenRouterKey(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(OPENROUTER_KEY);
}
