"use client"
import { toDateStr } from "@/lib/format"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

import Link from "next/link"
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

export function DashboardClient({
  stats,
  viewMode,
  users = [],
  currentCreatedBy = "",
  currentStartDate = "",
  currentEndDate = "",
}: {
  stats: DashboardStats
  viewMode: "my" | "team"
  users?: { user_id: string; user_email: string; user_name: string | null }[]
  currentCreatedBy?: string
  currentStartDate?: string
  currentEndDate?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [createdBy, setCreatedBy] = useState(currentCreatedBy)
  const [startDate, setStartDate] = useState(currentStartDate)
  const [endDate, setEndDate] = useState(currentEndDate)

  const [inputStart, setInputStart] = useState(currentStartDate)
  const [inputEnd, setInputEnd] = useState(currentEndDate)

  const isFirstMount = useRef(true)

  // Push URL search parameters on filter changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    if (viewMode === "team") {
      if (createdBy) params.set("created_by", createdBy)
      else params.delete("created_by")
    }
    if (startDate) params.set("start_date", startDate)
    else params.delete("start_date")
    if (endDate) params.set("end_date", endDate)
    else params.delete("end_date")

    router.push(`${pathname}?${params.toString()}`)
  }, [createdBy, startDate, endDate, viewMode, pathname, router, searchParams])

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
  }, [])

  return (
    <div className="space-y-8">
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
              <div className="w-full sm:w-[220px]">
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

              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  value={inputStart}
                  onChange={(e) => setInputStart(e.target.value)}
                  className="w-full sm:w-[160px]"
                />
              </div>

              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
                <Input
                  type="date"
                  value={inputEnd}
                  onChange={(e) => setInputEnd(e.target.value)}
                  className="w-full sm:w-[160px]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Button type="button" onClick={handleApplyDates} className="w-full sm:w-auto">
                  Apply Date
                </Button>
                {(createdBy || startDate || endDate) && (
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeProjects} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tasks
            </CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedTasks} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reports
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReports}</div>
            <p className="text-xs text-muted-foreground">Total submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours}</div>
            <p className="text-xs text-muted-foreground">Hours logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTasks > 0
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projects by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.projectsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet</p>
            ) : (
              <div className="space-y-3">
                {stats.projectsByStatus.map((item) => (
                  <div
                    key={item.status}
                    className="flex items-center justify-between"
                  >
                    <Badge
                      variant={statusVariant[item.status] ?? "default"}
                    >
                      {item.status}
                    </Badge>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Reports</CardTitle>
            <Link href="/reports">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentReports.map((report) => (
                  <div
                    key={report.report_id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {report.task_description ?? report.task_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.project_name ?? "Unknown project"} •{" "}
                        {report.date ?? "No date"}
                        {report.user_name && ` • ${report.user_name}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Contribution Activity</CardTitle>
          <span className="text-xs text-muted-foreground">
            {startDate && endDate ? `${startDate} to ${endDate}` : "Last 30 days"}
          </span>
        </div>
        <Link href="/analytics">
          <Button variant="ghost" size="sm">
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex gap-[3px] mb-3">
          {days.map((day) => (
            <div
              key={day.date}
              className={`w-full aspect-square rounded-sm ${getHeatmapColor(day.hours)} transition-colors`}
              title={`${day.date}: ${day.hours}h`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
