import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, getCookieName, SESSION_MAX_AGE } from '@/lib/auth';
import { UserRepository } from '@/lib/repositories';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
export async function GET(request: NextRequest) {
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/callback`;
  
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    // Step 1: Redirect to Google OAuth consent screen
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // Step 2: Handle callback - exchange code for tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error('Google token exchange failed:', tokenRes.status, errText);
      return NextResponse.redirect(new URL('/login?error=token', request.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      logger.error('Google userinfo failed:', userRes.status, errText);
      return NextResponse.redirect(new URL('/login?error=userinfo', request.url));
    }

    const googleUser = await userRes.json();
    const email = googleUser.email;

    // Check if user exists in spreadsheet
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    // Create session
    const sessionToken = await createSession({
      email: user.user_email,
      name: user.user_name || email,
      picture: googleUser.picture,
      user_id: user.user_id,
      user_occupation: user.user_occupation,
      user_division: user.user_division,
      user_departement: user.user_departement,
      user_site: user.user_site,
      user_team: user.user_team,
      user_unit: user.user_unit,
    });

    // Set cookie and redirect
    const cookieStore = await cookies();
    cookieStore.set(getCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE, // 30 Days
      path: '/',
    });

    return NextResponse.redirect(new URL('/reports/dashboard', request.url));
  } catch (error) {
    logger.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=server', request.url));
  }
}
