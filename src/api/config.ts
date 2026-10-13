export type AuthMode = 'bearer' | 'cookie';

const env = import.meta.env;

export const API_BASE_URL: string = String(env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export const AUTH_MODE: AuthMode = env.VITE_AUTH_MODE === 'cookie' ? 'cookie' : 'bearer';

export const REQUEST_TIMEOUT_MS = 20000;
