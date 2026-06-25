import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/session';
import { createSession, getCookieName } from '@/lib/auth';
import { UserRepository } from '@/lib/repositories';

const SUPER_USER_EMAIL = 'gadmin@multidayamitra.co.id';

function isSU(email: string) {
  return email.toLowerCase().trim() === SUPER_USER_EMAIL;
}

function isCOSU(occ: string | null | undefined) {
  if (!occ) return false;
  const o = occ.toLowerCase().trim();
  return o === "co - super user" || o === "co-super-user";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the real user to check true privileges
    const realUserId = session.real_user_id ?? session.user_id;
    const realUser = await UserRepository.findById(realUserId);
    if (!realUser) {
      return NextResponse.json({ error: 'Real user not found' }, { status: 401 });
    }

    const realEmail = realUser.user_email;
    const realOcc = realUser.user_occupation;

    const callerIsSU = isSU(realEmail);
    const callerIsCOSU = isCOSU(realOcc);

    // Only Super User and Co-Super Users can impersonate
    if (!callerIsSU && !callerIsCOSU) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
    }

    const targetUser = await UserRepository.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Co-Super User cannot impersonate the Super User
    if (callerIsCOSU && isSU(targetUser.user_email)) {
      return NextResponse.json({ error: 'Co-Super Users are not permitted to impersonate the Super User' }, { status: 403 });
    }

    // Keep the real user details as the anchor, but impersonate the target user
    const sessionToken = await createSession({
      email: targetUser.user_email,
      name: targetUser.user_name || targetUser.user_email,
      picture: session.picture, // keep original picture if any
      user_id: targetUser.user_id,
      user_occupation: targetUser.user_occupation,
      user_division: targetUser.user_division,
      user_departement: targetUser.user_departement,
      user_site: targetUser.user_site,
      user_team: targetUser.user_team,
      user_unit: targetUser.user_unit,
      real_user_id: realUserId,
      real_email: realEmail,
      real_name: realUser.user_name || realEmail,
    });

    const cookieStore = await cookies();
    cookieStore.set(getCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return NextResponse.json({ success: true, user: targetUser });
  } catch (error) {
    console.error('POST /api/impersonate error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow stopping if currently impersonating
    if (!session.real_email || !session.real_user_id) {
      return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 });
    }

    // Fetch original real user
    const realUser = await UserRepository.findById(session.real_user_id);
    if (!realUser) {
      return NextResponse.json({ error: 'Real User profile not found' }, { status: 500 });
    }

    const realEmail = realUser.user_email;
    const realOcc = realUser.user_occupation;

    // Only Super User and Co-Super Users can restore
    if (!isSU(realEmail) && !isCOSU(realOcc)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Restore original real user session
    const sessionToken = await createSession({
      email: realUser.user_email,
      name: realUser.user_name || realUser.user_email,
      picture: session.picture,
      user_id: realUser.user_id,
      user_occupation: realUser.user_occupation,
      user_division: realUser.user_division,
      user_departement: realUser.user_departement,
      user_site: realUser.user_site,
      user_team: realUser.user_team,
      user_unit: realUser.user_unit,
    });

    const cookieStore = await cookies();
    cookieStore.set(getCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/impersonate error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
