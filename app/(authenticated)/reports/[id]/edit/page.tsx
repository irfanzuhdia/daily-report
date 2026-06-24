import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { DailyReportRepository, TaskRepository, ProjectRepository } from "@/lib/repositories"
import { ReportForm } from "../../report-form"

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [report, tasks, projects, uniqueCategories] = await Promise.all([
    DailyReportRepository.findById(id),
    TaskRepository.findAll(),
    ProjectRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
  ])

  if (!report) redirect("/reports")

  return (
    <ReportForm
      report={report}
      tasks={tasks}
      projects={projects}
      currentUserId={session.user_id}
      uniqueCategories={uniqueCategories}
    />
  )
}
