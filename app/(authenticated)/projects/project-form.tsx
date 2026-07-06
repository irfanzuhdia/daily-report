"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Upload, X, FileText, Loader2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import type { Project, Status, User } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"
import { SearchableUserSelect } from "@/components/ui/searchable-user-select"

export function ProjectForm({
  project,
  statuses,
  users: allUsers,
  initialTeamUserIds,
  defaultStartDate,
  defaultEndDate,
  uniqueCategories = [],
  initialTicketRef = null,
  initialName = null,
  initialDescription = null,
  initialCategory = null,
}: {
  project?: Project
  statuses: Status[]
  users: User[]
  initialTeamUserIds: string[]
  defaultStartDate?: string
  defaultEndDate?: string
  uniqueCategories?: string[]
  initialTicketRef?: string | null
  initialName?: string | null
  initialDescription?: string | null
  initialCategory?: string | null
}) {
  const router = useRouter()
  const isEdit = !!project
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(project?.project_name ?? initialName ?? "")
  const [description, setDescription] = useState(project?.project_description ?? initialDescription ?? "")
  const [startDate, setStartDate] = useState(project?.project_start_date_plan ?? defaultStartDate ?? "")
  const [endDate, setEndDate] = useState(project?.project_end_date_plan ?? defaultEndDate ?? "")
  const [status, setStatus] = useState(project?.project_status ?? "NS")
  const [category, setCategory] = useState(project?.category ?? initialCategory ?? "")
  const [projectFile, setProjectFile] = useState<string | null>(project?.project_file ?? null)
  const [additionalLink, setAdditionalLink] = useState(project?.additional_link ?? "")
  const [fileName, setFileName] = useState<string | null>(
    project?.project_file ? extractFileName(project.project_file) : null
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [teamUserIds, setTeamUserIds] = useState<string[]>(initialTeamUserIds)
  const [ticketReference, setTicketReference] = useState<string | null>(
    project?.ticket_reference ?? initialTicketRef ?? null
  )

  function extractFileName(url: string): string {
    try {
      const urlObj = new URL(url)
      const params = new URLSearchParams(urlObj.search)
      return params.get("name") || url.split("/").pop() || url
    } catch {
      return url.length > 30 ? url.slice(0, 30) + "..." : url
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }
      const data = await res.json()
      setProjectFile(data.webViewLink)
      setFileName(data.fileName)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed"
      setUploadError(message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveFile = () => {
    setProjectFile(null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const addTeamMember = (userId: string) => {
    if (!teamUserIds.includes(userId)) {
      setTeamUserIds([...teamUserIds, userId])
    }
  }

  const removeTeamMember = (userId: string) => {
    setTeamUserIds(teamUserIds.filter((id) => id !== userId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        project_name: name,
        project_description: description || undefined,
        project_start_date_plan: startDate,
        project_end_date_plan: endDate,
        project_status: status,
        project_file: projectFile || undefined,
        additional_link: additionalLink || undefined,
        category: category.trim() || undefined,
        team_user_ids: teamUserIds,
        ticket_reference: ticketReference || undefined,
      }

      if (isEdit && project) {
        const res = await fetch(`/api/projects/${project.project_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error || `Update failed (${res.status})`)
        }
        await revalidatePathsAndTags(
          ['/projects', `/projects/${project.project_id}`, '/reports/dashboard'],
          ['projects', 'project_log']
        )
        router.push(`/projects`)
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error || `Create failed (${res.status})`)
        }
        const data = await res.json()
        await revalidatePathsAndTags(
          ['/projects', `/projects/${data.project_id}`, '/reports/dashboard'],
          ['projects', 'project_log']
        )
        router.push(`/projects`)
      }
      router.refresh()
    } catch (error) {
      console.error("Failed to save project:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isEdit ? `/projects/${project.project_id}` : "/projects"}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Project" : "New Project"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>

            {ticketReference && (
              <div className="space-y-2">
                <Label htmlFor="ticketReference">Ticket Reference</Label>
                <Input
                  id="ticketReference"
                  value={ticketReference}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  This project is linked to ticket reference {ticketReference}.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description"
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Frontend, Backend, Design, Marketing"
                list="project-categories"
              />
              <datalist id="project-categories">
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Team Assignment */}
            <div className="space-y-2">
              <Label>Project Team</Label>
              <p className="text-xs text-muted-foreground">
                Assign people to this project. They will see it in their &quot;My View&quot;.
              </p>

              <SearchableUserSelect
                allUsers={allUsers}
                selectedUserIds={teamUserIds}
                onAddUser={addTeamMember}
                onRemoveUser={removeTeamMember}
                placeholder="Add Team Member"
              />
            </div>

            {/* File Upload Section */}
            <div className="space-y-2">
              <Label>Project File</Label>
              <p className="text-xs text-muted-foreground">
                Upload supporting documents (PDF, Excel, Word, images, ZIP). Max 50MB.
              </p>

              {fileName ? (
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fileName}</p>
                    {projectFile && (
                      <a
                        href={projectFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View file
                      </a>
                    )}
                  </div>
                  <Badge variant="secondary">Uploaded</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.docx,.doc,.zip,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose File
                      </>
                    )}
                  </Button>
                </div>
              )}

              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}
            </div>

            {/* Additional Link */}
            <div className="space-y-2">
              <Label htmlFor="additionalLink">Additional Link</Label>
              <Input
                id="additionalLink"
                value={additionalLink}
                onChange={(e) => setAdditionalLink(e.target.value)}
                placeholder="Enter additional link (e.g. Google Drive, Figma, Notion)"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Link href={isEdit ? `/projects/${project.project_id}` : "/projects"}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving || !name.trim() || !startDate || !endDate}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  )
}
