import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  UserRepository,
  getContributionData,
  getCategoryContributionData,
  filterProjectsByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ContributionCalendar } from "./analytics-client"

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    user_id?: string
    project_id?: string
    start_date?: string
    end_date?: string
    preset?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allProjects, users] = await Promise.all([
    ProjectRepository.findAll(),
    UserRepository.findAll(),
  ])

  // Filter projects by user when in "my" view
  const projects = viewMode === "my"
    ? await filterProjectsByUser(allProjects, userId)
    : allProjects

  const [contributionData, categoryContribution] = await Promise.all([
    getContributionData({
      userId: params.user_id ?? (viewMode === "my" ? userId : undefined),
      projectId: params.project_id,
      startDate: params.start_date,
      endDate: params.end_date,
    }),
    getCategoryContributionData({
      userId: params.user_id ?? (viewMode === "my" ? userId : undefined),
      projectId: params.project_id,
      startDate: params.start_date,
      endDate: params.end_date,
    }),
  ])

  return (
    <ContributionCalendar
      data={contributionData}
      categoryData={categoryContribution}
      projects={projects}
      users={users.map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name,
        user_email: u.user_email,
      }))}
      viewMode={viewMode}
      currentStartDate={params.start_date}
      currentEndDate={params.end_date}
      currentPreset={params.preset}
      currentProjectId={params.project_id}
      currentUserId={params.user_id}
    />
  )
}
