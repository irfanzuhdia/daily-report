import { cookies } from "next/headers"
import {
  DateRangePreset,
  AppPageName,
  GLOBAL_DATE_RANGE_COOKIE,
  PAGE_DATE_RANGE_COOKIE_PREFIX,
  isValidPreset,
  getDateRangeFromPreset,
} from "./date-range-preference"

/**
 * Server-side helper: Read the effective default date range preset from cookies.
 */
export async function getDefaultDateRangeFromCookies(
  page?: AppPageName
): Promise<DateRangePreset> {
  const cookieStore = await cookies()

  if (page) {
    const pageVal = cookieStore.get(`${PAGE_DATE_RANGE_COOKIE_PREFIX}${page}`)?.value
    if (pageVal && isValidPreset(pageVal)) {
      return pageVal
    }
  }

  const globalVal = cookieStore.get(GLOBAL_DATE_RANGE_COOKIE)?.value
  if (globalVal && isValidPreset(globalVal)) {
    return globalVal
  }

  return "all"
}

/**
 * Server-side helper: Resolve the effective start and end dates for a page load.
 *
 * Behavior:
 * 1. If `searchParams.date_range === "all"`, the user explicitly requested all data (e.g. cleared filter).
 *    Do not apply default date bounds.
 * 2. If `searchParams.start_date` or `searchParams.end_date` is provided, use them as-is.
 * 3. Otherwise (clean URL navigation), read default preset from cookies and apply corresponding dates.
 */
export async function resolveServerDateRange(
  searchParams: {
    start_date?: string
    end_date?: string
    date_range?: string
  },
  page: AppPageName
): Promise<{ startDate?: string; endDate?: string; appliedPreset: DateRangePreset }> {
  // Case 1: Explicit "all" requested
  if (searchParams.date_range === "all") {
    return { startDate: undefined, endDate: undefined, appliedPreset: "all" }
  }

  // Case 2: Specific date filter in searchParams
  if (searchParams.start_date !== undefined || searchParams.end_date !== undefined) {
    return {
      startDate: searchParams.start_date || undefined,
      endDate: searchParams.end_date || undefined,
      appliedPreset: "all",
    }
  }

  // Case 3: Initial visit / clean URL - check user's default preference
  const defaultPreset = await getDefaultDateRangeFromCookies(page)
  if (defaultPreset !== "all") {
    const range = getDateRangeFromPreset(defaultPreset)
    return {
      startDate: range.startDate || undefined,
      endDate: range.endDate || undefined,
      appliedPreset: defaultPreset,
    }
  }

  return { startDate: undefined, endDate: undefined, appliedPreset: "all" }
}
