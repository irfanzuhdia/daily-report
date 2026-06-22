"use client"
import { toDateStr } from "@/lib/format"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DailyReport, Task } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"

export function ReportForm({
  report,
  tasks,
  defaultTaskId,
  defaultPercentage,
}: {
  report?: DailyReport
  tasks: Task[]
  defaultTaskId?: string
  defaultPercentage?: string
}) {
  const router = useRouter()
  const isEdit = !!report

  const [taskId, setTaskId] = useState(
    report?.task_id ?? defaultTaskId ?? ""
  )
  const [date, setDate] = useState(
    report?.date ?? toDateStr(new Date())
  )
  const [percentage, setPercentage] = useState(() => {
    if (report?.progress_percentage) return report.progress_percentage
    if (defaultPercentage) return defaultPercentage
    if (defaultTaskId) {
      const task = tasks.find((t) => t.id === defaultTaskId)
      if (task && task.task_latest_percentage) return task.task_latest_percentage
    }
    return "0"
  })
  const [totalHours, setTotalHours] = useState(
    report?.total_hours ?? ""
  )
  const [remarks, setRemarks] = useState(report?.remarks ?? "")
  const [saving, setSaving] = useState(false)

  const handleTaskIdChange = (val: string) => {
    setTaskId(val)
    if (!isEdit) {
      const task = tasks.find((t) => t.id === val)
      if (task && task.task_latest_percentage) {
        setPercentage(task.task_latest_percentage)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (isEdit && report) {
        await fetch(`/api/reports/${report.report_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            progress_percentage: percentage,
            total_hours: totalHours || undefined,
            remarks: remarks || undefined,
          }),
        })
        await revalidatePathsAndTags(
          ['/reports', `/reports/${report.report_id}`, `/tasks/${report.task_id}`, '/dashboard'],
          ['reports', 'tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/reports/${report.report_id}`)
      } else {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            date,
            progress_percentage: percentage,
            total_hours: totalHours || undefined,
            remarks: remarks || undefined,
          }),
        })
        const data = await res.json()
        await revalidatePathsAndTags(
          ['/reports', `/reports/${data.report_id}`, `/tasks/${taskId}`, '/dashboard'],
          ['reports', 'tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/reports/${data.report_id}`)
      }
      router.refresh()
    } catch (error) {
      console.error("Failed to save report:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isEdit ? `/reports/${report.report_id}` : "/reports"}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Report" : "New Daily Report"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="task">Task *</Label>
                <Select value={taskId} onValueChange={handleTaskIdChange} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.task_description?.slice(0, 50) ?? t.id}
                        {(t.task_description?.length ?? 0) > 50 ? "..." : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="percentage">Progress (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalHours">Total Hours</Label>
                <Input
                  id="totalHours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={totalHours}
                  onChange={(e) => setTotalHours(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter your daily progress notes..."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Link href={isEdit ? `/reports/${report.report_id}` : "/reports"}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || !date || (!isEdit && !taskId)}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  )
}
