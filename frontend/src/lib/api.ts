/**
 * Tiny fetch wrapper around the NestJS API.
 * - Adds the JWT stored at login.
 * - Turns API errors into `Error(message)` so pages can show them directly.
 */
/**
 * API base URL. When NEXT_PUBLIC_API_URL isn't set (local dev), use the same
 * host the page was opened from, on port 4001 — so the app also works from a
 * phone on the same Wi-Fi (http://<mac-ip>:4000 → http://<mac-ip>:4001).
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4001` : 'http://localhost:4001');
const TOKEN_KEY = 'holydo_token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Slow-response signal (audit H3): when the API takes more than 3.5 s — e.g.
 * the free Render server waking up — the page shows "Le service se réveille…"
 * (see components/WakeNotice.tsx) instead of looking frozen.
 */
let slowCount = 0;
const SLOW_MS = 3500;
function emitSlow(delta: 1 | -1) {
  slowCount = Math.max(0, slowCount + delta);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('holydjo:slow', { detail: slowCount }));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let flagged = false;
  const timer = setTimeout(() => {
    flagged = true;
    emitSlow(1);
  }, SLOW_MS);
  try {
    return await doRequest<T>(path, init);
  } finally {
    clearTimeout(timer);
    if (flagged) emitSlow(-1);
  }
}

async function doRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // class-validator returns an array of messages; show the first one.
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(msg ?? `Erreur ${res.status}`);
  }
  // NestJS sends an empty body when a handler returns null (e.g. no profile yet).
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(p: string, body: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown) => request<T>(p, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T>(p: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>(p, { method: 'POST', body: fd });
  },
};

/** Uploaded files live on the API (/uploads/…); demo images live in /public. */
export function mediaUrl(url?: string | null) {
  if (!url) return null;
  return url.startsWith('/uploads/') ? `${API_URL}${url}` : url;
}
