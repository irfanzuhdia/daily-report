import { SignJWT, jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing. This is required for secure session signing.")
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = 'dr_session';

export interface SessionPayload {
  email: string;
  name: string;
  picture?: string;
  user_id: string;
  user_occupation: string | null;
  user_division: string | null;
  user_departement: string | null;
  user_site: string | null;
  user_team: string | null;
  user_unit: string | null;
  exp: number;
  real_user_id?: string;
  real_email?: string;
  real_name?: string;
}

export async function createSession(payload: Omit<SessionPayload, 'exp'>): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function getCookieName() {
  return COOKIE_NAME;
}
