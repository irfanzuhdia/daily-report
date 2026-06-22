import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { StatusRepository, UserRepository } from "@/lib/repositories"
import { toDateStr } from "@/lib/format"
import { ProjectForm } from "../project-form"

export default async function NewProjectPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [statuses, users] = await Promise.all([
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  const today = toDateStr(new Date())
  const plus30 = new Date()
  plus30.setDate(plus30.getDate() + 30)
  const endDateDefault = toDateStr(plus30)

  return (
    <ProjectForm
      statuses={statuses}
      users={users}
      initialTeamUserIds={[session.user_id]}
      defaultStartDate={today}
      defaultEndDate={endDateDefault}
    />
  )
}
