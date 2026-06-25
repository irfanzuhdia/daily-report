import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { UserRepository, UserLogRepository, getUserLevel } from "@/lib/repositories"

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const callerOcc = session.user_occupation
    const isSuperUser = (occ: string | null | undefined) => {
      if (!occ) return false
      const o = occ.toLowerCase().replace(/\s+/g, "")
      return o === "superuser"
    }
    const isCoSuperUser = (occ: string | null | undefined) => {
      if (!occ) return false
      const o = occ.toLowerCase().replace(/\s+/g, "")
      return o === "cosuperuser" || o === "co-superuser"
    }

    const realEmail = session.real_email ?? session.email
    const callerIsSU = realEmail === "gadmin@multidayamitra.co.id" || isSuperUser(callerOcc)
    const callerIsCOSU = !callerIsSU && isCoSuperUser(callerOcc)

    // Only permit user creation if caller is Super User or CO - Super User
    if (!callerIsSU && !callerIsCOSU) {
      return NextResponse.json({ error: "Forbidden - Administrator privileges required to create users" }, { status: 403 })
    }

    const body = await request.json()
    const {
      user_email,
      user_name,
      user_occupation,
      user_departement,
      user_division,
      user_site,
      user_team,
      user_unit,
    } = body

    if (!user_email || !user_email.trim()) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 })
    }

    const email = user_email.trim()

    // Check if user already exists
    const existingUser = await UserRepository.findByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email address already exists" }, { status: 400 })
    }

    // Role assignment validation: CO - Super User cannot assign Super User or CO - Super User roles
    if (callerIsCOSU && (isSuperUser(user_occupation) || isCoSuperUser(user_occupation))) {
      return NextResponse.json({ error: "Forbidden - Only a Super User can create Super User or CO - Super User accounts" }, { status: 403 })
    }

    const actorId = session.real_user_id ?? session.user_id

    const newUser = await UserRepository.create({
      user_email: email,
      user_name: user_name || null,
      user_occupation: user_occupation || null,
      user_division: user_division || null,
      user_departement: user_departement || null,
      user_site: user_site || null,
      user_team: user_team || null,
      user_unit: user_unit || null,
    }, actorId)

    // Log the user creation
    await UserLogRepository.create({
      user_id: newUser.user_id,
      action: "CREATE_USER",
      details: `User created with email: "${email}"; Name: "${newUser.user_name || 'None'}"; Role: "${newUser.user_occupation || 'None'}"`,
    }, actorId)

    return NextResponse.json({ success: true, user: newUser })
  } catch (e: any) {
    console.error("Error creating user:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}
