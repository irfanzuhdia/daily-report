/**
 * Shared status display constants.
 * Single source of truth — imported by all client components that render status badges.
 */

export const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  C: "success",
  H: "destructive",
  CC: "destructive",
}

export const statusLabel: Record<string, string> = {
  NS: "Not Started",
  OP: "On Progress",
  D: "Completed",
  C: "Completed",
  H: "On Hold",
  CC: "Cancelled",
}

export function getPriorityBadgeClass(priority?: string | null) {
  switch (priority) {
    case "Urgent":
    case "High":
      return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
    case "Medium":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
    case "Low":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    default:
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
  }
}
