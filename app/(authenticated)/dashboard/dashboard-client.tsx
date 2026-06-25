"use client"
import { toDateStr } from "@/lib/format"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

import Link from "next/link"
import { useViewDensity } from "@/lib/view-density"
import {
  FolderKanban,
  ListTodo,
  FileText,
  TrendingUp,
  ArrowRight,
  Clock,
  BarChart3,
  Filter,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import type { DashboardStats } from "@/lib/types"

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  "Not Started":  "secondary",
  "On Progress": "warning",
  Done: "success",
  Hold: "destructive",
  Cancel: "destructive",
}

interface UserSelectItem {
  user_id: string
  user_email: string
  user_name: string | null
  user_occupation?: string | null
  user_departement?: string | null
  user_division?: string | null
  user_site?: string | null
  user_team?: string | null
  level?: number
}

export function DashboardClient({
  stats,
  viewMode,
  users = [],
  currentCreatedBy = "",
  currentStartDate = "",
  currentEndDate = "",
  currentDept = "",
  currentSite = "",
  currentDiv = "",
  currentTeam = "",
  currentUserId = "",
}: {
  stats: DashboardStats
  viewMode: "my" | "team"
  users?: UserSelectItem[]
  currentCreatedBy?: string
  currentStartDate?: string
  currentEndDate?: string
  currentDept?: string
  currentSite?: string
  currentDiv?: string
  currentTeam?: string
  currentUserId?: string
}) {
  const { density } = useViewDensity()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentUser = users.find((u) => u.user_id === currentUserId)
  const userLevel = currentUser?.level || 1

  const isDeptDisabled = userLevel < 6
  const isSiteDisabled = userLevel < 5
  const isDivDisabled = userLevel < 3
  const isTeamDisabled = userLevel < 2

  const defaultDept = isDeptDisabled ? (currentUser?.user_departement || "") : ""
  const defaultSite = isSiteDisabled ? (currentUser?.user_site || "") : ""
  const defaultDiv = isDivDisabled ? (currentUser?.user_division || "") : ""
  const defaultTeam = isTeamDisabled ? (currentUser?.user_team || "") : ""

  const [createdBy, setCreatedBy] = useState(currentCreatedBy)
  const [startDate, setStartDate] = useState(currentStartDate)
  const [endDate, setEndDate] = useState(currentEndDate)

  const [dept, setDept] = useState(currentDept || defaultDept)
  const [site, setSite] = useState(currentSite || defaultSite)
  const [division, setDivision] = useState(currentDiv || defaultDiv)
  const [team, setTeam] = useState(currentTeam || defaultTeam)

  const [inputStart, setInputStart] = useState(currentStartDate)
  const [inputEnd, setInputEnd] = useState(currentEndDate)

  const isFirstMount = useRef(true)

  // Push URL search parameters on filter changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    
    const currentParams = new URLSearchParams(searchParams.toString())
    const nextParams = new URLSearchParams(searchParams.toString())
    
    if (viewMode === "team") {
      if (createdBy) nextParams.set("created_by", createdBy)
      else nextParams.delete("created_by")

      if (dept) nextParams.set("dept_filter", dept)
      else nextParams.delete("dept_filter")

      if (site) nextParams.set("site_filter", site)
      else nextParams.delete("site_filter")

      if (division) nextParams.set("div_filter", division)
      else nextParams.delete("div_filter")

      if (team) nextParams.set("team_filter", team)
      else nextParams.delete("team_filter")
    } else {
      nextParams.delete("created_by")
      nextParams.delete("dept_filter")
      nextParams.delete("site_filter")
      nextParams.delete("div_filter")
      nextParams.delete("team_filter")
    }
    
    if (startDate) nextParams.set("start_date", startDate)
    else nextParams.delete("start_date")
    
    if (endDate) nextParams.set("end_date", endDate)
    else nextParams.delete("end_date")

    if (currentParams.toString() !== nextParams.toString()) {
      router.push(`${pathname}?${nextParams.toString()}`)
    }
  }, [createdBy, startDate, endDate, viewMode, pathname, router, searchParams, dept, site, division, team])

  const handleApplyDates = useCallback(() => {
    setStartDate(inputStart)
    setEndDate(inputEnd)
  }, [inputStart, inputEnd])

  const handleReset = useCallback(() => {
    setCreatedBy("")
    setStartDate("")
    setEndDate("")
    setInputStart("")
    setInputEnd("")
    setDept(defaultDept)
    setSite(defaultSite)
    setDivision(defaultDiv)
    setTeam(defaultTeam)
  }, [defaultDept, defaultSite, defaultDiv, defaultTeam])

  const uniqueDepts = Array.from(new Set(users.map((u) => u.user_departement).filter(Boolean))) as string[]
  const uniqueSites = Array.from(new Set(users.map((u) => u.user_site).filter(Boolean))) as string[]
  const uniqueDivs = Array.from(new Set(users.map((u) => u.user_division).filter(Boolean))) as string[]
  const uniqueTeams = Array.from(new Set(users.map((u) => u.user_team).filter(Boolean))) as string[]

  const hasActiveFilters = createdBy || startDate || endDate || 
    (dept !== defaultDept) || 
    (site !== defaultSite) || 
    (division !== defaultDiv) || 
    (team !== defaultTeam)

  return (
    <div className={density === "compact" ? "space-y-4" : "space-y-8"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {viewMode === "my"
              ? "Your personal overview"
              : "Team overview — all projects, tasks, and reports"}
          </p>
        </div>
      </div>

      {/* Filters (Team view only) */}
      {viewMode === "team" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
              {/* Created by Filter */}
              <div className="w-full sm:w-[200px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Created by</Label>
                <Select value={createdBy} onValueChange={setCreatedBy}>
                  <SelectTrigger className="w-full">
                    <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="All team members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All team members</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.user_name || u.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
              <div className="w-full sm:w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Department</Label>
                <Select value={dept} onValueChange={setDept} disabled={isDeptDisabled}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {uniqueDepts.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Site Filter */}
              <div className="w-full sm:w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Site</Label>
                <Select value={site} onValueChange={setSite} disabled={isSiteDisabled}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sites</SelectItem>
                    {uniqueSites.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Division Filter */}
              <div className="w-full sm:w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Division</Label>
                <Select value={division} onValueChange={setDivision} disabled={isDivDisabled}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Divisions</SelectItem>
                    {uniqueDivs.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team Filter */}
              <div className="w-full sm:w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Team</Label>
                <Select value={team} onValueChange={setTeam} disabled={isTeamDisabled}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Teams</SelectItem>
                    {uniqueTeams.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  value={inputStart}
                  onChange={(e) => setInputStart(e.target.value)}
                  className="w-full sm:w-[160px]"
                />
              </div>

              {/* End Date */}
              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
                <Input
                  type="date"
                  value={inputEnd}
                  onChange={(e) => setInputEnd(e.target.value)}
                  className="w-full sm:w-[160px]"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Button type="button" onClick={handleApplyDates} className="w-full sm:w-auto">
                  Apply Date
                </Button>
                {hasActiveFilters && (
                  <Button type="button" variant="ghost" onClick={handleReset} className="w-full sm:w-auto text-destructive hover:text-destructive">
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className={`grid sm:grid-cols-2 lg:grid-cols-5 ${density === "compact" ? "gap-3" : "gap-4"}`}>
        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : "pb-2"}`}>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${density === "compact" ? "text-xl" : "text-2xl"}`}>{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeProjects} active
            </p>
          </CardContent>
        </Card>

        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : "pb-2"}`}>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tasks
            </CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${density === "compact" ? "text-xl" : "text-2xl"}`}>{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedTasks} completed
            </p>
          </CardContent>
        </Card>

        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : "pb-2"}`}>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reports
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${density === "compact" ? "text-xl" : "text-2xl"}`}>{stats.totalReports}</div>
            <p className="text-xs text-muted-foreground">Total submitted</p>
          </CardContent>
        </Card>

        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : "pb-2"}`}>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${density === "compact" ? "text-xl" : "text-2xl"}`}>{stats.totalHours}</div>
            <p className="text-xs text-muted-foreground">Hours logged</p>
          </CardContent>
        </Card>

        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : "pb-2"}`}>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            <div className={`font-bold ${density === "compact" ? "text-xl" : "text-2xl"}`}>
              {stats.totalTasks > 0
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid lg:grid-cols-2 ${density === "compact" ? "gap-4" : "gap-6"}`}>
        {/* Projects by Status */}
        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={density === "compact" ? "p-3 pb-1.5" : ""}>
            <CardTitle className={density === "compact" ? "text-sm" : ""}>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            {stats.projectsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet</p>
            ) : (
              <div className={density === "compact" ? "space-y-2" : "space-y-3"}>
                {stats.projectsByStatus.map((item) => (
                  <div
                    key={item.status}
                    className="flex items-center justify-between"
                  >
                    <Badge
                      variant={statusVariant[item.status] ?? "default"}
                      className={density === "compact" ? "text-[10px] py-0 px-1.5" : ""}
                    >
                      {item.status}
                    </Badge>
                    <span className={`font-medium ${density === "compact" ? "text-xs" : "text-sm"}`}>{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className={density === "compact" ? "shadow-sm" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : ""}`}>
            <CardTitle className={density === "compact" ? "text-sm" : ""}>Recent Reports</CardTitle>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className={density === "compact" ? "h-7 text-xs px-2" : ""}>
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
            {stats.recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet</p>
            ) : (
              <div className={density === "compact" ? "space-y-2" : "space-y-3"}>
                {stats.recentReports.map((report) => (
                  <div
                    key={report.report_id}
                    className={`flex items-center justify-between rounded-xl border ${density === "compact" ? "p-2" : "p-3"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${density === "compact" ? "text-xs" : "text-sm"}`}>
                        {report.task_description ?? report.task_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.project_name ?? "Unknown project"} •{" "}
                        {report.date ?? "No date"}
                        {report.user_name && ` • ${report.user_name}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={`ml-2 shrink-0 ${density === "compact" ? "text-[9px] py-0 px-1" : ""}`}>
                      {report.progress_percentage ?? 0}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/projects">
          <Button>
            <FolderKanban className="mr-2 h-4 w-4" />
            View Projects
          </Button>
        </Link>
        <Link href="/tasks">
          <Button variant="outline">
            <ListTodo className="mr-2 h-4 w-4" />
            View Tasks
          </Button>
        </Link>
        <Link href="/reports">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            View Reports
          </Button>
        </Link>
        <Link href="/analytics">
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
        </Link>
      </div>

      {/* Contribution Heatmap Preview */}
      <ContributionHeatmapPreview
        data={stats.contributionData}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  )
}

const HEATMAP_COLORS = [
  "bg-muted/40",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-400",
  "bg-emerald-500",
  "bg-emerald-600",
]

function getHeatmapColor(hours: number): string {
  if (hours <= 0) return HEATMAP_COLORS[0]
  if (hours <= 1) return HEATMAP_COLORS[1]
  if (hours <= 2) return HEATMAP_COLORS[2]
  if (hours <= 4) return HEATMAP_COLORS[3]
  if (hours <= 6) return HEATMAP_COLORS[4]
  return HEATMAP_COLORS[5]
}

function ContributionHeatmapPreview({
  data,
  startDate,
  endDate,
}: {
  data: Record<string, number>
  startDate?: string
  endDate?: string
}) {
  const { density } = useViewDensity()
  const days: { date: string; hours: number }[] = []

  if (startDate && endDate) {
    const start = new Date(startDate + "T00:00:00")
    const end = new Date(endDate + "T00:00:00")
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
      // Cap at 60 days to prevent rendering too many blocks on the dashboard
      const count = Math.min(diff, 60)
      for (let i = 0; i < count; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        const key = toDateStr(d)
        days.push({ date: key, hours: data[key] ?? 0 })
      }
    }
  }

  // Fallback to last 30 days
  if (days.length === 0) {
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = toDateStr(d)
      days.push({ date: key, hours: data[key] ?? 0 })
    }
  }

  const totalHours = days.reduce((s, d) => s + d.hours, 0)
  const activeDays = days.filter((d) => d.hours > 0).length

  return (
    <Card className={density === "compact" ? "shadow-sm" : ""}>
      <CardHeader className={`flex flex-row items-center justify-between ${density === "compact" ? "p-3 pb-1.5" : ""}`}>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className={density === "compact" ? "text-sm" : ""}>Contribution Activity</CardTitle>
          <span className="text-xs text-muted-foreground">
            {startDate && endDate ? `${startDate} to ${endDate}` : "Last 30 days"}
          </span>
        </div>
        <Link href="/analytics">
          <Button variant="ghost" size="sm" className={density === "compact" ? "h-7 text-xs px-2" : ""}>
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className={density === "compact" ? "p-3 pt-0" : ""}>
        <div className={`flex mb-3 ${density === "compact" ? "gap-[2px] mb-2" : "gap-[3px]"}`}>
          {days.map((day) => (
            <div
              key={day.date}
              className={`w-full aspect-square rounded-sm ${getHeatmapColor(day.hours)} transition-colors`}
              title={`${day.date}: ${day.hours}h`}
            />
          ))}
        </div>
        <div className={`flex items-center justify-between text-muted-foreground ${density === "compact" ? "text-[10px]" : "text-xs"}`}>
          <span>{totalHours}h total</span>
          <span>{activeDays} active days</span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            {HEATMAP_COLORS.map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
