import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ProjectRepository, UserRepository, getUserLevel } from "@/lib/repositories"
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

    const { data: visible } = await ProjectRepository.findPaginated(
      session.user_id,
      { viewMode: effectiveViewMode },
      EXPORT_ROW_CAP,
      0
    )
    const allowedIds = visible.map((p) => p.project_id)
    if (allowedIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Query projects with team members, task counts, hours, and reporter contributions
    const projects = await sql`
      SELECT 
        p.project_id,
        p.project_name,
        p.category,
        p.project_status,
        p.project_description,
        p.project_start_date_plan,
        p.project_end_date_plan,
        actual.actual_start_date,
        actual.actual_end_date,
        actual.active_days,
        actual.total_reports,
        p.created_at,
        u_creator.user_name as creator_name,
        COALESCE(
          (SELECT STRING_AGG(u.user_name, ', ')
           FROM project_teams pt
           JOIN users u ON pt.user_id = u.user_id
           WHERE pt.project_id = p.project_id AND pt.deleted_at IS NULL),
          ''
        ) as team_members,
        COALESCE(
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.project_id AND t.deleted_at IS NULL),
          0
        ) as total_tasks,
        COALESCE(
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.project_id AND t.task_status = 'D' AND t.deleted_at IS NULL),
          0
        ) as completed_tasks,
        COALESCE(
          (SELECT SUM(CAST(dr.total_hours AS NUMERIC))
           FROM daily_reports dr
           JOIN tasks t ON dr.task_id = t.id
           WHERE t.project_id = p.project_id AND dr.deleted_at IS NULL AND t.deleted_at IS NULL),
          0
        ) as total_hours,
        COALESCE(
          (SELECT STRING_AGG(CONCAT(u.user_name, ' (', reporter_hours.h, 'h, ', reporter_hours.cnt, ' reports)'), '; ')
           FROM (
             SELECT dr.user_id, SUM(CAST(dr.total_hours AS NUMERIC)) as h, COUNT(*) as cnt
             FROM daily_reports dr
             JOIN tasks t ON dr.task_id = t.id
             WHERE t.project_id = p.project_id AND dr.deleted_at IS NULL AND t.deleted_at IS NULL
             GROUP BY dr.user_id
           ) reporter_hours
           JOIN users u ON reporter_hours.user_id = u.user_id),
          ''
        ) as reporter_breakdown
      FROM projects p
      LEFT JOIN users u_creator ON p.created_by = u_creator.user_id
      -- When work actually started and last happened, as opposed to when it was planned.
      -- Dates are stored as ISO strings, so MIN/MAX order correctly without a cast.
      LEFT JOIN LATERAL (
        SELECT
          MIN(dr.date) as actual_start_date,
          MAX(dr.date) as actual_end_date,
          COUNT(DISTINCT dr.date)::int as active_days,
          COUNT(*)::int as total_reports
        FROM daily_reports dr
        JOIN tasks t ON dr.task_id = t.id
        WHERE t.project_id = p.project_id
          AND dr.deleted_at IS NULL AND t.deleted_at IS NULL
          AND dr.date IS NOT NULL AND dr.date <> ''
      ) actual ON true
      WHERE p.deleted_at IS NULL
        AND p.project_id = ANY(${allowedIds})
      ORDER BY CAST(SUBSTRING(p.project_id FROM 3) AS INTEGER) DESC
    `

    return NextResponse.json({ data: projects })
  } catch (error: any) {
    console.error("Export projects error:", error)
    return NextResponse.json({ error: error.message || "Failed to export projects" }, { status: 500 })
  }
}
