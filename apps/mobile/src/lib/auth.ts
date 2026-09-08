import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL } from './config';

const TOKEN_KEY = 'bv.session.token';
const DEVICE_KEY = 'bv.device.id';

export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_KEY, id);
  }
  return id;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export interface DriverSession {
  userId: string;
  name: string;
  driverId?: string;
}

/** Email/password sign-in against the same Better Auth backend the dashboard uses. */
export async function signIn(email: string, password: string): Promise<DriverSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Sign in failed');
  }
  const setCookie = res.headers.get('set-auth-token') ?? res.headers.get('authorization');
  const data = await res.json();
  const token = setCookie ?? data.token;
  if (!token) throw new Error('No session token returned');
  await setToken(token);
  return { userId: data.user.id, name: data.user.name };
}

export async function signOut() {
  await setToken(null);
}

/** Authenticated fetch. Adds Bearer token + device id headers. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const [token, deviceId] = await Promise.all([getToken(), getDeviceId()]);
  const headers = new Headers(init.headers);
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('x-device-id', deviceId);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
