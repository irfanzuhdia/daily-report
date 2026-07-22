import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { ProjectService } from '@/lib/services/project-service'
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
    const project = await ProjectService.getProjectById(id)
    return createSuccessResponse(project)
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
    const { team_user_ids, ...projectData } = body

    const currentUser = { id: session.real_user_id ?? session.user_id }
    const updatedProject = await ProjectService.updateProject(id, projectData, team_user_ids, currentUser)
    return createSuccessResponse(updatedProject)
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
    const result = await ProjectService.deleteProject(id, currentUser)
    return createSuccessResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

