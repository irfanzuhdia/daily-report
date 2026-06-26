import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  ProjectRepository,
  ProjectTeamRepository,
  TaskRepository,
  DailyReportRepository,
  hasProjectWritePermission,
} from '@/lib/repositories'

async function checkProjectPermission(projectId: string, userId: string) {
  const project = await ProjectRepository.findById(projectId)
  if (!project) return { error: 'Not found', status: 404 }

  const hasWrite = await hasProjectWritePermission(projectId, userId)
  if (!hasWrite) {
    return { error: 'Forbidden', status: 403 }
  }

  return { project }
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
    const project = await ProjectRepository.findById(id)
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(project)
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
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
    const permission = await checkProjectPermission(id, session.user_id)
    if (permission.error) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    const body = await request.json()
    const { team_user_ids, ...projectData } = body

    const updatedProject = await ProjectRepository.update(id, projectData, session.real_user_id ?? session.user_id)
    if (!updatedProject) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Update ProjectTeam: remove old, add new
    if (team_user_ids !== undefined) {
      const currentTeam = await ProjectTeamRepository.findByProjectId(id)
      const currentUserIds = new Set(currentTeam.map((pt) => pt.user_id))
      const newUserIds = new Set(team_user_ids || [])

      // Remove users no longer in team
      for (const pt of currentTeam) {
        if (!newUserIds.has(pt.user_id)) {
          await ProjectTeamRepository.softDelete(pt.id, session.real_user_id ?? session.user_id)
        }
      }

      // Add new users
      for (const userId of team_user_ids || []) {
        if (!currentUserIds.has(userId)) {
          await ProjectTeamRepository.create(id, userId, session.real_user_id ?? session.user_id)
        }
      }
    }

    return NextResponse.json(updatedProject)
  } catch (error: any) {
    console.error('PUT /api/projects/[id] error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.message ? 400 : 500 }
    )
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
    const permission = await checkProjectPermission(id, session.user_id)
    if (permission.error) {
      return NextResponse.json({ error: permission.error }, { status: permission.status })
    }

    // Prevent deletion if project has any task with daily reports
    const tasks = await TaskRepository.findByProjectId(id)
    for (const task of tasks) {
      const reports = await DailyReportRepository.findByTaskId(task.id)
      if (reports && reports.length > 0) {
        return NextResponse.json(
          { error: 'Cannot delete project because it has tasks with associated reports.' },
          { status: 400 }
        )
      }
    }

    await ProjectRepository.softDelete(id, session.real_user_id ?? session.user_id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

