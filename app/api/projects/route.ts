import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { ProjectRepository, ProjectTeamRepository, NotificationRepository } from '@/lib/repositories'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await ProjectRepository.findAll()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { team_user_ids, ...projectData } = body

    const project = await ProjectRepository.create(projectData, session.user_id)

    // Create ProjectTeam entries
    if (team_user_ids && Array.isArray(team_user_ids)) {
      const senderName = session.name || session.email || 'Someone'
      for (const userId of team_user_ids) {
        await ProjectTeamRepository.create(project.project_id, userId, session.user_id)
        if (userId !== session.user_id) {
          await NotificationRepository.create({
            user_id: userId,
            type: 'project_created',
            title: 'Assigned to Project',
            content: `${senderName} added you to the project: ${project.project_name}`,
            link: `/projects/${project.project_id}`
          })
        }
      }
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
