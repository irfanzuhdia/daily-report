import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { TaskRepository, ProjectRepository } from "@/lib/repositories"
import { ReportForm } from "../report-form"

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ task_id?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const params = await searchParams
  const [tasks, projects, uniqueCategories] = await Promise.all([
    TaskRepository.findAll(),
    ProjectRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
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
    />
  )
}
