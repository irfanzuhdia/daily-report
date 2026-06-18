import { cookies } from "next/headers"

type ViewMode = "my" | "team"

const COOKIE_NAME = "dr_view_mode"

/**
 * Server-side helper: read the view mode from the cookie.
 * Call this in server components / server actions only.
 */
export async function getViewModeFromCookies(): Promise<ViewMode> {
  const cookieStore = await cookies()
  const val = cookieStore.get(COOKIE_NAME)?.value
  return val === "team" ? "team" : "my"
}
