import { cookies } from 'next/headers';
import { verifySession, getCookieName } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';
import { UserRepository } from '@/lib/repositories/user-repository';

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName())?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  // Safeguard: If user_id is an email or invalid format, resolve to actual U-XXXX user_id
  if (session.user_id && (session.user_id.includes('@') || !session.user_id.startsWith('U-'))) {
    try {
      const dbUser = await UserRepository.findByEmail(session.email || session.user_id);
      if (dbUser) {
        session.user_id = dbUser.user_id;
      }
    } catch (e) {
      console.error('Failed to resolve session user_id:', e);
    }
  }

  return session;
}

export async function getUserFromSession(): Promise<SessionPayload | null> {
  return getSession();
}
