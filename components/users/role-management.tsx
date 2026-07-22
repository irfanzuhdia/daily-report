"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Trash2, AlertCircle, Plus } from "lucide-react"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"

export interface RoleLevel {
  role_name: string
  level: number
}

interface RoleManagementProps {
  roleLevels: RoleLevel[]
  setRoleLevels: React.Dispatch<React.SetStateAction<RoleLevel[]>>
  triggerNotice: (type: "success" | "error", message: string) => void
}

export function RoleManagement({ roleLevels, setRoleLevels, triggerNotice }: RoleManagementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleLevel, setNewRoleLevel] = useState("1")

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) return

    const name = newRoleName.trim()
    const level = parseInt(newRoleLevel, 10)

    try {
      const res = await fetch("/api/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_name: name, level }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to create role level")
      }
      
      setRoleLevels((prev) => {
        const filtered = prev.filter((r) => r.role_name.toLowerCase() !== name.toLowerCase())
        return [...filtered, { role_name: name, level }].sort((a, b) => b.level - a.level || a.role_name.localeCompare(b.role_name))
      })

      setNewRoleName("")
      triggerNotice("success", `Successfully mapped role "${name}" to Level ${level}.`)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  const handleUpdateRoleLevel = async (roleName: string, level: number) => {
    try {
      const res = await fetch("/api/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_name: roleName, level }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to update role level")
      }

      setRoleLevels((prev) =>
        prev.map((r) => (r.role_name === roleName ? { ...r, level } : r)).sort((a, b) => b.level - a.level || a.role_name.localeCompare(b.role_name))
      )

      triggerNotice("success", `Updated "${roleName}" to Level ${level}.`)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  const handleDeleteRole = async (roleName: string) => {
    if (!confirm(`Are you sure you want to delete the access mapping for "${roleName}"?`)) return
    try {
      const res = await fetch(`/api/settings/roles?role_name=${encodeURIComponent(roleName)}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to delete role mapping")
      }

      setRoleLevels((prev) => prev.filter((r) => r.role_name !== roleName))
      triggerNotice("success", `Removed mapping for "${roleName}".`)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 items-start">
      {/* Role mapping list */}
      <Card className="md:col-span-2 border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Configured Role Levels</CardTitle>
          <CardDescription>
            Role access levels regulate visibility, tagging boundaries, and administrative scopes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                header: "Role / Occupation Name",
                accessorKey: "role_name",
                sortable: true,
                cell: (row) => {
                  const isAdmin = ["super user", "co - super user"].includes(row.role_name.toLowerCase())
                  if (isAdmin) {
                    return <span className="text-violet-700 dark:text-violet-400 font-medium">{row.role_name}</span>
                  }
                  return <span className="font-medium">{row.role_name}</span>
                }
              },
              {
                header: "Access Level",
                accessorKey: "level",
                sortable: true,
                cell: (row) => {
                  const isAdmin = ["super user", "co - super user"].includes(row.role_name.toLowerCase())
                  if (isAdmin) {
                    return (
                      <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/20 px-2 py-1 text-xs font-bold text-violet-700 dark:text-violet-400">
                        Level 7 ({row.role_name === "Super User" ? "Super User" : "CO - Super User"})
                      </span>
                    )
                  }
                  return (
                    <div className="w-[120px]" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={String(row.level)}
                        onValueChange={(val) => handleUpdateRoleLevel(row.role_name, parseInt(val, 10))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((l) => (
                            <SelectItem key={l} value={String(l)}>
                              Level {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }
              },
              {
                header: <div className="text-right w-full">Actions</div>,
                accessorKey: "role_name",
                className: "text-right",
                cell: (row) => {
                  const isAdmin = ["super user", "co - super user"].includes(row.role_name.toLowerCase())
                  if (isAdmin) {
                    return <span className="text-xs text-muted-foreground font-medium">System Locked</span>
                  }
                  const isDefaultRole = ["direktur", "site manager", "site admin", "div manager", "div admin", "supervisor", "team leader", "staff"].includes(row.role_name.toLowerCase())
                  if (isDefaultRole) {
                    return <span className="text-xs text-muted-foreground">Default Role</span>
                  }
                  return (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={(e) => { e.stopPropagation(); handleDeleteRole(row.role_name); }}
                      title="Delete role level mapping"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )
                }
              }
            ]}
            data={[
              // Admin roles are not in the DB, mock them at the top
              { role_name: "Super User", level: 7 },
              { role_name: "CO - Super User", level: 7 },
              ...roleLevels.filter(r => !["super user", "co - super user"].includes(r.role_name.toLowerCase()))
            ]}
            emptyMessage="No configured role levels."
            className="border-0 shadow-none rounded-none"
          />
        </CardContent>
      </Card>

      {/* Add role mapping */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Add Custom Role Level</CardTitle>
          <CardDescription>
            Add new corporate job titles and map them to their corresponding access level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name" className="text-xs">Occupation / Role Name</Label>
              <Input
                id="role-name"
                placeholder="e.g., Lead Surveyor, Project Lead"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-level" className="text-xs">Level</Label>
              <Select value={newRoleLevel} onValueChange={setNewRoleLevel}>
                <SelectTrigger id="role-level" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Level 6 (Direktur Scope)</SelectItem>
                  <SelectItem value="5">Level 5 (Site Scope)</SelectItem>
                  <SelectItem value="4">Level 4 (Division Scope)</SelectItem>
                  <SelectItem value="3">Level 3 (Supervisor Scope)</SelectItem>
                  <SelectItem value="2">Level 2 (Team Leader Scope)</SelectItem>
                  <SelectItem value="1">Level 1 (Staff Scope)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full h-9 gap-1.5">
              <Plus className="h-4 w-4" />
              Map Role Level
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
