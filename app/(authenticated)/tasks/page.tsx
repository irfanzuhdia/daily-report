import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  TaskRepository,
  StatusRepository,
  ProjectRepository,
  UserRepository,
  TaskTeamRepository,
  ProjectTeamRepository,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { TasksClient } from "./tasks-client"

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    project_id?: string
    status?: string
    search?: string
    created_by?: string
    member_id?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  // Kanban statuses, kept in sync with the columns rendered by TasksClient.
  const BOARD_STATUSES = ["NS", "OP", "H", "D"] as const
  // Per column, not across the board: a single global window made a column show only
  // the rows of that status that happened to fall inside it.
  const COLUMN_PAGE_SIZE = 20

  // We still fetch these globally because they are small and fully cached in Upstash Redis
  // allProjects is used for project name lookups in the UI
  const [statuses, allProjects, allUsers, allTaskTeams, allProjectTeams] = await Promise.all([
    StatusRepository.findAll(),
    ProjectRepository.findList(userId),
    UserRepository.findAll(),
    TaskTeamRepository.findAll(),
    ProjectTeamRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // One query per column so each one reflects its own real contents.
  // When the user narrows the status filter, only those columns are fetched.
  const requestedStatuses = params.status
    ? params.status.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  const statusesToLoad = requestedStatuses.length > 0
    ? BOARD_STATUSES.filter((s) => requestedStatuses.includes(s))
    : [...BOARD_STATUSES]

  const columnResults = await Promise.all(
    statusesToLoad.map(async (status) => {
      const { data, total } = await TaskRepository.findPaginated(
        userId,
        { ...params, status, viewMode: effectiveViewMode },
        COLUMN_PAGE_SIZE,
        0
      )
      return [status, { items: data, total }] as const
    })
  )

  const columnData = Object.fromEntries(columnResults)
  const tasks = columnResults.flatMap(([, col]) => col.items)

  // Enrich with project names and total hours
  const projectMap = new Map(allProjects.map((p) => [p.project_id, p.project_name]))

  const taskHoursMap: Record<string, number> = {}
  for (const task of tasks) {
    taskHoursMap[task.id] = parseFloat((task.total_hours as any) || '0')
  }

  return (
    <TasksClient
      tasks={tasks}
      statuses={statuses}
      projects={allProjects as any}
      users={allUsers}
      projectMap={Object.fromEntries(projectMap)}
      taskHoursMap={taskHoursMap}
      currentProjectId={params.project_id}
      currentStatus={params.status}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      currentMemberId={params.member_id}
      viewMode={effectiveViewMode}
      taskTeams={allTaskTeams}
      projectTeams={allProjectTeams}
      currentUserId={userId}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
      columnData={columnData}
      columnPageSize={COLUMN_PAGE_SIZE}
    />
  )
}
