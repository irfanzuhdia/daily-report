import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  TaskRepository,
  TaskTeamRepository,
  ProjectRepository,
  ProjectTeamRepository,
  DailyReportRepository,
  hasTaskWritePermission,
} from '@/lib/repositories'

async function checkTaskPermission(taskId: string, userId: string) {
  const task = await TaskRepository.findById(taskId)
  if (!task) return { error: 'Not found', status: 404 }

  const hasWrite = await hasTaskWritePermission(taskId, userId)
  if (!hasWrite) {
    return { error: 'Forbidden', status: 403 }
  }

  return { task }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const permission = await checkTaskPermission(id, session.user_id)
    if (permission.error) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    const body = await request.json()
    const { task_user_ids, ...taskData } = body

    const updatedTask = await TaskRepository.update(id, taskData, session.real_user_id ?? session.user_id)
    if (!updatedTask) {
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
          await TaskTeamRepository.softDelete(tt.id, session.real_user_id ?? session.user_id)
        }
      }

      // Add new users
      for (const userId of task_user_ids || []) {
        if (!currentUserIds.has(userId)) {
          await TaskTeamRepository.create(id, userId, session.real_user_id ?? session.user_id)
        }
      }
    }

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error('PUT /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const permission = await checkTaskPermission(id, session.user_id)
    if (permission.error) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    // Prevent deletion if task has reports
    const reports = await DailyReportRepository.findByTaskId(id)
    if (reports && reports.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete task because it has associated reports.' },
        { status: 400 }
      )
    }

    await TaskRepository.softDelete(id, session.real_user_id ?? session.user_id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

