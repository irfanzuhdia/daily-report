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

  // We still fetch these globally because they are small and fully cached in Upstash Redis
  const [statuses, allUsers, allProjectTeams] = await Promise.all([
    StatusRepository.findAll(),
    UserRepository.findAll(),
    ProjectTeamRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // Fetch paginated & filtered projects directly from SQL
  const { data: projects, total } = await ProjectRepository.findPaginated(
    userId,
    { ...params, viewMode: effectiveViewMode },
    limit,
    offset
  )

  const totalPages = Math.ceil(total / limit)

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
      currentPage={page}
      totalPages={totalPages}
    />
  )
}
