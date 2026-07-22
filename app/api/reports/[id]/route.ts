import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { ReportService } from '@/lib/services/report-service'
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
    const report = await ReportService.getReportById(id)
    return createSuccessResponse(report)
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
    const currentUser = { id: session.real_user_id ?? session.user_id }

    const report = await ReportService.updateReport(id, body, currentUser)
    return createSuccessResponse(report)
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
    
    const result = await ReportService.deleteReport(id, currentUser)
    return createSuccessResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

