import type { WaitlistSignup } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.waitlist);

/**
 * Chave do documento = e-mail normalizado, não um ID aleatório — o
 * `.create()` do Firestore falha com ALREADY_EXISTS em vez de duplicar o
 * cadastro, dando idempotência gratuita sem precisar de leitura-antes.
 */
function docIdForEmail(email: string): string {
  return Buffer.from(email.toLowerCase().trim()).toString('base64url');
}

export async function addWaitlistSignup(email: string): Promise<{ created: boolean }> {
  const normalized = email.toLowerCase().trim();
  const signup: WaitlistSignup = {
    id: docIdForEmail(normalized),
    email: normalized,
    createdAt: new Date().toISOString(),
  };
  try {
    await collection().doc(signup.id).create(signup);
    return { created: true };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 6 /* ALREADY_EXISTS */) {
      return { created: false };
    }
    throw error;
  }
}
