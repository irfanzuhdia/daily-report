import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { projectSchema } from '@/lib/validation/schemas'
import { ProjectService } from '@/lib/services/project-service'
import { handleApiError } from '@/lib/error-handler'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const projects = await ProjectService.getAllProjects()
    return createSuccessResponse(projects)
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
    const validationResult = projectSchema.parse(body)
    
    const { team_user_ids, ...projectData } = validationResult
    
    const currentUser = {
      id: session.user_id,
      name: session.name ?? session.email ?? 'Someone'
    }

    const project = await ProjectService.createProject(projectData, team_user_ids, currentUser)
    return createSuccessResponse(project, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

