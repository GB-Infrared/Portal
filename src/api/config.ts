/* Everything about WHERE the backend is and HOW it is spoken to, in one place.
   Values come from the build environment (see .env.example), so the same build
   can be pointed at a staging or a production backend without touching code. */

export type AuthMode = 'bearer' | 'cookie';

const env = import.meta.env;

/** Base of every API path. A path ("/api") is relative to the site the portal
 *  is served from; a full URL calls that host directly. No trailing slash. */
export const API_BASE_URL: string = String(env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

/** bearer: login returns a token, sent as "Authorization: Bearer <token>".
 *  cookie: login sets a session cookie, and requests go with credentials. */
export const AUTH_MODE: AuthMode = env.VITE_AUTH_MODE === 'cookie' ? 'cookie' : 'bearer';

/** A request that has not answered in this long is reported as TIMED OUT
 *  rather than left spinning. */
export const REQUEST_TIMEOUT_MS = 20000;
