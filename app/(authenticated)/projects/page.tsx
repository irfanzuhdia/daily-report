import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  StatusRepository,
  UserRepository,
  ProjectTeamRepository,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ProjectsClient } from "./projects-client"

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
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

  // Kanban statuses, kept in sync with the columns rendered by ProjectsClient.
  const BOARD_STATUSES = ["NS", "OP", "H", "D"] as const
  // Per column, not across the board: a single global window made a column show only
  // the rows of that status that happened to fall inside it.
  const COLUMN_PAGE_SIZE = 20

  // We still fetch these globally because they are small and fully cached in Upstash Redis
  const [statuses, allUsers, allProjectTeams] = await Promise.all([
    StatusRepository.findAll(),
    UserRepository.findAll(),
    ProjectTeamRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // One query per column so each one reflects its own real contents.
  const requestedStatuses = params.status
    ? params.status.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  const statusesToLoad = requestedStatuses.length > 0
    ? BOARD_STATUSES.filter((s) => requestedStatuses.includes(s))
    : [...BOARD_STATUSES]

  const columnResults = await Promise.all(
    statusesToLoad.map(async (status) => {
      const { data, total } = await ProjectRepository.findPaginated(
        userId,
        { ...params, status, viewMode: effectiveViewMode },
        COLUMN_PAGE_SIZE,
        0
      )
      return [status, { items: data, total }] as const
    })
  )

  const columnData = Object.fromEntries(columnResults)
  const projects = columnResults.flatMap(([, col]) => col.items)

  // Project hours and progress are now directly provided via PostgreSQL Computed Columns!
  const projectHoursMap: Record<string, number> = {}
  const projectProgressMap: Record<string, number> = {}
  for (const project of projects) {
    projectHoursMap[project.project_id] = parseFloat((project.total_hours as any) || '0')
    projectProgressMap[project.project_id] = Math.round(parseFloat((project.project_progress as any) || '0'))
  }

  return (
    <ProjectsClient
      projects={projects}
      statuses={statuses}
      users={allUsers}
      projectHoursMap={projectHoursMap}
      projectProgressMap={projectProgressMap}
      currentStatus={params.status}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      currentMemberId={params.member_id}
      viewMode={effectiveViewMode}
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
