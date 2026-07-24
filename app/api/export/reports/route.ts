import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      ORDER BY dr.date DESC, dr.created_at DESC
    `

    return NextResponse.json({ data: reports })
  } catch (error: any) {
    console.error("Export daily reports error:", error)
    return NextResponse.json({ error: error.message || "Failed to export daily reports" }, { status: 500 })
  }
}
