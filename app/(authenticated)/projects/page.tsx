import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  StatusRepository,
  TaskRepository,
  DailyReportRepository,
  UserRepository,
  ProjectTeamRepository,
  filterProjectsByUser,
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

  const [allProjects, statuses, allTasks, allReports, allUsers, allProjectTeams] = await Promise.all([
    ProjectRepository.findAll(),
    StatusRepository.findAll(),
    TaskRepository.findAll(),
    DailyReportRepository.findAll(),
    UserRepository.findAll(),
    ProjectTeamRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // Filter by user based on visibility levels
  let projects = await filterProjectsByUser(allProjects, userId)

  if (effectiveViewMode === "my") {
    const myProjectIds = new Set(
      allProjectTeams.filter((pt) => pt.user_id === userId).map((pt) => pt.project_id)
    )
    projects = projects.filter((p) => p.created_by === userId || myProjectIds.has(p.project_id))
  }

  const userMap = new Map(allUsers.map((u) => [u.user_id, (u.user_name || u.user_email || "").toLowerCase()]))

  // Apply enterprise filters
  if (params.dept_filter) {
    projects = projects.filter((p) => p.created_by && allUsers.find(u => u.user_id === p.created_by)?.user_departement === params.dept_filter)
  }
  if (params.site_filter) {
    projects = projects.filter((p) => p.created_by && allUsers.find(u => u.user_id === p.created_by)?.user_site === params.site_filter)
  }
  if (params.div_filter) {
    projects = projects.filter((p) => p.created_by && allUsers.find(u => u.user_id === p.created_by)?.user_division === params.div_filter)
  }
  if (params.team_filter) {
    projects = projects.filter((p) => p.created_by && allUsers.find(u => u.user_id === p.created_by)?.user_team === params.team_filter)
  }

  // Apply search/status/created_by/member_id filters
  if (params.status) {
    projects = projects.filter((p) => p.project_status === params.status)
  }
  if (params.created_by) {
    projects = projects.filter((p) => p.created_by === params.created_by)
  }
  if (params.member_id) {
    const memberProjectIds = new Set(
      allProjectTeams.filter((pt) => pt.user_id === params.member_id).map((pt) => pt.project_id)
    )
    projects = projects.filter((p) => memberProjectIds.has(p.project_id) || p.created_by === params.member_id)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    projects = projects.filter((p) => {
      if (p.project_name?.toLowerCase().includes(q) || p.project_description?.toLowerCase().includes(q)) {
        return true
      }
      const creatorName = p.created_by ? userMap.get(p.created_by) : ""
      if (creatorName?.includes(q)) {
        return true
      }
      const projectTeamUsers = allProjectTeams.filter((pt) => pt.project_id === p.project_id)
      for (const pt of projectTeamUsers) {
        const memberName = userMap.get(pt.user_id)
        if (memberName?.includes(q)) {
          return true
        }
      }
      return false
    })
  }

  // Calculate total hours and progress per project
  const projectHoursMap: Record<string, number> = {}
  const projectProgressMap: Record<string, number> = {}
  for (const project of projects) {
    const projectTasks = allTasks.filter((t) => t.project_id === project.project_id)
    let totalHours = 0
    let totalProgress = 0
    for (const task of projectTasks) {
      const taskReports = allReports.filter((r) => r.task_id === task.id)
      totalHours += taskReports.reduce((sum, r) => {
          const h = parseFloat(r.total_hours ?? '0')
          return sum + (isNaN(h) ? 0 : h)
        }, 0)
      if (taskReports.length > 0) {
        const latest = taskReports.reduce((max, r) => {
          if (!r.date) return max
          if (!max.date) return r
          return r.date > max.date ? r : max
        }, taskReports[0])
        totalProgress += parseFloat(latest.progress_percentage ?? '0') || 0
      }
    }
    projectHoursMap[project.project_id] = totalHours
    projectProgressMap[project.project_id] = projectTasks.length > 0
      ? Math.round(totalProgress / projectTasks.length)
      : 0
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
    />
  )
}
