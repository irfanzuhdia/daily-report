import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  DailyReportRepository,
  TaskRepository,
  UserRepository,
  TaskTeamRepository,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    task_id?: string
    search?: string
    created_by?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
    page?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const page = parseInt(params.page || "1", 10)
  const limit = 50
  const offset = (page - 1) * limit

  const currentUser = await UserRepository.findById(userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  const filters = {
    search: params.search,
    taskId: params.task_id,
    createdBy: params.created_by,
    dept: params.dept_filter,
    site: params.site_filter,
    div: params.div_filter,
    team: params.team_filter,
    viewMode: effectiveViewMode,
  }

  // Fetch paginated enriched reports directly from DB
  const { reports, total } = await DailyReportRepository.findPaginatedEnriched(
    userId,
    limit,
    offset,
    filters
  )

  // Fetch users for the filters
  const allUsers = await UserRepository.findAll()

  // For the create form dropdown, fetch a simplified list of active tasks for this user
  let activeTasks = await TaskRepository.findAll(userId) // Still need tasks for dropdown, but usually less than reports
  if (effectiveViewMode === "my") {
    const taskTeams = await TaskTeamRepository.findByUserId(userId)
    const myTaskIds = new Set(taskTeams.map((tt) => tt.task_id))
    activeTasks = activeTasks.filter((t) => t.created_by === userId || myTaskIds.has(t.id))
  }

  // Convert DB models to match ReportsClient expectations
  const cleanReports = reports.map((r: any) => ({
    ...r,
    id: r.id,
    report_id: r.report_id,
    task_id: r.task_id,
    user_id: r.user_id,
    date: r.date,
    progress_percentage: r.progress_percentage,
    total_hours: r.total_hours,
    remarks: r.remarks,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_by: r.updated_by,
    updated_at: r.updated_at,
    deleted_by: r.deleted_by,
    deleted_at: r.deleted_at,
    // Enriched fields from SQL JOIN
    task_description: r.task_description,
    task_status: r.task_status,
    project_id: r.project_id,
    project_name: r.project_name,
    created_by_name: r.created_by_name || r.user_id || "Unknown",
  }))

  const totalPages = Math.ceil(total / limit)

  return (
    <ReportsClient
      reports={cleanReports}
      tasks={activeTasks}
      users={allUsers.map(u => ({ ...u, level: u.level ?? 1 }))}
      currentTaskId={params.task_id}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      viewMode={effectiveViewMode}
      currentUserId={userId}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
      currentPage={page}
      totalPages={totalPages}
    />
  )
}
