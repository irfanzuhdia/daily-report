import { cookies } from 'next/headers';
import { verifySession, getCookieName, SESSION_MAX_AGE } from '@/lib/auth';
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

  // Sliding session: refresh cookie maxAge on active requests so active users stay logged in
  try {
    cookieStore.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });
  } catch {
    // Ignore if cookies cannot be modified in immutable Server Component renders
  }

  return session;
}

export async function getUserFromSession(): Promise<SessionPayload | null> {
  return getSession();
}
