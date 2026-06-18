import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { TaskRepository, TaskTeamRepository } from '@/lib/repositories'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const task = await TaskRepository.findById(id)
  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(task)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { task_user_ids, ...taskData } = body

  const task = await TaskRepository.update(id, taskData, session.user_id)
  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Update TaskTeam: remove old, add new
  if (task_user_ids !== undefined) {
    const currentTeam = await TaskTeamRepository.findByTaskId(id)
    const currentUserIds = new Set(currentTeam.map((tt) => tt.user_id))
    const newUserIds = new Set(task_user_ids || [])

    // Remove users no longer in team
    for (const tt of currentTeam) {
      if (!newUserIds.has(tt.user_id)) {
        await TaskTeamRepository.softDelete(tt.id, session.user_id)
      }
    }

    // Add new users
    for (const userId of task_user_ids || []) {
      if (!currentUserIds.has(userId)) {
        await TaskTeamRepository.create(id, userId, session.user_id)
      }
    }
  }

  return NextResponse.json(task)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const success = await TaskRepository.softDelete(id, session.user_id)
  if (!success) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
