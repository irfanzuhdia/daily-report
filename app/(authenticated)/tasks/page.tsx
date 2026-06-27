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

  // Fetch paginated & filtered tasks directly from SQL
  const { data: tasks, total } = await TaskRepository.findPaginated(
    userId,
    { ...params, viewMode: effectiveViewMode },
    limit,
    offset
  )

  const totalPages = Math.ceil(total / limit)

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
      currentPage={page}
      totalPages={totalPages}
    />
  )
}
