import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { RoleLevelRepository, getUserLevel } from "@/lib/repositories"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roles = await RoleLevelRepository.findAll()
    return NextResponse.json(roles)
  } catch (e: any) {
    console.error("Error fetching roles:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const callerLevel = await getUserLevel(session.user_occupation)
    if (callerLevel < 7) {
      return NextResponse.json({ error: "Forbidden - Administrator privileges required" }, { status: 403 })
    }

    const { role_name, level } = await request.json()
    if (!role_name || typeof level !== "number" || level < 1 || level > 6) {
      return NextResponse.json({ error: "Invalid parameters. Level must be between 1 and 6." }, { status: 400 })
    }

    const lockedRoles = ["super user", "co - super user"];
    if (lockedRoles.includes(role_name.toLowerCase())) {
      return NextResponse.json({ error: "Administrative roles are locked and cannot be modified." }, { status: 400 })
    }

    const role = await RoleLevelRepository.upsert(role_name, level)
    return NextResponse.json({ success: true, role })
  } catch (e: any) {
    console.error("Error upserting role level:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const callerLevel = await getUserLevel(session.user_occupation)
    if (callerLevel < 7) {
      return NextResponse.json({ error: "Forbidden - Administrator privileges required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role_name = searchParams.get("role_name")

    if (!role_name) {
      return NextResponse.json({ error: "Missing role_name parameter" }, { status: 400 })
    }

    const lockedRoles = ["super user", "co - super user"];
    if (lockedRoles.includes(role_name.toLowerCase())) {
      return NextResponse.json({ error: "Administrative roles are locked and cannot be deleted." }, { status: 400 })
    }

    const success = await RoleLevelRepository.delete(role_name)
    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to delete role" }, { status: 500 })
    }
  } catch (e: any) {
    console.error("Error deleting role:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}
