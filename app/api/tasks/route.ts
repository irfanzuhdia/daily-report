import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { TaskRepository, TaskTeamRepository } from '@/lib/repositories'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasks = await TaskRepository.findAll()
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('GET /api/tasks error:', error)
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
    const { task_user_ids, ...taskData } = body

    const task = await TaskRepository.create(taskData, session.user_id)

    // Create TaskTeam entries
    if (task_user_ids && Array.isArray(task_user_ids)) {
      for (const userId of task_user_ids) {
        await TaskTeamRepository.create(task.id, userId, session.user_id)
      }
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
