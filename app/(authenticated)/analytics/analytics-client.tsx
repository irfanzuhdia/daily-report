"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ArrowLeft, Calendar, BarChart3, Clock, TrendingUp, Award } from "lucide-react"
import { useViewDensity } from "@/lib/view-density"
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
  categoryData: { category: string | null; hours: number }[]
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

export function CategoryPieChart({ data }: { data: { category: string | null; hours: number }[] }) {
  const { density } = useViewDensity()
  const isCompact = density === "compact"

  const activeData = useMemo(() => {
    return data
      .filter((item) => item.hours > 0)
      .map((item) => ({
        name: item.category || "Uncategorized",
        hours: Math.round(item.hours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours)
  }, [data])

  const totalHours = useMemo(() => {
    return activeData.reduce((sum, item) => sum + item.hours, 0)
  }, [activeData])

  const chartData = useMemo(() => {
    const result: { name: string; hours: number; percent: number; startPercent: number }[] = []
    activeData.reduce((acc, item) => {
      const percent = totalHours > 0 ? (item.hours / totalHours) * 100 : 0
      result.push({ ...item, percent, startPercent: acc })
      return acc + percent
    }, 0)
    return result
  }, [activeData, totalHours])

  const colors = [
    { stroke: "stroke-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500" },
    { stroke: "stroke-indigo-500", text: "text-indigo-500", bg: "bg-indigo-500" },
    { stroke: "stroke-violet-500", text: "text-violet-500", bg: "bg-violet-500" },
    { stroke: "stroke-amber-500", text: "text-amber-500", bg: "bg-amber-500" },
    { stroke: "stroke-rose-500", text: "text-rose-500", bg: "bg-rose-500" },
    { stroke: "stroke-cyan-500", text: "text-cyan-500", bg: "bg-cyan-500" },
    { stroke: "stroke-sky-500", text: "text-sky-500", bg: "bg-sky-500" },
    { stroke: "stroke-fuchsia-500", text: "text-fuchsia-500", bg: "bg-fuchsia-500" },
  ]

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (activeData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
        <BarChart3 className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No report hours logged in this period</p>
      </div>
    )
  }

  const size = isCompact ? 140 : 180
  const radius = isCompact ? 48 : 60
  const strokeWidth = isCompact ? 16 : 20
  const circumference = 2 * Math.PI * radius

  return (
    <div className={`grid ${isCompact ? "gap-4 md:grid-cols-12" : "gap-6 md:grid-cols-12"} items-center`}>
      {/* Chart Section */}
      <div className="md:col-span-5 flex justify-center relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 select-none drop-shadow-sm"
        >
          {chartData.map((item, index) => {
            const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`
            const strokeDashoffset = - (item.startPercent / 100) * circumference
            const isHovered = hoveredIndex === index
            const c = colors[index % colors.length]

            return (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className={`transition-all duration-300 ease-out cursor-pointer ${c.stroke}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  strokeLinecap: "butt",
                  transformOrigin: "center",
                }}
              />
            )
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredIndex !== null ? (
            <>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider max-w-[100px] truncate text-center px-1">
                {chartData[hoveredIndex].name}
              </span>
              <span className={`${isCompact ? "text-base" : "text-xl"} font-bold text-foreground`}>
                {Math.round(chartData[hoveredIndex].percent * 10) / 10}%
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {chartData[hoveredIndex].hours}h
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Total Hours
              </span>
              <span className={`${isCompact ? "text-lg" : "text-2xl"} font-extrabold text-foreground`}>
                {Math.round(totalHours * 10) / 10}h
              </span>
              <span className="text-[10px] text-muted-foreground">
                {chartData.length} categories
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend Section */}
      <div className="md:col-span-7">
        <div className={`max-h-[180px] overflow-y-auto pr-1 ${isCompact ? "space-y-1" : "space-y-1.5"}`}>
          {chartData.map((item, index) => {
            const isHovered = hoveredIndex === index
            const c = colors[index % colors.length]
            return (
              <div
                key={index}
                className={`flex items-center justify-between rounded-xl transition-colors cursor-pointer ${
                  isCompact ? "p-1 px-2" : "p-1.5"
                } ${
                  isHovered ? "bg-muted/80" : "hover:bg-muted/30"
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${c.bg}`} />
                  <span className={`font-semibold text-foreground truncate ${isCompact ? "text-[11px]" : "text-xs"}`}>
                    {item.name}
                  </span>
                </div>
                <div className={`flex items-center gap-2 font-mono shrink-0 ${isCompact ? "text-[11px]" : "text-xs"}`}>
                  <span className="text-muted-foreground font-medium">{item.hours}h</span>
                  <span className="font-bold text-right w-10">
                    {Math.round(item.percent * 10) / 10}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── main component ─── */
export function ContributionCalendar({
  data,
  categoryData = [],
  projects,
  users,
  viewMode: globalViewMode,
  currentStartDate = "",
  currentEndDate = "",
  currentPreset = "1y",
  currentProjectId = "",
  currentUserId = "",
}: ContributionCalendarProps) {
  const { density } = useViewDensity()
  const isCompact = density === "compact"
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

  const cellSize = isCompact ? 10 : 12
  const cellGap = isCompact ? 1.5 : 2
  const colWidth = cellSize + cellGap

  return (
    <div className={isCompact ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className={isCompact ? "h-8 px-2 text-xs" : ""}>
            <ArrowLeft className={`mr-2 h-4 w-4 ${isCompact ? "h-3.5 w-3.5 mr-1" : ""}`} />
            Back
          </Button>
        </Link>
        <div>
          <h1 className={`${isCompact ? "text-xl" : "text-2xl"} font-bold tracking-tight`}>Contribution Calendar</h1>
          <p className={`${isCompact ? "text-xs" : "text-sm"} text-muted-foreground`}>Visualize daily work hours across your team</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid ${isCompact ? "gap-2 sm:grid-cols-2 lg:grid-cols-4" : "gap-4 sm:grid-cols-2 lg:grid-cols-4"}`}>
        <Card className={isCompact ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${isCompact ? "p-3 pb-1.5 space-y-0" : "pb-2"}`}>
            <CardTitle className={`font-medium text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>Total Hours</CardTitle>
            <Clock className={`${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground`} />
          </CardHeader>
          <CardContent className={isCompact ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${isCompact ? "text-lg" : "text-2xl"}`}>{stats.totalHours}</div>
            <p className={`text-muted-foreground ${isCompact ? "text-[10px] mt-0.5" : "text-xs"}`}>{stats.activeDays} active days</p>
          </CardContent>
        </Card>
        <Card className={isCompact ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${isCompact ? "p-3 pb-1.5 space-y-0" : "pb-2"}`}>
            <CardTitle className={`font-medium text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>Avg Hours/Day</CardTitle>
            <TrendingUp className={`${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground`} />
          </CardHeader>
          <CardContent className={isCompact ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${isCompact ? "text-lg" : "text-2xl"}`}>{stats.avgHours}</div>
            <p className={`text-muted-foreground ${isCompact ? "text-[10px] mt-0.5" : "text-xs"}`}>On active days</p>
          </CardContent>
        </Card>
        <Card className={isCompact ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${isCompact ? "p-3 pb-1.5 space-y-0" : "pb-2"}`}>
            <CardTitle className={`font-medium text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>Most Active Day</CardTitle>
            <Award className={`${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground`} />
          </CardHeader>
          <CardContent className={isCompact ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${isCompact ? "text-lg" : "text-2xl"}`}>{stats.maxDay.hours}h</div>
            <p className={`text-muted-foreground ${isCompact ? "text-[10px] mt-0.5" : "text-xs"}`}>
              {stats.maxDay.date !== "—" ? formatDate(stats.maxDay.date) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className={isCompact ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${isCompact ? "p-3 pb-1.5 space-y-0" : "pb-2"}`}>
            <CardTitle className={`font-medium text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>Active Days</CardTitle>
            <Calendar className={`${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground`} />
          </CardHeader>
          <CardContent className={isCompact ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${isCompact ? "text-lg" : "text-2xl"}`}>{stats.activeDays}</div>
            <p className={`text-muted-foreground ${isCompact ? "text-[10px] mt-0.5" : "text-xs"}`}>Days with reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={isCompact ? "shadow-sm" : ""}>
        <CardHeader className={isCompact ? "p-3.5 pb-2" : ""}>
          <CardTitle className={isCompact ? "text-sm" : "text-base"}>Filters</CardTitle>
        </CardHeader>
        <CardContent className={isCompact ? "p-3.5 pt-0 space-y-3" : "space-y-4"}>
          {/* Quick presets */}
          <div>
            <Label className={`text-muted-foreground mb-1.5 block ${isCompact ? "text-[10px]" : "text-xs"}`}>Quick Presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={preset === p.key ? "default" : "outline"}
                  onClick={() => applyPreset(p.key)}
                  className={isCompact ? "h-7 text-xs px-2.5 rounded-md" : ""}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Filters dropdowns & date range */}
          <div className={`flex flex-wrap ${isCompact ? "gap-2" : "gap-3"}`}>
            {globalViewMode === "team" && (
              <div className="w-full sm:w-auto">
                <Label className={`text-muted-foreground mb-1 block ${isCompact ? "text-[10px]" : "text-xs"}`}>Created by</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className={`w-full sm:w-[200px] ${isCompact ? "h-8 text-xs rounded-md" : ""}`}>
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
              <Label className={`text-muted-foreground mb-1 block ${isCompact ? "text-[10px]" : "text-xs"}`}>Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className={`w-full sm:w-[200px] ${isCompact ? "h-8 text-xs rounded-md" : ""}`}>
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
              <Label className={`text-muted-foreground mb-1 block ${isCompact ? "text-[10px]" : "text-xs"}`}>Start Date</Label>
              <Input
                type="date"
                value={inputStart}
                onChange={(e) => { setInputStart(e.target.value); setPreset("custom") }}
                className={`w-full sm:w-[160px] ${isCompact ? "h-8 text-xs rounded-md" : ""}`}
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label className={`text-muted-foreground mb-1 block ${isCompact ? "text-[10px]" : "text-xs"}`}>End Date</Label>
              <Input
                type="date"
                value={inputEnd}
                onChange={(e) => { setInputEnd(e.target.value); setPreset("custom") }}
                className={`w-full sm:w-[160px] ${isCompact ? "h-8 text-xs rounded-md" : ""}`}
              />
            </div>
            <div className="w-full sm:w-auto flex items-end">
              <Button
                type="button"
                onClick={handleApplyCustomRange}
                className={`w-full sm:w-auto ${isCompact ? "h-8 text-xs px-3 rounded-md" : ""}`}
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
            <div className="text-[11px] text-muted-foreground">
              Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
              {" · "}{allDays.length} days
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Contribution Pie Chart */}
      <Card className={isCompact ? "shadow-sm" : ""}>
        <CardHeader className={isCompact ? "p-3.5 pb-2" : ""}>
          <CardTitle className={`flex items-center gap-2 ${isCompact ? "text-sm" : "text-base"}`}>
            <BarChart3 className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            Time Distribution by Category
          </CardTitle>
        </CardHeader>
        <CardContent className={isCompact ? "p-3.5 pt-0" : ""}>
          <CategoryPieChart data={categoryData} />
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card className={isCompact ? "shadow-sm" : ""}>
        <CardHeader className={isCompact ? "p-3.5 pb-2" : ""}>
          <CardTitle className={`flex items-center gap-2 ${isCompact ? "text-sm" : "text-base"}`}>
            <BarChart3 className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            Contribution Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent className={isCompact ? "p-3.5 pt-0" : ""}>
          {allDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">Select a date range to view the heatmap</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${Math.max(weeks.length * colWidth + 40, 300)}px` }}>
                {/* Month labels */}
                <div className={`flex mb-1 relative h-4 ${isCompact ? "ml-8" : "ml-10"}`}>
                  {monthLabels.map((m, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-muted-foreground absolute"
                      style={{ left: `${m.index * colWidth}px` }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                <div className="flex gap-0">
                  {/* Day labels */}
                  <div className="flex flex-col mr-2 pt-0" style={{ gap: `${cellGap}px` }}>
                    {dayLabels.map((label, i) => (
                      <div
                        key={label}
                        className="text-[10px] text-muted-foreground flex items-center justify-end pr-1"
                        style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
                      >
                        {i % 2 === 1 ? label : ""}
                      </div>
                    ))}
                  </div>

                  {/* Weeks */}
                  <div className="flex" style={{ gap: `${cellGap}px` }}>
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col" style={{ gap: `${cellGap}px` }}>
                        {week.map((day, di) => (
                          <div
                            key={di}
                            className={`rounded-sm transition-colors ${day.date ? getColor(day.hours) : "bg-transparent"
                              } ${day.hours > 0 ? "hover:ring-1 hover:ring-primary cursor-pointer" : ""}`}
                            style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
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
                <div className={`flex items-center gap-2 justify-end ${isCompact ? "mt-2" : "mt-4"}`}>
                  <span className="text-xs text-muted-foreground">Less</span>
                  {GITHUB_COLORS.map((color, i) => (
                    <div
                      key={i}
                      className={`rounded-sm ${color}`}
                      style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                    />
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
