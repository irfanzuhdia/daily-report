import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { TaskRepository, ProjectRepository, StatusRepository, UserRepository } from "@/lib/repositories"
import { ReportForm } from "../report-form"

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ task_id?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const params = await searchParams
  const [tasks, projects, uniqueCategories, statuses, allUsers] = await Promise.all([
    TaskRepository.findAll(),
    ProjectRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  // Get the task's current progress percentage as initial value
  let defaultPercentage: string | undefined
  if (params.task_id) {
    const task = tasks.find((t) => t.id === params.task_id)
    if (task) {
      defaultPercentage = task.task_latest_percentage ?? "0"
    }
  }

  return (
    <ReportForm
      tasks={tasks}
      projects={projects}
      defaultTaskId={params.task_id}
      defaultPercentage={defaultPercentage}
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
