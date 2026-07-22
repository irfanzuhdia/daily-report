import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { TaskTeamRepository, TaskRepository, NotificationRepository } from '@/lib/repositories';

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
  const { user_id, user_ids } = body;

  if (!user_id && (!user_ids || !Array.isArray(user_ids))) {
    return NextResponse.json({ error: 'Missing user_id or user_ids' }, { status: 400 });
  }

  try {
    const existing = await TaskTeamRepository.findByTaskId(taskId);
    const task = await TaskRepository.findById(taskId);
    const senderName = session.real_name ?? session.name ?? session.email ?? 'Someone';

    if (user_ids && Array.isArray(user_ids)) {
      const existingIds = new Set(existing.map((tt) => tt.user_id));
      const addedMembers = [];
      const desc = task?.task_description || '';
      const truncatedDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;

      for (const uid of user_ids) {
        if (existingIds.has(uid)) continue;
        const result = await TaskTeamRepository.create(taskId, uid, session.real_user_id ?? session.user_id);
        addedMembers.push(result);

        if (uid !== (session.real_user_id ?? session.user_id) && task) {
          await NotificationRepository.create({
            user_id: uid,
            type: 'task_team_added',
            title: 'Assigned to Task',
            content: `${senderName} assigned you to the task: "${truncatedDesc}"`,
            link: `/tasks/${taskId}`
          });
        }
      }
      return NextResponse.json(addedMembers, { status: 201 });
    }

    // Check if already exists (single user fallback)
    if (existing.some((tt) => tt.user_id === user_id)) {
      return NextResponse.json({ error: 'User already in team' }, { status: 409 });
    }

    const result = await TaskTeamRepository.create(taskId, user_id, session.real_user_id ?? session.user_id);

    if (user_id !== (session.real_user_id ?? session.user_id) && task) {
      const desc = task.task_description || '';
      const truncatedDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
      await NotificationRepository.create({
        user_id,
        type: 'task_team_added',
        title: 'Assigned to Task',
        content: `${senderName} assigned you to the task: "${truncatedDesc}"`,
        link: `/tasks/${taskId}`
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error('Failed to add team member:', error);
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

    await TaskTeamRepository.softDelete(membership.id, session.real_user_id ?? session.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove team member:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}
