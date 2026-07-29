import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Config pública do projeto Firebase (lista-ai-f2916) — não é secreta, é
// destinada a rodar no navegador. Segurança real vem das regras do
// Firestore e da validação do ID Token no backend.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'lista-ai-f2916.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'lista-ai-f2916',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicializa só no navegador. No servidor (build/SSR do Next.js) essas
// credenciais ainda não existem no ambiente — e não fazem falta, já que
// toda a lógica de auth roda em componentes client-side, após a hidratação.
function initClient(): { app: FirebaseApp; authInstance: Auth } | null {
  if (typeof window === 'undefined') return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app, authInstance: getAuth(app) };
}

const client = initClient();

export const firebaseApp = client?.app as FirebaseApp;
export const auth = client?.authInstance as Auth;
