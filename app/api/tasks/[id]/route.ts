import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { TaskService } from '@/lib/services/task-service'
import { handleApiError } from '@/lib/error-handler'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const { id } = await params
    const task = await TaskService.getTaskById(id)
    return createSuccessResponse(task)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const { id } = await params
    const body = await request.json()
    const { task_user_ids, ...taskData } = body

    const currentUser = { id: session.real_user_id ?? session.user_id }
    const updatedTask = await TaskService.updateTask(id, taskData, task_user_ids, currentUser)
    return createSuccessResponse(updatedTask)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const { id } = await params
    const currentUser = { id: session.real_user_id ?? session.user_id }
    const result = await TaskService.deleteTask(id, currentUser)
    return createSuccessResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

