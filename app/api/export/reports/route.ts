import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { DailyReportRepository, UserRepository, getUserLevel } from "@/lib/repositories"
import { EXPORT_ROW_CAP } from "@/lib/export-scope"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // The export used to dump the whole table for anyone with a session, ignoring
    // both the RBAC scope and the My/Team toggle. Reuse the repository so the file
    // contains exactly the rows the viewer can already see on screen.
    const viewMode = await getViewModeFromCookies()
    const user = await UserRepository.findById(session.user_id)
    const level = await getUserLevel(user?.user_occupation ?? null)
    const effectiveViewMode = level === 1 ? "my" : viewMode

    const { reports: visible } = await DailyReportRepository.findPaginatedEnriched(
      session.user_id,
      EXPORT_ROW_CAP,
      0,
      { viewMode: effectiveViewMode }
    )
    const allowedIds = visible.map((r: { report_id: string }) => r.report_id)
    if (allowedIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const reports = await sql`
      SELECT 
        dr.report_id,
        dr.date,
        p.project_name,
        p.project_id,
        t.task_description,
        u.user_name as reporter_name,
        u.user_email as reporter_email,
        dr.progress_percentage,
        dr.total_hours,
        dr.remarks,
        dr.created_at
      FROM daily_reports dr
      LEFT JOIN tasks t ON dr.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN users u ON dr.user_id = u.user_id
      WHERE dr.deleted_at IS NULL
        AND dr.report_id = ANY(${allowedIds})
      ORDER BY dr.date DESC, dr.created_at DESC
    `

    return NextResponse.json({ data: reports })
  } catch (error: any) {
    console.error("Export daily reports error:", error)
    return NextResponse.json({ error: error.message || "Failed to export daily reports" }, { status: 500 })
  }
}
