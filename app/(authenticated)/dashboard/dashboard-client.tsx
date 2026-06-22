"use client"
import { toDateStr } from "@/lib/format"

import Link from "next/link"
import {
  FolderKanban,
  ListTodo,
  FileText,
  TrendingUp,
  ArrowRight,
  Clock,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}: {
  stats: DashboardStats
  viewMode: "my" | "team"
}) {
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
      <ContributionHeatmapPreview data={stats.contributionData} />
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

function ContributionHeatmapPreview({ data }: { data: Record<string, number> }) {
  const today = new Date()
  const days: { date: string; hours: number }[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = toDateStr(d)
    days.push({ date: key, hours: data[key] ?? 0 })
  }

  const totalHours = days.reduce((s, d) => s + d.hours, 0)
  const activeDays = days.filter((d) => d.hours > 0).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Contribution Activity</CardTitle>
          <span className="text-xs text-muted-foreground">Last 30 days</span>
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
