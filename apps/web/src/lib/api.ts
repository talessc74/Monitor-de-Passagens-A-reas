import { auth } from './firebase';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const idToken = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...init, headers });
}
