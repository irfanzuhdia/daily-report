import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  DailyReportRepository,
  TaskRepository,
  ProjectRepository,
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
    project_id?: string
    search?: string
    created_by?: string
    member_id?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
    start_date?: string
    end_date?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  // Kanban columns group reports by their parent task's status.
  const BOARD_STATUSES = ["NS", "OP", "H", "D"] as const
  // Completed and Cancel have no column, but they still feed the list view and the
  // archive dialog. Initial batch sized for fast paint; pages further via lazy load.
  const OFF_BOARD_STATUSES = ["C", "CC"] as const
  const OFF_BOARD_PAGE_SIZE = 35
  // Per column initial window: sized for immediate viewport coverage while the board lazy-pages
  // on scroll via IntersectionObserver.
  const COLUMN_PAGE_SIZE = 35

  const allUsers = await UserRepository.findAll()
  const currentUser = allUsers.find(u => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  const filters = {
    search: params.search,
    taskId: params.task_id,
    projectId: params.project_id,
    memberId: params.member_id,
    createdBy: params.created_by,
    dept: params.dept_filter,
    site: params.site_filter,
    div: params.div_filter,
    team: params.team_filter,
    startDate: params.start_date,
    endDate: params.end_date,
    viewMode: effectiveViewMode,
  }

  // Run column queries, active tasks, projects, and task teams in parallel to eliminate waterfall
  const [columnResults, rawActiveTasks, allProjects, taskTeams] = await Promise.all([
    Promise.all(
      [...BOARD_STATUSES, ...OFF_BOARD_STATUSES].map(async (status) => {
        const onBoard = (BOARD_STATUSES as readonly string[]).includes(status)
        const { reports, total } = await DailyReportRepository.findPaginatedEnriched(
          userId,
          onBoard ? COLUMN_PAGE_SIZE : OFF_BOARD_PAGE_SIZE,
          0,
          { ...filters, taskStatus: status }
        )
        return [status, { reports, total }] as const
      })
    ),
    TaskRepository.findAll(userId),
    ProjectRepository.findAll(userId),
    effectiveViewMode === "my" ? TaskTeamRepository.findByUserId(userId) : Promise.resolve([]),
  ])

  const reports = columnResults.flatMap(([, col]) => col.reports)

  let activeTasks = rawActiveTasks
  if (effectiveViewMode === "my") {
    const myTaskIds = new Set(taskTeams.map((tt) => tt.task_id))
    activeTasks = activeTasks.filter((t) => t.created_by === userId || myTaskIds.has(t.id))
  }

  // Filter tasks based on selected project to make task dropdown smarter
  if (params.project_id) {
    activeTasks = activeTasks.filter((t) => t.project_id === params.project_id)
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

  // Only the per-status totals are consumed by the client; the rows themselves
  // already travel in `reports`.
  const columnData = Object.fromEntries(
    columnResults.map(([status, col]) => [status, { items: col.reports, total: col.total }])
  )

  return (
    <ReportsClient
      reports={cleanReports}
      tasks={activeTasks}
      projects={allProjects}
      users={allUsers.map(u => ({ ...u, level: u.level ?? 1 }))}
      currentTaskId={params.task_id}
      currentProjectId={params.project_id}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      currentMemberId={params.member_id}
      viewMode={effectiveViewMode}
      currentUserId={userId}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
      currentStartDate={params.start_date}
      currentEndDate={params.end_date}
      columnData={columnData}
      columnPageSize={COLUMN_PAGE_SIZE}
    />
  )
}
