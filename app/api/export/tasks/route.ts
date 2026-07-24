import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tasks = await sql`
      SELECT 
        t.id as task_id,
        p.project_name,
        p.project_id,
        t.task_description,
        t.task_status,
        t.task_latest_percentage,
        t.created_at,
        u_creator.user_name as creator_name,
        COALESCE(
          (SELECT STRING_AGG(u.user_name, ', ')
           FROM task_teams tt
           JOIN users u ON tt.user_id = u.user_id
           WHERE tt.task_id = t.id AND tt.deleted_at IS NULL),
          ''
        ) as assigned_to,
        COALESCE(
          (SELECT SUM(CAST(dr.total_hours AS NUMERIC))
           FROM daily_reports dr
           WHERE dr.task_id = t.id AND dr.deleted_at IS NULL),
          0
        ) as total_hours,
        latest_dr.reporter_name as latest_reporter,
        latest_dr.date as latest_report_date,
        latest_dr.remarks as latest_remarks
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN users u_creator ON t.created_by = u_creator.user_id
      LEFT JOIN LATERAL (
        SELECT dr.date, dr.remarks, u.user_name as reporter_name
        FROM daily_reports dr
        LEFT JOIN users u ON dr.user_id = u.user_id
        WHERE dr.task_id = t.id AND dr.deleted_at IS NULL
        ORDER BY dr.date DESC, dr.created_at DESC
        LIMIT 1
      ) latest_dr ON true
      WHERE t.deleted_at IS NULL
      ORDER BY t.id DESC
    `

    return NextResponse.json({ data: tasks })
  } catch (error: any) {
    console.error("Export tasks error:", error)
    return NextResponse.json({ error: error.message || "Failed to export tasks" }, { status: 500 })
  }
}
