import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      WHERE p.deleted_at IS NULL
      ORDER BY CAST(SUBSTRING(p.project_id FROM 3) AS INTEGER) DESC
    `

    return NextResponse.json({ data: projects })
  } catch (error: any) {
    console.error("Export projects error:", error)
    return NextResponse.json({ error: error.message || "Failed to export projects" }, { status: 500 })
  }
}
