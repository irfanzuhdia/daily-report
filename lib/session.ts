import { cookies } from 'next/headers';
import { verifySession, getCookieName } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName())?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getUserFromSession(): Promise<SessionPayload | null> {
  return getSession();
}
