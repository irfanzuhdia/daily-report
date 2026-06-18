"use client"

import { useViewMode } from "./view-mode"

/**
 * Returns the user_id to filter by when in "my" view.
 * Returns empty string for "team" view (no filtering).
 * 
 * Note: This is a client-side hook. The actual user_id is passed
 * from the server component via props. This hook just determines
 * whether to apply the filter based on view mode.
 */
export function useUserFilter(userId: string): string {
  const { viewMode } = useViewMode()
  return viewMode === "my" ? userId : ""
}
