import { logger } from '@/lib/logger';
import { NextResponse } from "next/server"
import { SignJWT } from "jose"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const databaseUrl = process.env.DATABASE_URL || ""
const jwtSecretKey = process.env.JWT_SECRET || "daily-report-secret-key-change-in-production"
const JWT_SECRET = new TextEncoder().encode(jwtSecretKey)

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 })
  }

  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 })
  }

  try {
    const sql = neon(databaseUrl)
    // Find a super user or admin if possible, otherwise any active user
    const users = await sql`
      SELECT * FROM users 
      WHERE deleted_at IS NULL 
      ORDER BY 
        CASE WHEN user_occupation = 'Super User' THEN 1 
             WHEN user_occupation = 'Co Super User' THEN 2 
             ELSE 3 END, 
        user_email 
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: "No users found in database" }, { status: 404 })
    }

    const u = users[0]

    const payload = {
      email: u.user_email,
      name: u.user_name || u.user_email,
      user_id: u.user_id,
      user_occupation: u.user_occupation || null,
      user_division: u.user_division || null,
      user_departement: u.user_departement || null,
      user_site: u.user_site || null,
      user_team: u.user_team || null,
      user_unit: u.user_unit || null,
    }

    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(JWT_SECRET)

    const cookieStore = await cookies()
    cookieStore.set("dr_session", token, {
      httpOnly: true,
      secure: false, // dev mode
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    })

    return NextResponse.redirect(new URL("/reports/dashboard", request.url))
  } catch (error) {
    logger.error("Dev login error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
