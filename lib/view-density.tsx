"use client"

import * as React from "react"

export type ViewDensity = "comfortable" | "compact"

interface ViewDensityContextValue {
  density: ViewDensity
  setDensity: (density: ViewDensity) => void
}

const ViewDensityContext = React.createContext<ViewDensityContextValue>({
  density: "compact",
  setDensity: () => {},
})

export function ViewDensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = React.useState<ViewDensity>("compact")

  React.useEffect(() => {
    const saved = localStorage.getItem("dr_view_density")
    if (saved === "compact" || saved === "comfortable") {
      setDensityState(saved as ViewDensity)
    }
  }, [])

  const setDensity = React.useCallback((newDensity: ViewDensity) => {
    setDensityState(newDensity)
    localStorage.setItem("dr_view_density", newDensity)
  }, [])

  return (
    <ViewDensityContext.Provider value={{ density, setDensity }}>
      {children}
    </ViewDensityContext.Provider>
  )
}

export function useViewDensity() {
  return React.useContext(ViewDensityContext)
}
