"use client"

import React, { useMemo } from "react"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { MapPin, Building, GitBranch, UserCheck, Eye, Edit2, MoreHorizontal, Pencil, KeyRound, RefreshCcw, Ban } from "lucide-react"

import type { RoleLevel } from "./role-management"

// Matches the helpers in users-client.tsx
const isSuperUser = (occ?: string | null) => occ?.toLowerCase() === "super user"
const isCoSuperUser = (occ?: string | null) => occ?.toLowerCase() === "co - super user"

interface UsersTableProps {
  users: any[]
  roleLevels: RoleLevel[]
  currentUserId: string
  isSuperUserCaller: boolean
  callerIsSU: boolean
  handleImpersonateClick: (userId: string) => void
  handleEditUserClick: (u: any) => void
  handleResetPasswordClick: (u: any) => void
  setRestoreUserId: (id: string) => void
  setShowRestoreDialog: (val: boolean) => void
  setDeleteUserId: (id: string) => void
  setShowDeleteDialog: (val: boolean) => void
}

export function UsersTable({
  users,
  roleLevels,
  currentUserId,
  isSuperUserCaller,
  callerIsSU,
  handleImpersonateClick,
  handleEditUserClick,
  handleResetPasswordClick,
  setRestoreUserId,
  setShowRestoreDialog,
  setDeleteUserId,
  setShowDeleteDialog
}: UsersTableProps) {

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      header: "User Profile",
      accessorKey: "user_name",
      sortable: true,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold shrink-0">
            {(u.user_name || u.user_email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate text-foreground">{u.user_name || "No Name"}</p>
              {u.deleted_at && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-500/25">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{u.user_email}</p>
          </div>
        </div>
      )
    },
    {
      header: "Occupation (Level)",
      accessorKey: "user_occupation",
      sortable: true,
      cell: (u) => {
        const isUserAdmin = ["super user", "co - super user"].includes((u.user_occupation || "").toLowerCase())
        const userLevel = isUserAdmin 
          ? 7 
          : (roleLevels.find((r) => r.role_name.toLowerCase() === (u.user_occupation || "").toLowerCase())?.level || 1)
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
              isUserAdmin
                ? "bg-violet-50 text-violet-700 dark:bg-violet-950/25 dark:text-violet-400"
                : "bg-primary/10 text-primary"
            }`}>
              {u.user_occupation || "Staff (Default)"}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Level {userLevel}
            </span>
          </div>
        )
      }
    },
    {
      header: "Site & Department",
      accessorKey: "user_site",
      sortable: true,
      cell: (u) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="flex items-center gap-1 text-foreground">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            {u.user_site || "—"}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Building className="h-3 w-3 shrink-0" />
            {u.user_departement || "—"}
          </span>
        </div>
      )
    },
    {
      header: "Division, Team & Unit",
      accessorKey: "user_division",
      sortable: true,
      cell: (u) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="flex items-center gap-1 text-foreground">
            <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />
            {u.user_division || "—"}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <UserCheck className="h-3 w-3 shrink-0" />
            {u.user_team || "—"}
          </span>
          {u.user_unit && (
            <span className="flex items-center gap-1 text-muted-foreground/80 pl-4 text-[11px] italic">
              Unit: {u.user_unit}
            </span>
          )}
        </div>
      )
    },
    {
      header: <div className="text-right w-full">Actions</div>,
      className: "text-right",
      cell: (u) => {
        const targetIsSU = isSuperUser(u.user_occupation)
        const targetIsCOSU = isCoSuperUser(u.user_occupation)
        const canEdit = !targetIsSU && (!targetIsCOSU || callerIsSU)

        return (
          <div className="flex justify-end gap-1.5">
            {isSuperUserCaller && (
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-lg border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/20 disabled:opacity-40"
                onClick={() => handleImpersonateClick(u.user_id)}
                disabled={u.user_id === currentUserId}
                title={u.user_id === currentUserId ? "Currently impersonating this user" : "Impersonate User"}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
              onClick={() => handleEditUserClick(u)}
              disabled={!canEdit}
              title={canEdit ? "Edit User Profile" : "Profile Locked"}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <>
                {u.deleted_at ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-lg border-green-500/20 text-green-600 hover:bg-green-500 hover:text-white dark:border-green-500/30 dark:text-green-400 dark:hover:bg-green-500/20"
                    onClick={(e) => { e.stopPropagation(); setRestoreUserId(u.user_id); setShowRestoreDialog(true); }}
                    title="Restore Access"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-lg border-red-500/20 text-red-600 hover:bg-red-500 hover:text-white dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/20"
                    onClick={(e) => { e.stopPropagation(); setDeleteUserId(u.user_id); setShowDeleteDialog(true); }}
                    title="Deactivate Account"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        )
      }
    }
  ], [callerIsSU, currentUserId, handleEditUserClick, handleImpersonateClick, handleResetPasswordClick, isSuperUserCaller, roleLevels, setDeleteUserId, setRestoreUserId, setShowDeleteDialog, setShowRestoreDialog])

  return (
    <DataTable
      columns={columns}
      data={users}
      emptyMessage="No users found matching your search."
      className="border-0 shadow-none rounded-none"
    />
  )
}
