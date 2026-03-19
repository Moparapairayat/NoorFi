type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
  timeoutMs?: number;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
};

type JsonRecord = Record<string, unknown>;

let accessToken: string | null = null;
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_CACHE_ENTRIES = 200;

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function setAccessToken(token: string | null): void {
  const changed = accessToken !== token;
  accessToken = token;
  if (changed) {
    clearApiCache();
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearApiCache(pathPrefix?: string): void {
  if (!pathPrefix || pathPrefix.trim().length === 0) {
    responseCache.clear();
    inFlightRequests.clear();
    return;
  }

  const normalizedPrefix = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;

  for (const key of responseCache.keys()) {
    if (key.includes(normalizedPrefix)) {
      responseCache.delete(key);
    }
  }

  for (const key of inFlightRequests.keys()) {
    if (key.includes(normalizedPrefix)) {
      inFlightRequests.delete(key);
    }
  }
}

function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/+$/, '');
  }

  return 'http://127.0.0.1:8000/api';
}

function makeCacheKey(url: string, method: string, authenticated: boolean): string {
  const scope = authenticated ? `auth:${accessToken ?? 'guest'}` : 'public';
  return `${method}|${scope}|${url}`;
}

function setCacheEntry(key: string, data: unknown, cacheTtlMs: number): void {
  if (cacheTtlMs <= 0) {
    return;
  }

  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (typeof oldestKey === 'string') {
      responseCache.delete(oldestKey);
    }
  }

  responseCache.set(key, {
    expiresAt: Date.now() + cacheTtlMs,
    data,
  });
}

function getValidCacheEntry<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return cached.data as T;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const json = payload as JsonRecord;

  if (typeof json.message === 'string' && json.message.trim().length > 0) {
    return json.message;
  }

  const errors = json.errors;
  if (errors && typeof errors === 'object') {
    const firstError = Object.values(errors as JsonRecord)[0];
    if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
      return firstError[0];
    }
    if (typeof firstError === 'string') {
      return firstError;
    }
  }

  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const authenticated = options.authenticated ?? true;
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 0);
  const url = `${resolveBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const canDedupe = method === 'GET' && options.body === undefined;
  const canUseCache = canDedupe && cacheTtlMs > 0;
  const cacheKey = makeCacheKey(url, method, authenticated);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (authenticated && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (canUseCache && !options.forceRefresh) {
    const cached = getValidCacheEntry<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  if (canDedupe && !options.forceRefresh) {
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const requestPromise = (async (): Promise<T> => {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }

      throw new Error(
        'Unable to connect to backend. Set EXPO_PUBLIC_API_BASE_URL to your PC IP, then restart Expo.'
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

    const raw = await response.text();
    let payload: unknown = null;
    if (raw.length > 0) {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        payload = raw;
      }
    }

    if (!response.ok) {
      throw new ApiError(
        extractMessage(payload, `Request failed with status ${response.status}`),
        response.status,
        payload
      );
    }

    if (canUseCache) {
      setCacheEntry(cacheKey, payload, cacheTtlMs);
    }

    return payload as T;
  })();

  if (canDedupe) {
    inFlightRequests.set(cacheKey, requestPromise as Promise<unknown>);
  }

  try {
    return await requestPromise;
  } finally {
    if (canDedupe) {
      inFlightRequests.delete(cacheKey);
    }
  }
}
