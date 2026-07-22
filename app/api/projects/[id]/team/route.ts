import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { ProjectTeamRepository, ProjectRepository, NotificationRepository } from '@/lib/repositories';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const body = await request.json();
  const { user_id, user_ids } = body;

  if (!user_id && (!user_ids || !Array.isArray(user_ids))) {
    return NextResponse.json({ error: 'Missing user_id or user_ids' }, { status: 400 });
  }

  try {
    const existing = await ProjectTeamRepository.findByProjectId(projectId);
    const project = await ProjectRepository.findById(projectId);
    const senderName = session.real_name ?? session.name ?? session.email ?? 'Someone';

    if (user_ids && Array.isArray(user_ids)) {
      const existingIds = new Set(existing.map((pt) => pt.user_id));
      const addedMembers = [];
      for (const uid of user_ids) {
        if (existingIds.has(uid)) continue;
        const result = await ProjectTeamRepository.create(projectId, uid, session.real_user_id ?? session.user_id);
        addedMembers.push(result);

        if (uid !== (session.real_user_id ?? session.user_id) && project) {
          await NotificationRepository.create({
            user_id: uid,
            type: 'project_team_added',
            title: 'Assigned to Project',
            content: `${senderName} added you to the project: ${project.project_name}`,
            link: `/projects/${projectId}`
          });
        }
      }
      return NextResponse.json(addedMembers, { status: 201 });
    }

    // Check if already exists (single user fallback)
    if (existing.some((pt) => pt.user_id === user_id)) {
      return NextResponse.json({ error: 'User already in team' }, { status: 409 });
    }

    const result = await ProjectTeamRepository.create(projectId, user_id, session.real_user_id ?? session.user_id);

    if (user_id !== (session.real_user_id ?? session.user_id) && project) {
      await NotificationRepository.create({
        user_id,
        type: 'project_team_added',
        title: 'Assigned to Project',
        content: `${senderName} added you to the project: ${project.project_name}`,
        link: `/projects/${projectId}`
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

  const { id: projectId } = await params;
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  try {
    const existing = await ProjectTeamRepository.findByProjectId(projectId);
    const membership = existing.find((pt) => pt.user_id === user_id);
    if (!membership) {
      return NextResponse.json({ error: 'User not in team' }, { status: 404 });
    }

    await ProjectTeamRepository.softDelete(membership.id, session.real_user_id ?? session.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove team member:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}
