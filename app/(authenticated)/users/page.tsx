import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { UserRepository, RoleLevelRepository, UserLogRepository, getUserLevel } from "@/lib/repositories"
import { UsersClient } from "./users-client"

export const revalidate = 0 // Disable cache for this admin page to ensure real-time updates

export default async function UsersPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const level = await getUserLevel(session.user_occupation)
  const isSuperUserImpersonating = session.real_email === 'gadmin@multidayamitra.co.id'
  if (level < 7 && !isSuperUserImpersonating) {
    redirect("/dashboard")
  }

  const [users, roleLevels, userLogs] = await Promise.all([
    UserRepository.findAllIncludingDeleted(),
    RoleLevelRepository.findAll(),
    UserLogRepository.findAll(),
  ])

  // Map to clean plain objects to avoid Next.js server-to-client serialization warnings
  const plainUsers = users.map((u) => ({
    user_id: u.user_id,
    user_name: u.user_name,
    user_email: u.user_email,
    user_occupation: u.user_occupation,
    user_departement: u.user_departement,
    user_division: u.user_division,
    user_site: u.user_site,
    user_team: u.user_team,
    user_unit: u.user_unit,
    deleted_at: u.deleted_at,
  }))

  const plainUserLogs = userLogs.map((l) => ({
    id: l.id,
    user_id: l.user_id,
    action: l.action,
    details: l.details,
    created_by: l.created_by,
    created_at: l.created_at,
    target_name: l.target_name || null,
    target_email: l.target_email || null,
    actor_name: l.actor_name || null,
    actor_email: l.actor_email || null,
  }))

  const plainRoleLevels = roleLevels.map((r) => ({
    role_name: r.role_name,
    level: r.level,
  }))

  return (
    <UsersClient
      users={plainUsers}
      roleLevels={plainRoleLevels}
      userLogs={plainUserLogs}
      currentUserId={session.user_id}
      currentUserOccupation={session.user_occupation}
      currentUserEmail={session.email}
      realUserEmail={session.real_email}
    />
  )
}
