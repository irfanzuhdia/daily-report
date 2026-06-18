"use client"

import * as React from "react"

type ViewMode = "my" | "team"

const COOKIE_NAME = "dr_view_mode"

function getStoredMode(): ViewMode {
  if (typeof document === "undefined") return "my"
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
  const val = match?.[1]
  return val === "team" ? "team" : "my"
}

function setStoredMode(mode: ViewMode) {
  document.cookie = `${COOKIE_NAME}=${mode};path=/;max-age=31536000`
}

interface ViewModeContextValue {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const ViewModeContext = React.createContext<ViewModeContextValue>({
  viewMode: "my",
  setViewMode: () => {},
})

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  // Initialize from cookie synchronously to avoid hydration mismatch
  const [viewMode, setViewModeState] = React.useState<ViewMode>(() => getStoredMode())

  const setViewMode = React.useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    setStoredMode(mode)
  }, [])

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  return React.useContext(ViewModeContext)
}

/**
 * Server-side helper: read the view mode from the cookie.
 */
export function getViewModeFromCookies(cookies: { get: (name: string) => { value?: string } | undefined }): ViewMode {
  const val = cookies.get(COOKIE_NAME)?.value
  return val === "team" ? "team" : "my"
}
