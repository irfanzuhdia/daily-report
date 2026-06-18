import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import { DailyReportRepository, TaskRepository } from "@/lib/repositories"
import { ReportForm } from "../../report-form"

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [report, tasks] = await Promise.all([
    DailyReportRepository.findById(id),
    TaskRepository.findAll(),
  ])

  if (!report) redirect("/reports")

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <ReportForm report={report} tasks={tasks} />
    </AppLayout>
  )
}
