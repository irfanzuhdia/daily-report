"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ArrowLeft, Calendar, BarChart3, Clock, TrendingUp, Award } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Project } from "@/lib/types"

/* ─── types ─── */
interface ContributionCalendarProps {
  data: Record<string, number>
  projects: Project[]
  users: { user_id: string; user_email: string; user_name: string | null }[]
  viewMode: "my" | "team"
  currentStartDate?: string
  currentEndDate?: string
  currentPreset?: string
  currentProjectId?: string
  currentUserId?: string
}

type PresetKey = "7d" | "30d" | "90d" | "1y" | "thisMonth" | "lastMonth" | "thisYear" | "custom"

/* ─── constants ─── */
const GITHUB_COLORS = [
  "bg-muted/40",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-400",
  "bg-emerald-500",
  "bg-emerald-600",
]



function getColor(hours: number): string {
  if (hours <= 0) return GITHUB_COLORS[0]
  if (hours <= 1) return GITHUB_COLORS[1]
  if (hours <= 2) return GITHUB_COLORS[2]
  if (hours <= 4) return GITHUB_COLORS[3]
  if (hours <= 6) return GITHUB_COLORS[4]
  return GITHUB_COLORS[5]
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
  } catch { return dateStr }
}

function toDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getDayOfWeek(dateStr: string): number {
  try { return new Date(dateStr + "T00:00:00").getDay() }
  catch { return 0 }
}

function getMonthLabel(dateStr: string): string {
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short" }) }
  catch { return "" }
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/* ─── presets ─── */
function getPresetRange(key: PresetKey): { startDate: string; endDate: string } | null {
  const now = new Date()
  switch (key) {
    case "7d":
      return { startDate: toDateStr(addDays(now, -6)), endDate: toDateStr(now) }
    case "30d":
      return { startDate: toDateStr(addDays(now, -29)), endDate: toDateStr(now) }
    case "90d":
      return { startDate: toDateStr(addDays(now, -89)), endDate: toDateStr(now) }
    case "1y":
      return { startDate: toDateStr(addDays(now, -364)), endDate: toDateStr(now) }
    case "thisMonth":
      return { startDate: toDateStr(startOfMonth(now)), endDate: toDateStr(endOfMonth(now)) }
    case "lastMonth": {
      const last = addDays(startOfMonth(now), -1)
      return { startDate: toDateStr(startOfMonth(last)), endDate: toDateStr(endOfMonth(last)) }
    }
    case "thisYear":
      return { startDate: toDateStr(startOfYear(now)), endDate: toDateStr(endOfYear(now)) }
    default:
      return null
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "30d", label: "Last 30 Days" },
  { key: "lastMonth", label: "Last Month" },
  { key: "90d", label: "Last 90 Days" },
  { key: "thisYear", label: "This Year" },
  { key: "1y", label: "Last 1 Year" },
  { key: "custom", label: "Custom Range" },
]

/* ─── main component ─── */
export function ContributionCalendar({
  data,
  projects,
  users,
  viewMode: globalViewMode,
  currentStartDate = "",
  currentEndDate = "",
  currentPreset = "1y",
  currentProjectId = "",
  currentUserId = "",
}: ContributionCalendarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [selectedProject, setSelectedProject] = useState<string>(currentProjectId)
  const [selectedUser, setSelectedUser] = useState<string>(currentUserId)
  const [preset, setPreset] = useState<PresetKey>(currentPreset as PresetKey)

  // Initial custom dates or preset range dates
  const [inputStart, setInputStart] = useState<string>(
    currentStartDate || getPresetRange(preset)?.startDate || ""
  )
  const [inputEnd, setInputEnd] = useState<string>(
    currentEndDate || getPresetRange(preset)?.endDate || ""
  )
  const [customStart, setCustomStart] = useState<string>(
    currentStartDate || getPresetRange(preset)?.startDate || ""
  )
  const [customEnd, setCustomEnd] = useState<string>(
    currentEndDate || getPresetRange(preset)?.endDate || ""
  )

  const [dateError, setDateError] = useState<string | null>(null)
  const [hoveredDay, setHoveredDay] = useState<{ date: string; hours: number } | null>(null)

  /* ── resolve active date range from preset or custom inputs ── */
  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom") {
      return { startDate: customStart, endDate: customEnd }
    }
    const range = getPresetRange(preset)
    return range ?? { startDate: "", endDate: "" }
  }, [preset, customStart, customEnd])

  const isFirstMount = useRef(true)

  // Sync state values with URL search parameters on filter change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    const params = new URLSearchParams()
    if (selectedProject) params.set("project_id", selectedProject)
    if (globalViewMode === "team" && selectedUser) params.set("user_id", selectedUser)
    if (startDate) params.set("start_date", startDate)
    if (endDate) params.set("end_date", endDate)
    if (preset) params.set("preset", preset)

    router.push(`${pathname}?${params.toString()}`)
  }, [selectedProject, selectedUser, startDate, endDate, preset, globalViewMode, pathname, router])

  /* ── handle apply custom range ── */
  const handleApplyCustomRange = useCallback(() => {
    if (!inputStart || !inputEnd) {
      setDateError("Please select both start and end dates.")
      return
    }
    const start = new Date(inputStart + "T00:00:00")
    const end = new Date(inputEnd + "T00:00:00")
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setDateError("Invalid date format.")
      return
    }
    if (end < start) {
      setDateError("End date cannot be earlier than start date.")
      return
    }
    const diffDays = daysBetween(start, end) + 1
    if (diffDays > 365 * 5) {
      setDateError("Date range cannot exceed 5 years.")
      return
    }
    setDateError(null)
    setPreset("custom")
    setCustomStart(inputStart)
    setCustomEnd(inputEnd)
  }, [inputStart, inputEnd])

  /* ── build the day list that matches the active range exactly ── */
  const allDays = useMemo(() => {
    if (!startDate || !endDate) return []
    const start = new Date(startDate + "T00:00:00")
    const end = new Date(endDate + "T00:00:00")
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return []
    if (end < start) return []

    const days: string[] = []
    const total = daysBetween(start, end) + 1
    if (total > 365 * 5 || total <= 0) return [] // Protect against browser crash

    for (let i = 0; i < total; i++) {
      days.push(toDateStr(addDays(start, i)))
    }
    return days
  }, [startDate, endDate])

  /* ── filtered data (only within the active range) ── */
  const filteredData = useMemo(() => {
    const result: Record<string, number> = {}
    for (const day of allDays) {
      const hours = data[day] ?? 0
      result[day] = hours
    }
    return result
  }, [data, allDays])

  /* ── summary stats ── */
  const stats = useMemo(() => {
    const entries = Object.values(filteredData)
    const totalHours = entries.reduce((s, h) => s + h, 0)
    const activeDays = entries.filter((h) => h > 0).length
    const avgHours = activeDays > 0 ? totalHours / activeDays : 0
    const maxDay = Object.entries(filteredData).reduce(
      (max, [date, hours]) => (hours > max.hours ? { date, hours } : max),
      { date: "—", hours: 0 }
    )
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      activeDays,
      avgHours: Math.round(avgHours * 10) / 10,
      maxDay,
      totalReports: activeDays,
    }
  }, [filteredData])

  /* ── build weeks for the heatmap ── */
  const weeks = useMemo(() => {
    if (allDays.length === 0) return []

    const result: { date: string; hours: number }[][] = []
    let currentWeek: { date: string; hours: number }[] = []

    // Pad the first week with empty cells so the first day lands on the correct weekday column
    const firstDow = getDayOfWeek(allDays[0])
    for (let i = 0; i < firstDow; i++) {
      currentWeek.push({ date: "", hours: 0 })
    }

    for (const day of allDays) {
      currentWeek.push({ date: day, hours: filteredData[day] ?? 0 })
      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
      }
    }
    // Pad the last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: "", hours: 0 })
      }
      result.push(currentWeek)
    }
    return result
  }, [allDays, filteredData])

  /* ── month labels ── */
  const monthLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((week, i) => {
      const firstReal = week.find((d) => d.date)
      if (firstReal) {
        const month = new Date(firstReal.date + "T00:00:00").getMonth()
        if (month !== lastMonth) {
          labels.push({ index: i, label: getMonthLabel(firstReal.date) })
          lastMonth = month
        }
      }
    })
    return labels
  }, [weeks])

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  /* ── apply a preset ── */
  const applyPreset = useCallback((key: PresetKey) => {
    setPreset(key)
    setDateError(null)
    if (key !== "custom") {
      const range = getPresetRange(key)
      if (range) {
        setInputStart(range.startDate)
        setInputEnd(range.endDate)
        setCustomStart(range.startDate)
        setCustomEnd(range.endDate)
      }
    }
  }, [])

  /* ── range label for display ── */
  const rangeLabel = useMemo(() => {
    if (!startDate || !endDate) return "No date range selected"
    const p = PRESETS.find((p) => p.key === preset)
    if (p && p.key !== "custom") return p.label
    return `${formatDate(startDate)} — ${formatDate(endDate)}`
  }, [startDate, endDate, preset])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contribution Calendar</h1>
          <p className="text-muted-foreground">Visualize daily work hours across your team</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours}</div>
            <p className="text-xs text-muted-foreground">{stats.activeDays} active days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Hours/Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgHours}</div>
            <p className="text-xs text-muted-foreground">On active days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Active Day</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{stats.maxDay.hours}h</div>
            <p className="text-xs text-muted-foreground">
              {stats.maxDay.date !== "—" ? formatDate(stats.maxDay.date) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDays}</div>
            <p className="text-xs text-muted-foreground">Days with reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick presets */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={preset === p.key ? "default" : "outline"}
                  onClick={() => applyPreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Filters dropdowns & date range */}
          <div className="flex flex-wrap gap-3">
            {globalViewMode === "team" && (
              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1 block">Created by</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.user_name || u.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground mb-1 block">Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom date inputs — always visible so user can fine-tune */}
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
              <Input
                type="date"
                value={inputStart}
                onChange={(e) => { setInputStart(e.target.value); setPreset("custom") }}
                className="w-full sm:w-[160px]"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
              <Input
                type="date"
                value={inputEnd}
                onChange={(e) => { setInputEnd(e.target.value); setPreset("custom") }}
                className="w-full sm:w-[160px]"
              />
            </div>
            <div className="w-full sm:w-auto flex items-end">
              <Button
                type="button"
                onClick={handleApplyCustomRange}
                className="w-full sm:w-auto"
              >
                Apply
              </Button>
            </div>
          </div>

          {dateError && (
            <p className="text-xs text-destructive font-medium mt-1">{dateError}</p>
          )}

          {/* Active range summary */}
          {startDate && endDate && (
            <div className="text-xs text-muted-foreground">
              Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
              {" · "}{allDays.length} days
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Contribution Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">Select a date range to view the heatmap</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${Math.max(weeks.length * 14 + 40, 300)}px` }}>
                {/* Month labels */}
                <div className="flex ml-10 mb-1 relative h-4">
                  {monthLabels.map((m, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-muted-foreground absolute"
                      style={{ left: `${m.index * 14}px` }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                <div className="flex gap-0">
                  {/* Day labels */}
                  <div className="flex flex-col gap-[2px] mr-2 pt-0">
                    {dayLabels.map((label, i) => (
                      <div
                        key={label}
                        className="h-[12px] text-[10px] text-muted-foreground flex items-center justify-end pr-1"
                        style={{ lineHeight: "12px" }}
                      >
                        {i % 2 === 1 ? label : ""}
                      </div>
                    ))}
                  </div>

                  {/* Weeks */}
                  <div className="flex gap-[2px]">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[2px]">
                        {week.map((day, di) => (
                          <div
                            key={di}
                            className={`w-[12px] h-[12px] rounded-sm transition-colors ${day.date ? getColor(day.hours) : "bg-transparent"
                              } ${day.hours > 0 ? "hover:ring-1 hover:ring-primary cursor-pointer" : ""}`}
                            onMouseEnter={() => day.date && setHoveredDay(day)}
                            onMouseLeave={() => setHoveredDay(null)}
                            title={day.date ? `${formatDate(day.date)}: ${day.hours}h` : ""}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-4 justify-end">
                  <span className="text-xs text-muted-foreground">Less</span>
                  {GITHUB_COLORS.map((color, i) => (
                    <div key={i} className={`w-[12px] h-[12px] rounded-sm ${color}`} />
                  ))}
                  <span className="text-xs text-muted-foreground">More</span>
                </div>

                {/* Tooltip */}
                {hoveredDay && hoveredDay.date && (
                  <div className="mt-2 text-center text-sm text-muted-foreground">
                    <span className="font-medium">{formatDate(hoveredDay.date)}</span>
                    {" — "}
                    <span className="font-medium text-foreground">{hoveredDay.hours} hours</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
