import { API_BASE_URL, AUTH_MODE, REQUEST_TIMEOUT_MS } from './config';
import { ignoreErrors } from '../lib/ignoreErrors';

export type FailureKind = 'NO ROUTE' | 'NO RESPONSE' | 'REFUSED' | 'TIMED OUT' | 'NOT FOUND' | 'SERVER ERROR' | 'BAD REPLY';

export class ApiError extends Error {
  readonly status: number;
  readonly kind: FailureKind;
  readonly body: unknown;
  constructor(kind: FailureKind, status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

const TOKEN_KEY = 'enerops-token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null): void {
  ignoreErrors(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  });
}

export const UNAUTHORIZED_EVENT = 'enerops:unauthorized';

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  skipAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) { if (v.length) qs.set(k, v.join(',')); }
    else qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? url + (url.includes('?') ? '&' : '?') + s : url;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (AUTH_MODE === 'bearer') {
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }

  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, REQUEST_TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method || 'GET',
      headers,
      body,
      signal: ctl.signal,
      credentials: AUTH_MODE === 'cookie' ? 'include' : 'same-origin',
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    if (timedOut) throw new ApiError('TIMED OUT', 0, 'The server did not answer in time.');
    throw new ApiError('NO ROUTE', 0, 'The server could not be reached.');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { if (res.ok) throw new ApiError('BAD REPLY', res.status, 'The server answered with something that is not JSON.'); }
  }

  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string')
      ? (data as { message: string }).message
      : res.statusText || 'Request failed';
    if (res.status === 401 && !opts.skipAuthRedirect) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const kind: FailureKind = res.status === 401 || res.status === 403 ? 'REFUSED'
      : res.status === 404 ? 'NOT FOUND'
      : res.status >= 500 ? 'SERVER ERROR'
      : 'REFUSED';
    throw new ApiError(kind, res.status, msg, data);
  }
  return data as T;
}
