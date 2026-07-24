import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { taskSchema } from '@/lib/validation/schemas'
import { TaskService } from '@/lib/services/task-service'
import { handleApiError } from '@/lib/error-handler'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const tasks = await TaskService.getAllTasks()
    return createSuccessResponse(tasks)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const body = await request.json()
    const validationResult = taskSchema.parse(body) // using parse to let error handler catch ZodError
    
    const { task_user_ids, ...taskData } = validationResult
    
    const currentUser = {
      id: session.user_id,
      name: session.name ?? session.email ?? 'Someone'
    }

    const task = await TaskService.createTask(taskData, task_user_ids, currentUser)
    return createSuccessResponse(task, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

