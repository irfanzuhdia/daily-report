import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { DailyReportRepository, TaskRepository, ProjectRepository, StatusRepository, UserRepository } from "@/lib/repositories"
import { ReportForm } from "../../report-form"

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [report, tasks, projects, uniqueCategories, statuses, allUsers] = await Promise.all([
    DailyReportRepository.findById(id),
    TaskRepository.findAll(session.user_id),
    ProjectRepository.findAll(session.user_id),
    ProjectRepository.findUniqueCategories(),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  if (!report) redirect("/reports")

  return (
    <ReportForm
      report={report}
      tasks={tasks}
      projects={projects}
      currentUserId={session.user_id}
      uniqueCategories={uniqueCategories}
      statuses={statuses}
      allUsers={allUsers.map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name || u.user_email,
        user_email: u.user_email,
        user_occupation: u.user_occupation,
        user_division: u.user_division,
        user_departement: u.user_departement,
        user_site: u.user_site,
        user_team: u.user_team,
        level: u.level,
      }))}
    />
  )
}
