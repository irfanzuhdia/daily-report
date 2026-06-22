import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  ProjectRepository,
  ProjectTeamRepository,
} from '@/lib/repositories'

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
    const body = await request.json()
    const { team_user_ids, ...projectData } = body

    const project = await ProjectRepository.update(id, projectData, session.user_id)
    if (!project) {
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
          await ProjectTeamRepository.softDelete(pt.id, session.user_id)
        }
      }

      // Add new users
      for (const userId of team_user_ids || []) {
        if (!currentUserIds.has(userId)) {
          await ProjectTeamRepository.create(id, userId, session.user_id)
        }
      }
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('PUT /api/projects/[id] error:', error)
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
    const success = await ProjectRepository.softDelete(id, session.user_id)
    if (!success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
