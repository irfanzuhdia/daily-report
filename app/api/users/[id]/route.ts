import { logger } from '@/lib/logger';
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { UserRepository, UserLogRepository, getUserLevel } from "@/lib/repositories"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const callerOcc = session.user_occupation;
    const isSuperUser = (occ: string | null | undefined) => {
      if (!occ) return false;
      const o = occ.toLowerCase().replace(/\s+/g, "");
      return o === "superuser";
    };
    const isCoSuperUser = (occ: string | null | undefined) => {
      if (!occ) return false;
      const o = occ.toLowerCase().replace(/\s+/g, "");
      return o === "cosuperuser" || o === "co-superuser";
    };

    const realEmail = session.real_email ?? session.email;
    const callerIsSU = realEmail === "gadmin@multidayamitra.co.id" || isSuperUser(callerOcc);
    const callerIsCOSU = !callerIsSU && isCoSuperUser(callerOcc);

    // 1. Only permit edits if caller is Super User or CO - Super User (Level 7 check)
    if (!callerIsSU && !callerIsCOSU) {
      return NextResponse.json({ error: "Forbidden - Administrator privileges required" }, { status: 403 })
    }

    // Await params if it's a promise (Next.js dynamic routing support)
    const resolvedParams = await params
    const userId = resolvedParams.id

    const targetUser = await UserRepository.findById(userId)
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // 2. Super User profile block: reject updates if the target user's current occupation is Super User
    if (isSuperUser(targetUser.user_occupation)) {
      return NextResponse.json({ error: "Forbidden - Super User profiles are completely locked and cannot be modified by anyone" }, { status: 403 })
    }

    // 3. CO - Super User block: reject updates if the target user is CO - Super User and the caller is CO - Super User
    if (isCoSuperUser(targetUser.user_occupation) && callerIsCOSU) {
      return NextResponse.json({ error: "Forbidden - CO - Super User profiles can only be modified by a Super User" }, { status: 403 })
    }

    const body = await request.json()
    const {
      user_name,
      user_email,
      user_occupation,
      user_departement,
      user_division,
      user_site,
      user_team,
      user_unit,
      isActive,
    } = body

    // 3.5 Duplicate Email Check
    if (user_email && user_email.toLowerCase() !== targetUser.user_email.toLowerCase()) {
      const existingUser = await UserRepository.findByEmail(user_email)
      if (existingUser) {
        return NextResponse.json({ error: "Email address is already in use by another user" }, { status: 400 })
      }
    }

    // 4. Role assignment validation: if the caller is a CO - Super User, they cannot change anyone's role to Super User or CO - Super User
    if (callerIsCOSU && (isSuperUser(user_occupation) || isCoSuperUser(user_occupation))) {
      return NextResponse.json({ error: "Forbidden - Only a Super User can assign Super User or CO - Super User roles" }, { status: 403 })
    }

    const updatePayload: any = {
      user_name: user_name || null,
      user_email: user_email || targetUser.user_email,
      user_occupation: user_occupation || null,
      user_departement: user_departement || null,
      user_division: user_division || null,
      user_site: user_site || null,
      user_team: user_team || null,
      user_unit: user_unit || null,
    }

    if (typeof isActive === "boolean") {
      const actorId = session.real_user_id ?? session.user_id
      updatePayload.deleted_at = isActive ? null : new Date().toISOString()
      updatePayload.deleted_by = isActive ? null : actorId
    }

    const changes: string[] = []
    if (user_email !== undefined && user_email.toLowerCase() !== targetUser.user_email.toLowerCase()) {
      changes.push(`Email: "${targetUser.user_email}" -> "${user_email}"`)
    }
    if (user_name !== undefined && user_name !== targetUser.user_name) {
      changes.push(`Name: "${targetUser.user_name || 'None'}" -> "${user_name || 'None'}"`)
    }
    if (user_occupation !== undefined && user_occupation !== targetUser.user_occupation) {
      changes.push(`Role: "${targetUser.user_occupation || 'None'}" -> "${user_occupation || 'None'}"`)
    }
    if (user_departement !== undefined && user_departement !== targetUser.user_departement) {
      changes.push(`Department: "${targetUser.user_departement || 'None'}" -> "${user_departement || 'None'}"`)
    }
    if (user_division !== undefined && user_division !== targetUser.user_division) {
      changes.push(`Division: "${targetUser.user_division || 'None'}" -> "${user_division || 'None'}"`)
    }
    if (user_site !== undefined && user_site !== targetUser.user_site) {
      changes.push(`Site: "${targetUser.user_site || 'None'}" -> "${user_site || 'None'}"`)
    }
    if (user_team !== undefined && user_team !== targetUser.user_team) {
      changes.push(`Team: "${targetUser.user_team || 'None'}" -> "${user_team || 'None'}"`)
    }
    if (user_unit !== undefined && user_unit !== targetUser.user_unit) {
      changes.push(`Unit: "${targetUser.user_unit || 'None'}" -> "${user_unit || 'None'}"`)
    }

    let action = "UPDATE_PROFILE"
    if (typeof isActive === "boolean") {
      const wasActive = !targetUser.deleted_at
      if (wasActive !== isActive) {
        action = isActive ? "ACTIVATE" : "DEACTIVATE"
        changes.push(`Status: ${wasActive ? 'Active' : 'Inactive'} -> ${isActive ? 'Active' : 'Inactive'}`)
      }
    }

    const success = await UserRepository.updateUser(
      userId,
      updatePayload,
      session.real_user_id ?? session.user_id
    )

    if (success) {
      if (changes.length > 0) {
        const actorId = session.real_user_id ?? session.user_id
        await UserLogRepository.create({
          user_id: userId,
          action,
          details: changes.join("; ")
        }, actorId)
      }
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }
  } catch (e: any) {
    logger.error("Error updating user:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}
