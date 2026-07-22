"use client"

import { useState, useCallback } from "react"
import { useToast } from "@/components/ui/toast"
import { useRouter } from "next/navigation"

type OptimisticAction<T> = (data: T) => Promise<void>

/**
 * A hook to perform an optimistic update on a piece of data.
 * It immediately updates the UI, performs the async action in the background,
 * and rolls back if the action fails.
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  action: OptimisticAction<T>
) {
  const [data, setData] = useState<T>(initialData)
  const [isPending, setIsPending] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const execute = useCallback(
    async (optimisticData: T, onSuccessMessage?: string) => {
      // Store previous state for rollback
      const previousData = data

      // Optimistically update
      setData(optimisticData)
      setIsPending(true)

      try {
        await action(optimisticData)
        if (onSuccessMessage) {
          toast({
            title: "Success",
            description: onSuccessMessage,
            variant: "success",
          })
        }
        // Refresh router to sync server state if necessary
        router.refresh()
      } catch (error: any) {
        // Rollback on error
        setData(previousData)
        toast({
          title: "Update Failed",
          description: error.message || "An error occurred while saving your changes.",
          variant: "error",
        })
      } finally {
        setIsPending(false)
      }
    },
    [action, data, router, toast]
  )

  // Allow resetting data from external sources (e.g., when server data changes)
  const reset = useCallback((newData: T) => {
    setData(newData)
  }, [])

  return {
    data,
    execute,
    reset,
    isPending,
  }
}
