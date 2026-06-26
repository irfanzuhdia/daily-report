import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { StatusRepository, UserRepository, ProjectRepository } from "@/lib/repositories"
import { toDateStr } from "@/lib/format"
import { ProjectForm } from "../project-form"

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{
    ticketRef?: string
    title?: string
    desc?: string
    team?: string
    category?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const params = await searchParams
  const ticketRef = params.ticketRef || null
  const title = params.title || null
  const desc = params.desc || null
  const team = params.team || null
  const category = params.category || null

  const [statuses, users, uniqueCategories] = await Promise.all([
    StatusRepository.findAll(),
    UserRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
  ])

  const today = toDateStr(new Date())
  const plus30 = new Date()
  plus30.setDate(plus30.getDate() + 30)
  const endDateDefault = toDateStr(plus30)

  // Merge session user ID and any ticket team user IDs to form the initial project team
  const ticketTeamIds = team ? team.split(',').filter(Boolean) : []
  const initialTeamUserIds = Array.from(new Set([session.user_id, ...ticketTeamIds]))

  return (
    <ProjectForm
      statuses={statuses}
      users={users}
      initialTeamUserIds={initialTeamUserIds}
      defaultStartDate={today}
      defaultEndDate={endDateDefault}
      uniqueCategories={uniqueCategories}
      initialTicketRef={ticketRef}
      initialName={title}
      initialDescription={desc}
      initialCategory={category}
    />
  )
}
