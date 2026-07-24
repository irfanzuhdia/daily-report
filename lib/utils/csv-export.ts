"use client"

/**
 * CSV Export Utility — Client-side CSV generation with UTF-8 BOM for Excel compatibility.
 * Used across Projects, Tasks, Reports, and Ticketing export features.
 */

/** Status code mapping for human-readable labels */
const STATUS_MAP: Record<string, string> = {
  NS: "Not Started",
  OP: "On Progress",
  D: "Done",
  H: "Hold",
  CC: "Cancelled",
  C: "Closed",
}

export function formatStatus(code: string | null | undefined): string {
  if (!code) return ""
  return STATUS_MAP[code] || code
}

/** Escape a CSV field value: wrap in quotes if it contains commas, quotes, or newlines */
export function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/** Generate a CSV string from headers and rows */
export function generateCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSVField).join(",")
  const dataLines = rows.map((row) => row.map(escapeCSVField).join(","))
  return [headerLine, ...dataLines].join("\r\n")
}

/** Trigger a CSV file download in the browser with UTF-8 BOM for Excel */
export function downloadCSV(csvString: string, filename: string): void {
  const bom = "\uFEFF"
  const blob = new Blob([bom + csvString], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Format a date string to YYYY-MM-DD */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toISOString().split("T")[0]
  } catch {
    return dateStr
  }
}

/** Format a datetime string to YYYY-MM-DD HH:mm */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toISOString().replace("T", " ").substring(0, 16)
  } catch {
    return dateStr
  }
}

/** Get today's date as YYYY-MM-DD for filename */
export function todayString(): string {
  return new Date().toISOString().split("T")[0]
}
