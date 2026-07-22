import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { dailyReportSchema } from '@/lib/validation/schemas'
import { ReportService } from '@/lib/services/report-service'
import { handleApiError } from '@/lib/error-handler'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401)
    }

    const reports = await ReportService.getAllReports()
    return createSuccessResponse(reports)
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
    const validationResult = dailyReportSchema.parse(body)

    const currentUser = { id: session.real_user_id ?? session.user_id }
    const report = await ReportService.createReport(validationResult, currentUser)
    
    return createSuccessResponse(report, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

