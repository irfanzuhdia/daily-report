/**
 * Default Date Range Preference Management
 * Handles preset calculations (Asia/Jakarta timezone) and client-side cookie/storage persistence.
 */

export type DateRangePreset = "all" | "today" | "thisWeek" | "thisMonth" | "last30Days"
export type AppPageName = "projects" | "tasks" | "reports"

export const GLOBAL_DATE_RANGE_COOKIE = "dr_default_date_range"
export const PAGE_DATE_RANGE_COOKIE_PREFIX = "dr_default_date_range_"

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  "all",
  "today",
  "thisWeek",
  "thisMonth",
  "last30Days",
]

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  all: "All Time",
  today: "Today",
  thisWeek: "This Week",
  thisMonth: "This Month",
  last30Days: "Last 30 Days",
}

export function isValidPreset(val: unknown): val is DateRangePreset {
  return typeof val === "string" && DATE_RANGE_PRESETS.includes(val as DateRangePreset)
}

/**
 * Break down a Date into year, month, day in Asia/Jakarta timezone.
 */
function getJakartaParts(d: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
  }
}

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Calculate startDate and endDate for a given preset in YYYY-MM-DD format (Asia/Jakarta).
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset,
  refDate: Date = new Date()
): { startDate: string; endDate: string } {
  if (preset === "all") {
    return { startDate: "", endDate: "" }
  }

  const p = getJakartaParts(refDate)
  const todayUtc = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const todayStr = toYMD(p.year, p.month, p.day)

  if (preset === "today") {
    return { startDate: todayStr, endDate: todayStr }
  }

  if (preset === "thisWeek") {
    const dayOfWeek = todayUtc.getUTCDay() || 7 // Monday = 1, Sunday = 7
    const mon = new Date(todayUtc)
    mon.setUTCDate(todayUtc.getUTCDate() - dayOfWeek + 1)
    const sun = new Date(mon)
    sun.setUTCDate(mon.getUTCDate() + 6)
    return {
      startDate: toYMD(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate()),
      endDate: toYMD(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate()),
    }
  }

  if (preset === "thisMonth") {
    const firstStr = toYMD(p.year, p.month, 1)
    const lastDay = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate()
    const lastStr = toYMD(p.year, p.month, lastDay)
    return { startDate: firstStr, endDate: lastStr }
  }

  if (preset === "last30Days") {
    const past = new Date(todayUtc)
    past.setUTCDate(todayUtc.getUTCDate() - 29)
    return {
      startDate: toYMD(past.getUTCFullYear(), past.getUTCMonth() + 1, past.getUTCDate()),
      endDate: todayStr,
    }
  }

  return { startDate: "", endDate: "" }
}

/**
 * Match a given start and end date against standard presets.
 */
export function detectPresetFromRange(
  start: string,
  end: string,
  refDate: Date = new Date()
): DateRangePreset | null {
  if (!start && !end) return "all"
  const candidatePresets: DateRangePreset[] = ["today", "thisWeek", "thisMonth", "last30Days"]
  for (const preset of candidatePresets) {
    const range = getDateRangeFromPreset(preset, refDate)
    if (range.startDate === start && range.endDate === end) {
      return preset
    }
  }
  return null
}

/* ─────────────────────── Client-side Cookie & Storage Helpers ─────────────────────── */

export function getStoredGlobalPreference(): DateRangePreset {
  if (typeof document === "undefined") return "all"
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${GLOBAL_DATE_RANGE_COOKIE}=([^;]*)`))
  const val = match?.[1] || localStorage.getItem(GLOBAL_DATE_RANGE_COOKIE)
  if (val && isValidPreset(val)) return val
  return "all"
}

export function getStoredPagePreference(page: AppPageName): DateRangePreset | "use_global" {
  if (typeof document === "undefined") return "use_global"
  const cookieName = `${PAGE_DATE_RANGE_COOKIE_PREFIX}${page}`
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`))
  const val = match?.[1] || localStorage.getItem(cookieName)
  if (val && isValidPreset(val)) return val
  return "use_global"
}

export function getEffectivePreference(page?: AppPageName): DateRangePreset {
  if (page) {
    const pagePref = getStoredPagePreference(page)
    if (pagePref !== "use_global") return pagePref
  }
  return getStoredGlobalPreference()
}

export function setStoredDateRangePreference(
  preset: DateRangePreset | "use_global",
  page?: AppPageName
) {
  if (typeof document === "undefined") return

  const isGlobal = !page
  const cookieName = isGlobal ? GLOBAL_DATE_RANGE_COOKIE : `${PAGE_DATE_RANGE_COOKIE_PREFIX}${page}`

  if (preset === "use_global" && page) {
    // Remove page override
    document.cookie = `${cookieName}=;path=/;max-age=0`
    try {
      localStorage.removeItem(cookieName)
    } catch {}
  } else {
    document.cookie = `${cookieName}=${preset};path=/;max-age=31536000`
    try {
      localStorage.setItem(cookieName, preset)
    } catch {}
  }

  // Notify components
  window.dispatchEvent(
    new CustomEvent("dr_date_range_preference_changed", {
      detail: { page, preset },
    })
  )
}
