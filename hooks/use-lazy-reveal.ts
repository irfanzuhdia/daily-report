"use client"

import { useEffect, useRef, useState } from "react"

interface UseLazyRevealOptions {
  /** Total number of items available. */
  total: number
  /** How many more to reveal each time the sentinel scrolls into view. */
  step?: number
  /** How many to render before any scrolling happens. */
  initial?: number
  /** How far ahead of the sentinel to start revealing. */
  rootMargin?: string
}

/**
 * Reveals a long list progressively as the user scrolls, with no "load more" button.
 *
 * Render `visibleCount` items, then attach `sentinelRef` to an element after them.
 * Once that element comes into view the next batch appears on its own.
 */
export function useLazyReveal({
  total,
  step = 10,
  initial = 5,
  rootMargin = "200px",
}: UseLazyRevealOptions) {
  const [revealed, setRevealed] = useState(initial)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Clamped rather than reset in an effect, so a list that shrinks (a filter change,
  // say) never renders past its end and we avoid a cascading re-render.
  const visibleCount = Math.min(revealed, total)
  const hasMore = visibleCount < total

  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed((prev) => Math.min(prev + step, total))
        }
      },
      { rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, step, total, rootMargin])

  return { visibleCount, hasMore, sentinelRef }
}
