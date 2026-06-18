import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { TaskTeamRepository } from '@/lib/repositories';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: taskId } = await params;
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  try {
    const existing = await TaskTeamRepository.findByTaskId(taskId);
    if (existing.some((tt) => tt.user_id === user_id)) {
      return NextResponse.json({ error: 'User already in team' }, { status: 409 });
    }

    const result = await TaskTeamRepository.create(taskId, user_id, session.user_id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to add team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: taskId } = await params;
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  try {
    const existing = await TaskTeamRepository.findByTaskId(taskId);
    const membership = existing.find((tt) => tt.user_id === user_id);
    if (!membership) {
      return NextResponse.json({ error: 'User not in team' }, { status: 404 });
    }

    await TaskTeamRepository.softDelete(membership.id, session.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove team member:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}
