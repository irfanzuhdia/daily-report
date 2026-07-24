import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tickets = await sql`
      SELECT 
        tk.id as ticket_id,
        tk.title,
        tk.status,
        tk.priority,
        tk.problem_type,
        tk.division_category,
        tk.request_to_division,
        u_req.user_name as requester_name,
        COALESCE(
          (SELECT STRING_AGG(u.user_name, ', ')
           FROM ticket_team tt
           JOIN users u ON tt.user_id = u.user_id
           WHERE tt.ticket_id = tk.id),
          ''
        ) as assigned_to,
        tk.due_date,
        tk.description,
        COALESCE(
          (SELECT COUNT(*) FROM ticket_comments tc WHERE tc.ticket_id = tk.id),
          0
        ) as total_comments,
        tk.created_at,
        tk.updated_at
      FROM tickets tk
      LEFT JOIN users u_req ON tk.request_by = u_req.user_id
      WHERE tk.deleted_at IS NULL
      ORDER BY tk.created_at DESC
    `

    return NextResponse.json({ data: tickets })
  } catch (error: any) {
    console.error("Export tickets error:", error)
    return NextResponse.json({ error: error.message || "Failed to export tickets" }, { status: 500 })
  }
}
