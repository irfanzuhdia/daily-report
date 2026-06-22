"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, UserPlus } from "lucide-react"

export interface UserSelectItem {
  user_id: string
  user_name: string | null
  user_email: string
  user_occupation?: string | null
}

interface SearchableUserSelectProps {
  allUsers: UserSelectItem[]
  selectedUserIds: string[]
  onAddUser: (userId: string) => void
  onRemoveUser: (userId: string) => void
  placeholder?: string
}

export function SearchableUserSelect({
  allUsers,
  selectedUserIds,
  onAddUser,
  onRemoveUser,
  placeholder = "Assign people...",
}: SearchableUserSelectProps) {
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const availableUsers = allUsers.filter((u) => !selectedUserIds.includes(u.user_id))

  const filteredAvailableUsers = availableUsers.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (
      (u.user_name || "").toLowerCase().includes(q) ||
      (u.user_email || "").toLowerCase().includes(q) ||
      (u.user_occupation || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-2">
      {/* Selected Users Badges */}
      {selectedUserIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 animate-in fade-in duration-200">
          {selectedUserIds.map((uid) => {
            const user = allUsers.find((u) => u.user_id === uid)
            return (
              <Badge key={uid} variant="secondary" className="gap-1 pl-2 pr-1 h-6 transition-all hover:bg-muted-foreground/10">
                <span className="text-xs font-medium">
                  {user?.user_name || user?.user_email || uid}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveUser(uid)}
                  className="ml-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Selector Area */}
      {showAddMember && availableUsers.length > 0 ? (
        <div className="space-y-3 p-3 rounded-xl border bg-muted/20 shadow-sm animate-in zoom-in-95 duration-150">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name, email, or occupation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs bg-background"
              autoFocus
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setSearchQuery("")}
                className="h-8 px-2 text-xs"
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setShowAddMember(false)
                setSearchQuery("")
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {filteredAvailableUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground p-1 text-center">
              No users found matching &quot;{searchQuery}&quot;
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredAvailableUsers.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => {
                    onAddUser(u.user_id)
                    setSearchQuery("")
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold truncate">{u.user_name || u.user_email}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.user_email}</p>
                  </div>
                  {u.user_occupation && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 shrink-0 border-muted-foreground/30 font-normal">
                      {u.user_occupation}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        availableUsers.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddMember(true)}
            className="text-xs font-medium"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            {placeholder}
          </Button>
        )
      )}

      {availableUsers.length === 0 && selectedUserIds.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1">All users are already assigned.</p>
      )}
    </div>
  )
}
