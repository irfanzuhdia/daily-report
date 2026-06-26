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
