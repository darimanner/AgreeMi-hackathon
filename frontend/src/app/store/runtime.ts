const controllers = new Map<string, AbortController>();

export function startRequest(key: string): AbortSignal {
  controllers.get(key)?.abort();
  const controller = new AbortController();
  controllers.set(key, controller);
  return controller.signal;
}

export function finishRequest(key: string, signal: AbortSignal): boolean {
  const current = controllers.get(key);
  if (!current || current.signal !== signal) return false;
  controllers.delete(key);
  return !signal.aborted;
}

export function abortRequest(key: string): void {
  controllers.get(key)?.abort();
  controllers.delete(key);
}
