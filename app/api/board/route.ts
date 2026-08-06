import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import {
  TaskRepository,
  ProjectRepository,
  DailyReportRepository,
  UserRepository,
  getUserLevel,
} from '@/lib/repositories'
import { handleApiError } from '@/lib/error-handler'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

/**
 * Feeds one kanban column at a time.
 *
 * The board used to take a single 50-row window across every status and split it
 * client-side, so a column showed "however many of that status happened to land in
 * the window" rather than its real contents. Each column now pages independently.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return createErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)
    }

    const sp = request.nextUrl.searchParams
    const entity = sp.get('entity')
    if (entity !== 'tasks' && entity !== 'projects' && entity !== 'reports') {
      return createErrorResponse('BAD_REQUEST', "entity must be 'tasks', 'projects' or 'reports'", 400)
    }

    const status = sp.get('status')
    if (!status) {
      return createErrorResponse('BAD_REQUEST', 'status is required', 400)
    }

    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0)

    // Level 1 users are always scoped to their own items, matching the page components.
    const user = await UserRepository.findById(session.user_id)
    const level = await getUserLevel(user?.user_occupation ?? null)
    const requestedViewMode = sp.get('viewMode') === 'team' ? 'team' : 'my'
    const viewMode = level === 1 ? 'my' : requestedViewMode

    const passthrough = [
      'project_id', 'search', 'created_by', 'member_id',
      'dept_filter', 'site_filter', 'div_filter', 'team_filter',
    ] as const

    const filters: Record<string, string> = { status, viewMode }
    for (const key of passthrough) {
      const v = sp.get(key)
      if (v) filters[key] = v
    }

    // Reports live in a different repository with its own filter names, and their
    // board column is the parent task's status rather than a column on the row.
    if (entity === 'reports') {
      const { reports, total } = await DailyReportRepository.findPaginatedEnriched(
        session.user_id,
        limit,
        offset,
        {
          viewMode,
          taskStatus: status,
          search: sp.get('search') || undefined,
          taskId: sp.get('task_id') || undefined,
          projectId: sp.get('project_id') || undefined,
          memberId: sp.get('member_id') || undefined,
          createdBy: sp.get('created_by') || undefined,
          dept: sp.get('dept_filter') || undefined,
          site: sp.get('site_filter') || undefined,
          div: sp.get('div_filter') || undefined,
          team: sp.get('team_filter') || undefined,
        }
      )
      return createSuccessResponse({ items: reports, total, status, offset, limit })
    }

    const repo = entity === 'tasks' ? TaskRepository : ProjectRepository
    const { data, total } = await repo.findPaginated(session.user_id, filters, limit, offset)

    // `items` rather than `data`: createSuccessResponse does not wrap the body, so a
    // field named `data` here would read as `json.data.data` on the client.
    return createSuccessResponse({ items: data, total, status, offset, limit })
  } catch (error) {
    return handleApiError(error)
  }
}
