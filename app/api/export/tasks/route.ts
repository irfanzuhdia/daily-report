import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { TaskRepository, UserRepository, getUserLevel } from "@/lib/repositories"
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

    const { data: visible } = await TaskRepository.findPaginated(
      session.user_id,
      { viewMode: effectiveViewMode },
      EXPORT_ROW_CAP,
      0
    )
    const allowedIds = visible.map((t) => t.id)
    if (allowedIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const tasks = await sql`
      SELECT 
        t.id as task_id,
        p.project_name,
        p.project_id,
        t.task_description,
        t.task_status,
        t.task_latest_percentage,
        t.start_date as plan_start_date,
        t.due_date as plan_end_date,
        actual.actual_start_date,
        actual.actual_end_date,
        actual.active_days,
        actual.total_reports,
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
      -- When work actually started and last happened, as opposed to when it was planned.
      -- Dates are stored as ISO strings, so MIN/MAX order correctly without a cast.
      LEFT JOIN LATERAL (
        SELECT
          MIN(dr.date) as actual_start_date,
          MAX(dr.date) as actual_end_date,
          COUNT(DISTINCT dr.date)::int as active_days,
          COUNT(*)::int as total_reports
        FROM daily_reports dr
        WHERE dr.task_id = t.id
          AND dr.deleted_at IS NULL
          AND dr.date IS NOT NULL AND dr.date <> ''
      ) actual ON true
      WHERE t.deleted_at IS NULL
        AND t.id = ANY(${allowedIds})
      ORDER BY t.id DESC
    `

    return NextResponse.json({ data: tasks })
  } catch (error: any) {
    console.error("Export tasks error:", error)
    return NextResponse.json({ error: error.message || "Failed to export tasks" }, { status: 500 })
  }
}
