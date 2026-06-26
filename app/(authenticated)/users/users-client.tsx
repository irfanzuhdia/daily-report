"use client"

import React, { useState, useTransition, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useViewDensity } from "@/lib/view-density"
import {
  Users,
  Shield,
  Search,
  Edit2,
  Trash2,
  Plus,
  Save,
  X,
  Building,
  MapPin,
  GitBranch,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  History,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OrgTreeGraph } from "./org-tree-graph"

interface UserProfile {
  user_id: string
  user_name: string | null
  user_email: string
  user_occupation: string | null
  user_departement: string | null
  user_division: string | null
  user_site: string | null
  user_team: string | null
  user_unit: string | null
  deleted_at?: string | null
}

interface RoleLevel {
  role_name: string
  level: number
}

interface UserLog {
  id: string
  user_id: string
  action: string
  details: string | null
  created_by: string
  created_at: string
  target_name?: string | null
  target_email?: string | null
  actor_name?: string | null
  actor_email?: string | null
}

export function UsersClient({
  users: initialUsers,
  roleLevels: initialRoleLevels,
  userLogs: initialUserLogs = [],
  currentUserId,
  currentUserOccupation,
  currentUserEmail,
  realUserEmail,
}: {
  users: UserProfile[]
  roleLevels: RoleLevel[]
  userLogs?: UserLog[]
  currentUserId: string
  currentUserOccupation: string | null
  currentUserEmail: string
  realUserEmail?: string
}) {
  const { density } = useViewDensity()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<"users" | "roles" | "tree" | "logs">("users")
  const [searchQuery, setSearchQuery] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  // State
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [roleLevels, setRoleLevels] = useState<RoleLevel[]>(initialRoleLevels)
  const [userLogs, setUserLogs] = useState<UserLog[]>(initialUserLogs)

  React.useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  React.useEffect(() => {
    setRoleLevels(initialRoleLevels)
  }, [initialRoleLevels])

  React.useEffect(() => {
    setUserLogs(initialUserLogs)
  }, [initialUserLogs])

  // Modals
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [customOccupation, setCustomOccupation] = useState("")
  const [isCustomOccActive, setIsCustomOccActive] = useState(false)

  // Cascading Custom Dropdown States
  const [isCustomDeptActive, setIsCustomDeptActive] = useState(false)
  const [isCustomSiteActive, setIsCustomSiteActive] = useState(false)
  const [isCustomDivActive, setIsCustomDivActive] = useState(false)
  const [isCustomTeamActive, setIsCustomTeamActive] = useState(false)
  const [isCustomUnitActive, setIsCustomUnitActive] = useState(false)

  // Create User Modal States
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState<Partial<UserProfile>>({
    user_name: "",
    user_email: "",
    user_occupation: "",
    user_departement: null,
    user_site: null,
    user_division: null,
    user_team: null,
    user_unit: null,
  })
  const [isNewOccCustom, setIsNewOccCustom] = useState(false)
  const [newCustomOcc, setNewCustomOcc] = useState("")
  const [isNewDeptCustom, setIsNewDeptCustom] = useState(false)
  const [isNewSiteCustom, setIsNewSiteCustom] = useState(false)
  const [isNewDivCustom, setIsNewDivCustom] = useState(false)
  const [isNewTeamCustom, setIsNewTeamCustom] = useState(false)
  const [isNewUnitCustom, setIsNewUnitCustom] = useState(false)

  // Directory Filter States
  const [filterDept, setFilterDept] = useState<string>("all")
  const [filterSite, setFilterSite] = useState<string>("all")
  const [filterDiv, setFilterDiv] = useState<string>("all")
  const [filterTeam, setFilterTeam] = useState<string>("all")
  const [filterUnit, setFilterUnit] = useState<string>("all")

  // Helpers for cascading dropdown levelling
  const existingDepts = useMemo(() => {
    return Array.from(
      new Set(users.map((u) => u.user_departement).filter(Boolean))
    ).sort() as string[]
  }, [users])

  const getExistingSites = useCallback((dept: string | null | undefined) => {
    if (!dept) return []
    return Array.from(
      new Set(
        users
          .filter((u) => u.user_departement === dept && u.user_site)
          .map((u) => u.user_site)
      )
    ).sort() as string[]
  }, [users])

  const getExistingDivs = useCallback((dept: string | null | undefined, site: string | null | undefined) => {
    if (!dept || !site) return []
    return Array.from(
      new Set(
        users
          .filter((u) => u.user_departement === dept && u.user_site === site && u.user_division)
          .map((u) => u.user_division)
      )
    ).sort() as string[]
  }, [users])

  const getExistingTeams = useCallback((dept: string | null | undefined, site: string | null | undefined, div: string | null | undefined) => {
    if (!dept || !site || !div) return []
    return Array.from(
      new Set(
        users
          .filter((u) => u.user_departement === dept && u.user_site === site && u.user_division === div && u.user_team)
          .map((u) => u.user_team)
      )
    ).sort() as string[]
  }, [users])

  const getExistingUnits = useCallback((dept: string | null | undefined, site: string | null | undefined, div: string | null | undefined, team: string | null | undefined) => {
    if (!dept || !site || !div || !team) return []
    return Array.from(
      new Set(
        users
          .filter((u) => u.user_departement === dept && u.user_site === site && u.user_division === div && u.user_team === team && u.user_unit)
          .map((u) => u.user_unit)
      )
    ).sort() as string[]
  }, [users])

  const selectableRoleLevels = useMemo(() => {
    return roleLevels.filter((r) => !["super user", "co - super user"].includes(r.role_name.toLowerCase()))
  }, [roleLevels])

  // Create Role State
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleLevel, setNewRoleLevel] = useState("1")

  // Notification Banner State
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const triggerNotice = (type: "success" | "error", message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }

  const isSuperUser = (occ: string | null | undefined) => {
    if (!occ) return false;
    const o = occ.toLowerCase().replace(/\s+/g, "");
    return o === "superuser";
  };

  const isCoSuperUser = (occ: string | null | undefined) => {
    if (!occ) return false;
    const o = occ.toLowerCase().replace(/\s+/g, "");
    return o === "cosuperuser" || o === "co-superuser";
  };

  const realEmail = realUserEmail ?? currentUserEmail;
  const isSuperUserCaller = realEmail === "gadmin@multidayamitra.co.id";

  const callerIsSU = isSuperUserCaller || isSuperUser(currentUserOccupation);
  const callerIsCOSU = !callerIsSU && isCoSuperUser(currentUserOccupation);

  const handleImpersonateClick = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      })
      if (res.ok) {
        triggerNotice("success", "Entering impersonated view...")
        window.location.href = "/reports/dashboard"
      } else {
        const err = await res.json()
        triggerNotice("error", err.error || "Impersonation failed")
      }
    } catch (e) {
      console.error(e)
      triggerNotice("error", "An error occurred during impersonation")
    }
  }

  // Dynamic cascading filter options
  const filterDeptOptions = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.user_departement).filter(Boolean))).sort() as string[]
  }, [users])

  const filterSiteOptions = useMemo(() => {
    return Array.from(
      new Set(
        users
          .filter((u) => filterDept === "all" || u.user_departement === filterDept)
          .map((u) => u.user_site)
          .filter(Boolean)
      )
    ).sort() as string[]
  }, [users, filterDept])

  const filterDivOptions = useMemo(() => {
    return Array.from(
      new Set(
        users
          .filter((u) => (filterDept === "all" || u.user_departement === filterDept) && (filterSite === "all" || u.user_site === filterSite))
          .map((u) => u.user_division)
          .filter(Boolean)
      )
    ).sort() as string[]
  }, [users, filterDept, filterSite])

  const filterTeamOptions = useMemo(() => {
    return Array.from(
      new Set(
        users
          .filter((u) => (filterDept === "all" || u.user_departement === filterDept) && (filterSite === "all" || u.user_site === filterSite) && (filterDiv === "all" || u.user_division === filterDiv))
          .map((u) => u.user_team)
          .filter(Boolean)
      )
    ).sort() as string[]
  }, [users, filterDept, filterSite, filterDiv])

  const filterUnitOptions = useMemo(() => {
    return Array.from(
      new Set(
        users
          .filter((u) => (filterDept === "all" || u.user_departement === filterDept) && (filterSite === "all" || u.user_site === filterSite) && (filterDiv === "all" || u.user_division === filterDiv) && (filterTeam === "all" || u.user_team === filterTeam))
          .map((u) => u.user_unit)
          .filter(Boolean)
      )
    ).sort() as string[]
  }, [users, filterDept, filterSite, filterDiv, filterTeam])

  // Filtered users for search and dropdown filters
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const isDeleted = !!u.deleted_at
      if (!showInactive && isDeleted) return false

      // Apply cascading dropdown filters
      if (filterDept !== "all" && u.user_departement !== filterDept) return false
      if (filterSite !== "all" && u.user_site !== filterSite) return false
      if (filterDiv !== "all" && u.user_division !== filterDiv) return false
      if (filterTeam !== "all" && u.user_team !== filterTeam) return false
      if (filterUnit !== "all" && u.user_unit !== filterUnit) return false

      const q = searchQuery.toLowerCase()
      return (
        (u.user_name || "").toLowerCase().includes(q) ||
        u.user_email.toLowerCase().includes(q) ||
        (u.user_occupation || "").toLowerCase().includes(q) ||
        (u.user_departement || "").toLowerCase().includes(q) ||
        (u.user_division || "").toLowerCase().includes(q) ||
        (u.user_site || "").toLowerCase().includes(q) ||
        (u.user_team || "").toLowerCase().includes(q) ||
        (u.user_unit || "").toLowerCase().includes(q)
      )
    })
  }, [users, showInactive, filterDept, filterSite, filterDiv, filterTeam, filterUnit, searchQuery])

  // Open edit modal for user
  const handleEditUserClick = (user: UserProfile) => {
    setEditingUser({ ...user })
    setCustomOccupation("")
    // If the occupation is not in role levels and is not empty, set custom active
    const isKnown = roleLevels.some((r) => r.role_name.toLowerCase() === (user.user_occupation || "").toLowerCase()) || ["super user", "co - super user"].includes((user.user_occupation || "").toLowerCase())
    setIsCustomOccActive(!!user.user_occupation && !isKnown)

    // Reset cascading dropdown custom flags
    setIsCustomDeptActive(false)
    setIsCustomSiteActive(false)
    setIsCustomDivActive(false)
    setIsCustomTeamActive(false)
    setIsCustomUnitActive(false)
  }

  // Save User Edit
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const finalOccupation = isCustomOccActive ? customOccupation : editingUser.user_occupation

    const payload = {
      user_name: editingUser.user_name,
      user_email: editingUser.user_email,
      user_occupation: finalOccupation,
      user_departement: editingUser.user_departement,
      user_division: editingUser.user_division,
      user_site: editingUser.user_site,
      user_team: editingUser.user_team,
      user_unit: editingUser.user_unit,
      isActive: !editingUser.deleted_at,
    }

    try {
      const res = await fetch(`/api/users/${editingUser.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to update user")
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === editingUser.user_id
            ? { ...u, ...payload, user_occupation: finalOccupation, deleted_at: editingUser.deleted_at }
            : u
        )
      )

      triggerNotice("success", `Successfully updated user profile for ${editingUser.user_name || editingUser.user_email}.`)
      setEditingUser(null)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  // Create User Submission
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.user_email || !newUser.user_email.trim()) {
      triggerNotice("error", "Email address is required.")
      return
    }

    const finalOccupation = isNewOccCustom ? newCustomOcc : newUser.user_occupation

    const payload = {
      user_name: newUser.user_name || null,
      user_email: newUser.user_email.trim(),
      user_occupation: finalOccupation || null,
      user_departement: newUser.user_departement || null,
      user_division: newUser.user_division || null,
      user_site: newUser.user_site || null,
      user_team: newUser.user_team || null,
      user_unit: newUser.user_unit || null,
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to create user")
      }

      const resData = await res.json()
      const createdUser = resData.user

      // Update local state by appending the new user
      setUsers((prev) => [...prev, createdUser])

      triggerNotice("success", `Successfully created new user: ${createdUser.user_name || createdUser.user_email}.`)
      
      // Reset form & close dialog
      setIsCreateDialogOpen(false)
      setNewUser({
        user_name: "",
        user_email: "",
        user_occupation: "",
        user_departement: null,
        user_site: null,
        user_division: null,
        user_team: null,
        user_unit: null,
      })
      setIsNewOccCustom(false)
      setNewCustomOcc("")
      setIsNewDeptCustom(false)
      setIsNewSiteCustom(false)
      setIsNewDivCustom(false)
      setIsNewTeamCustom(false)
      setIsNewUnitCustom(false)

      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  // Create Role level mapping
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

      const data = await res.json()
      
      // Update local state
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

  // Update existing role level mapping
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

  // Delete role mapping
  const handleDeleteRole = async (roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role level mapping for "${roleName}"? Users with this occupation will default to Staff (Level 1) privileges.`)) {
      return
    }

    try {
      const res = await fetch(`/api/settings/roles?role_name=${encodeURIComponent(roleName)}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to delete role")
      }

      setRoleLevels((prev) => prev.filter((r) => r.role_name !== roleName))
      triggerNotice("success", `Deleted role mapping for "${roleName}".`)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  return (
    <div className={density === "compact" ? "space-y-4" : "space-y-6"}>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Users & Roles Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage corporate user directories, assign departments, sites, divisions, and define access control levels.
        </p>
      </div>

      {/* Floating Notification */}
      {notice && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl border p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400"
              : "bg-destructive/5 border-destructive/20 text-destructive dark:bg-destructive/10 dark:border-destructive/20"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-medium">{notice.message}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          User Directory
        </button>
        <button
          onClick={() => setActiveTab("tree")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "tree"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Organizational Tree
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" />
          Role Access Levels
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Audit Logs
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Search Controls */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, role, site, department, or division..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-inactive"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer font-medium select-none">
                Show Inactive Users
              </Label>
            </div>
            {(callerIsSU || callerIsCOSU) && (
              <Button
                onClick={() => {
                  setNewUser({
                    user_name: "",
                    user_email: "",
                    user_occupation: "",
                    user_departement: null,
                    user_site: null,
                    user_division: null,
                    user_team: null,
                    user_unit: null,
                  })
                  setIsNewOccCustom(false)
                  setNewCustomOcc("")
                  setIsNewDeptCustom(false)
                  setIsNewSiteCustom(false)
                  setIsNewDivCustom(false)
                  setIsNewTeamCustom(false)
                  setIsNewUnitCustom(false)
                  setIsCreateDialogOpen(true)
                }}
                className="md:ml-auto gap-1.5 h-10 px-4"
              >
                <Plus className="h-4 w-4" />
                Add New User
              </Button>
            )}
          </div>

          {/* Cascading Org Unit Filters */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border bg-muted/25 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Filter by Corporate Structure
              </span>
              {(filterDept !== "all" || filterSite !== "all" || filterDiv !== "all" || filterTeam !== "all" || filterUnit !== "all") && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setFilterDept("all")
                    setFilterSite("all")
                    setFilterDiv("all")
                    setFilterTeam("all")
                    setFilterUnit("all")
                  }}
                  className="text-xs font-medium h-7 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Reset Filters
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Department */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Department</Label>
                <Select
                  value={filterDept}
                  onValueChange={(val) => {
                    setFilterDept(val)
                    setFilterSite("all")
                    setFilterDiv("all")
                    setFilterTeam("all")
                    setFilterUnit("all")
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {filterDeptOptions.map((d: string) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Site */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Site Location</Label>
                <Select
                  value={filterSite}
                  onValueChange={(val) => {
                    setFilterSite(val)
                    setFilterDiv("all")
                    setFilterTeam("all")
                    setFilterUnit("all")
                  }}
                  disabled={filterDept === "all"}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder={filterDept === "all" ? "Select Dept First" : "All Sites"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {filterSiteOptions.map((s: string) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Division */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Division</Label>
                <Select
                  value={filterDiv}
                  onValueChange={(val) => {
                    setFilterDiv(val)
                    setFilterTeam("all")
                    setFilterUnit("all")
                  }}
                  disabled={filterSite === "all"}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder={filterSite === "all" ? "Select Site First" : "All Divisions"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {filterDivOptions.map((d: string) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Team</Label>
                <Select
                  value={filterTeam}
                  onValueChange={(val) => {
                    setFilterTeam(val)
                    setFilterUnit("all")
                  }}
                  disabled={filterDiv === "all"}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder={filterDiv === "all" ? "Select Div First" : "All Teams"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {filterTeamOptions.map((t: string) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Unit</Label>
                <Select
                  value={filterUnit}
                  onValueChange={(val) => setFilterUnit(val)}
                  disabled={filterTeam === "all"}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder={filterTeam === "all" ? "Select Team First" : "All Units"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    {filterUnitOptions.map((u: string) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Users Directory Table */}
          <Card className="overflow-hidden border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-4 font-medium">User Profile</th>
                      <th className="p-4 font-medium">Occupation (Level)</th>
                      <th className="p-4 font-medium">Site & Department</th>
                      <th className="p-4 font-medium">Division, Team & Unit</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isUserAdmin = ["super user", "co - super user"].includes((u.user_occupation || "").toLowerCase())
                        const userLevel = isUserAdmin 
                          ? 7 
                          : (roleLevels.find((r) => r.role_name.toLowerCase() === (u.user_occupation || "").toLowerCase())?.level || 1)

                        const targetIsSU = isSuperUser(u.user_occupation)
                        const targetIsCOSU = isCoSuperUser(u.user_occupation)
                        const canEdit = !targetIsSU && (!targetIsCOSU || callerIsSU)

                        return (
                          <tr key={u.user_id} className="hover:bg-muted/10 transition-colors">
                            {/* User details */}
                            <td className="p-4">
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
                            </td>
                            {/* Occupation (Level) */}
                            <td className="p-4">
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
                            </td>
                            {/* Site & Department */}
                            <td className="p-4">
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
                            </td>
                            {/* Division & Team */}
                            <td className="p-4">
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
                            </td>
                            {/* Edit & Impersonate Action */}
                            <td className="p-4 text-right">
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
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "tree" && (
        <OrgTreeGraph
          users={users}
          roleLevels={roleLevels}
          currentUserId={currentUserId}
          currentUserOccupation={currentUserOccupation}
          currentUserEmail={currentUserEmail}
          realUserEmail={realUserEmail}
          onUsersUpdate={setUsers}
          triggerNotice={triggerNotice}
          onEditUser={handleEditUserClick}
          onImpersonateUser={handleImpersonateClick}
          startTransition={startTransition}
        />
      )}

      {activeTab === "roles" && (
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-4 font-medium">Role / Occupation Name</th>
                      <th className="p-4 font-medium">Access Level</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {/* Locked Administrative Roles */}
                    {["Super User", "CO - Super User"].map((adminRole) => (
                      <tr key={adminRole} className="bg-violet-50/5 hover:bg-violet-50/10 transition-colors">
                        <td className="p-4 font-medium text-violet-700 dark:text-violet-400">
                          {adminRole}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/20 px-2 py-1 text-xs font-bold text-violet-700 dark:text-violet-400">
                            Level 7 ({adminRole === "Super User" ? "Super User" : "CO - Super User"})
                          </span>
                        </td>
                        <td className="p-4 text-right text-xs text-muted-foreground font-medium">
                          System Locked
                        </td>
                      </tr>
                    ))}

                    {/* Mapped roles */}
                    {roleLevels
                      .filter((r) => !["super user", "co - super user"].includes(r.role_name.toLowerCase()))
                      .map((r) => {
                        const isDefaultRole = ["direktur", "site manager", "site admin", "div manager", "div admin", "supervisor", "team leader", "staff"].includes(r.role_name.toLowerCase())
                        return (
                        <tr key={r.role_name} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4 font-medium">{r.role_name}</td>
                          <td className="p-4">
                            <div className="w-[120px]">
                              <Select
                                value={String(r.level)}
                                onValueChange={(val) => handleUpdateRoleLevel(r.role_name, parseInt(val, 10))}
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
                          </td>
                          <td className="p-4 text-right">
                            {!isDefaultRole && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => handleDeleteRole(r.role_name)}
                                title="Delete role level mapping"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isDefaultRole && (
                              <span className="text-xs text-muted-foreground">Default Role</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
      )}

      {activeTab === "logs" && (
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Audit Logs & Activity History
              </CardTitle>
              <CardDescription>
                Real-time history of user profile updates, role reassignments, and active/inactive status changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground italic text-sm">
                  No activity logs found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-muted">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-muted bg-muted/40 font-semibold text-muted-foreground">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Actor (Admin)</th>
                        <th className="p-3">Target User</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Details of Changes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted">
                      {userLogs.map((log) => {
                        const formattedDate = new Date(log.created_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                        
                        let actionBadgeColor = "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        if (log.action === "ACTIVATE") {
                          actionBadgeColor = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        } else if (log.action === "DEACTIVATE") {
                          actionBadgeColor = "bg-red-500/10 text-red-700 dark:text-red-400"
                        }

                        const changeList = log.details ? log.details.split("; ") : []

                        return (
                          <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3 whitespace-nowrap text-muted-foreground">{formattedDate}</td>
                            <td className="p-3">
                              <div className="font-semibold">{log.actor_name || "System"}</div>
                              <div className="text-[10px] text-muted-foreground">{log.actor_email || ""}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold">{log.target_name || "Unknown"}</div>
                              <div className="text-[10px] text-muted-foreground">{log.target_email || ""}</div>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${actionBadgeColor}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1 max-w-md">
                                {changeList.map((change, i) => (
                                  <div key={i} className="text-foreground font-medium bg-muted/30 px-2 py-0.5 rounded border border-muted/50 w-fit text-[10px]">
                                    {change}
                                  </div>
                                ))}
                                {changeList.length === 0 && (
                                  <span className="text-muted-foreground italic">No details recorded</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Editing Side Dialog */}
      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        {editingUser && (() => {
          const editingTargetIsSU = isSuperUser(editingUser.user_occupation);
          const editingTargetIsCOSU = isCoSuperUser(editingUser.user_occupation);
          const drawerCanEdit = !editingTargetIsSU && (!editingTargetIsCOSU || callerIsSU);

          return (
            <DialogContent className="sm:max-w-[480px]">
              <form onSubmit={handleSaveUser}>
                <DialogHeader>
                  <DialogTitle>Edit User Profile</DialogTitle>
                  <DialogDescription>
                    Modify corporate parameters for {editingUser.user_email}.
                    {!drawerCanEdit && (
                      <span className="block mt-1 text-xs font-semibold text-destructive">
                        This profile is locked and cannot be edited.
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name" className="text-xs">Display Name</Label>
                    <Input
                      id="edit-name"
                      value={editingUser.user_name || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, user_name: e.target.value })}
                      placeholder="User Display Name"
                      disabled={!drawerCanEdit}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="text-xs">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingUser.user_email || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, user_email: e.target.value })}
                      placeholder="User Email Address"
                      required
                      disabled={!drawerCanEdit}
                    />
                  </div>

                  {/* Organization Hierarchy Cascading Dropdowns */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Department */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Department</Label>
                      {isCustomDeptActive ? (
                        <div className="flex gap-1.5 items-center">
                          <Input
                            value={editingUser.user_departement || ""}
                            onChange={(e) => setEditingUser({ ...editingUser, user_departement: e.target.value || null })}
                            placeholder="Type new department..."
                            className="h-9"
                            disabled={!drawerCanEdit}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setIsCustomDeptActive(false);
                              setEditingUser({ ...editingUser, user_departement: null });
                            }}
                            disabled={!drawerCanEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={editingUser.user_departement || "__unassigned__"}
                          onValueChange={(val) => {
                            if (val === "__custom__") {
                              setIsCustomDeptActive(true);
                              setEditingUser({ 
                                ...editingUser, 
                                user_departement: "",
                                user_site: null,
                                user_division: null,
                                user_team: null 
                              });
                            } else {
                              const deptVal = val === "__unassigned__" ? null : val;
                              setEditingUser({ 
                                ...editingUser, 
                                user_departement: deptVal,
                                user_site: null,
                                user_division: null,
                                user_team: null 
                              });
                            }
                          }}
                          disabled={!drawerCanEdit}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Department..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassigned__">Unassigned Department</SelectItem>
                            {existingDepts.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="font-semibold text-primary">
                              + Add New Department
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Site Location */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Site Location</Label>
                      {isCustomSiteActive ? (
                        <div className="flex gap-1.5 items-center">
                          <Input
                            value={editingUser.user_site || ""}
                            onChange={(e) => setEditingUser({ ...editingUser, user_site: e.target.value || null })}
                            placeholder="Type new site..."
                            className="h-9"
                            disabled={!drawerCanEdit}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setIsCustomSiteActive(false);
                              setEditingUser({ ...editingUser, user_site: null });
                            }}
                            disabled={!drawerCanEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={editingUser.user_site || "__unassigned__"}
                          onValueChange={(val) => {
                            if (val === "__custom__") {
                              setIsCustomSiteActive(true);
                              setEditingUser({ 
                                ...editingUser, 
                                user_site: "",
                                user_division: null,
                                user_team: null 
                              });
                            } else {
                              const siteVal = val === "__unassigned__" ? null : val;
                              setEditingUser({ 
                                ...editingUser, 
                                user_site: siteVal,
                                user_division: null,
                                user_team: null 
                              });
                            }
                          }}
                          disabled={!drawerCanEdit || !editingUser.user_departement}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={editingUser.user_departement ? "Select Site..." : "Select Dept first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassigned__">Unassigned Site</SelectItem>
                            {getExistingSites(editingUser.user_departement).map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="font-semibold text-primary">
                              + Add New Site
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Division */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Division</Label>
                      {isCustomDivActive ? (
                        <div className="flex gap-1.5 items-center">
                          <Input
                            value={editingUser.user_division || ""}
                            onChange={(e) => setEditingUser({ ...editingUser, user_division: e.target.value || null })}
                            placeholder="Type new division..."
                            className="h-9"
                            disabled={!drawerCanEdit}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setIsCustomDivActive(false);
                              setEditingUser({ ...editingUser, user_division: null });
                            }}
                            disabled={!drawerCanEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={editingUser.user_division || "__unassigned__"}
                          onValueChange={(val) => {
                            if (val === "__custom__") {
                              setIsCustomDivActive(true);
                              setEditingUser({ 
                                ...editingUser, 
                                user_division: "",
                                user_team: null 
                              });
                            } else {
                              const divVal = val === "__unassigned__" ? null : val;
                              setEditingUser({ 
                                ...editingUser, 
                                user_division: divVal,
                                user_team: null 
                              });
                            }
                          }}
                          disabled={!drawerCanEdit || !editingUser.user_site}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={editingUser.user_site ? "Select Division..." : "Select Site first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassigned__">Unassigned Division</SelectItem>
                            {getExistingDivs(editingUser.user_departement, editingUser.user_site).map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="font-semibold text-primary">
                              + Add New Division
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Team Name */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Team Name</Label>
                      {isCustomTeamActive ? (
                        <div className="flex gap-1.5 items-center">
                          <Input
                            value={editingUser.user_team || ""}
                            onChange={(e) => setEditingUser({ ...editingUser, user_team: e.target.value || null, user_unit: null })}
                            placeholder="Type new team..."
                            className="h-9"
                            disabled={!drawerCanEdit}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setIsCustomTeamActive(false);
                              setEditingUser({ ...editingUser, user_team: null, user_unit: null });
                            }}
                            disabled={!drawerCanEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={editingUser.user_team || "__unassigned__"}
                          onValueChange={(val) => {
                            if (val === "__custom__") {
                              setIsCustomTeamActive(true);
                              setEditingUser({ ...editingUser, user_team: "", user_unit: null });
                            } else {
                              const teamVal = val === "__unassigned__" ? null : val;
                              setEditingUser({ ...editingUser, user_team: teamVal, user_unit: null });
                            }
                          }}
                          disabled={!drawerCanEdit || !editingUser.user_division}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={editingUser.user_division ? "Select Team..." : "Select Division first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassigned__">Unassigned Team</SelectItem>
                            {getExistingTeams(editingUser.user_departement, editingUser.user_site, editingUser.user_division).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="font-semibold text-primary">
                              + Add New Team
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Unit Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Unit Name</Label>
                      {isCustomUnitActive ? (
                        <div className="flex gap-1.5 items-center">
                          <Input
                            value={editingUser.user_unit || ""}
                            onChange={(e) => setEditingUser({ ...editingUser, user_unit: e.target.value || null })}
                            placeholder="Type new unit..."
                            className="h-9"
                            disabled={!drawerCanEdit}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setIsCustomUnitActive(false);
                              setEditingUser({ ...editingUser, user_unit: null });
                            }}
                            disabled={!drawerCanEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={editingUser.user_unit || "__unassigned__"}
                          onValueChange={(val) => {
                            if (val === "__custom__") {
                              setIsCustomUnitActive(true);
                              setEditingUser({ ...editingUser, user_unit: "" });
                            } else {
                              const unitVal = val === "__unassigned__" ? null : val;
                              setEditingUser({ ...editingUser, user_unit: unitVal });
                            }
                          }}
                          disabled={!drawerCanEdit || !editingUser.user_team}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={editingUser.user_team ? "Select Unit..." : "Select Team first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassigned__">Unassigned Unit</SelectItem>
                            {getExistingUnits(editingUser.user_departement, editingUser.user_site, editingUser.user_division, editingUser.user_team).map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="font-semibold text-primary">
                              + Add New Unit
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Occupation Select Dropdown */}
                  <div className="space-y-1.5 border-t pt-3">
                    <Label className="text-xs font-semibold text-foreground block mb-1">Occupation / Role Assignment</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select
                          value={isCustomOccActive ? "custom" : (editingUser.user_occupation || "")}
                          onValueChange={(val) => {
                            if (val === "custom") {
                              setIsCustomOccActive(true)
                            } else {
                              setIsCustomOccActive(false)
                              setEditingUser({ ...editingUser, user_occupation: val || null })
                            }
                          }}
                          disabled={!drawerCanEdit}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select occupation..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Staff / Unmapped (Level 1)</SelectItem>
                            {/* Only Super User caller can assign Super User or CO - Super User */}
                            {callerIsSU && (
                              <>
                                <SelectItem value="Super User">Super User (Level 7)</SelectItem>
                                <SelectItem value="CO - Super User">CO - Super User (Level 7)</SelectItem>
                              </>
                            )}
                            {selectableRoleLevels.map((r) => (
                              <SelectItem key={r.role_name} value={r.role_name}>
                                {r.role_name} (Level {r.level})
                              </SelectItem>
                            ))}
                            <SelectItem value="custom" className="font-semibold text-primary">
                              + Other (Type Custom Role...)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isCustomOccActive && (
                      <div className="mt-2.5 p-3 rounded-lg border bg-muted/20 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Label htmlFor="custom-occ" className="text-xs font-medium text-primary">Enter Custom Role Title</Label>
                        <div className="flex gap-2">
                          <Input
                            id="custom-occ"
                            value={customOccupation}
                            onChange={(e) => setCustomOccupation(e.target.value)}
                            placeholder="e.g., Project Accountant"
                            className="h-9"
                            required={isCustomOccActive}
                            disabled={!drawerCanEdit}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setIsCustomOccActive(false)
                              setCustomOccupation("")
                            }}
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                            disabled={!drawerCanEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Note: You can configure the level for this new role under the "Role Access Levels" tab after saving.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active / Inactive Status Toggle */}
                  <div className="space-y-1.5 border-t pt-3">
                    <Label className="text-xs font-semibold text-foreground block mb-1">User Status</Label>
                    <Select
                      value={editingUser.deleted_at ? "inactive" : "active"}
                      onValueChange={(val) => {
                        setEditingUser({
                          ...editingUser,
                          deleted_at: val === "inactive" ? new Date().toISOString() : null
                        })
                      }}
                      disabled={!drawerCanEdit}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingUser(null)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending || !drawerCanEdit} className="gap-1.5">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* Add New User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && setIsCreateDialogOpen(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account and assign corporate hierarchy parameters.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              {/* Display Name */}
              <div className="space-y-1.5">
                <Label htmlFor="create-name" className="text-xs">Display Name</Label>
                <Input
                  id="create-name"
                  value={newUser.user_name || ""}
                  onChange={(e) => setNewUser({ ...newUser, user_name: e.target.value })}
                  placeholder="e.g., Jane Doe"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="create-email" className="text-xs">Email Address *</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={newUser.user_email || ""}
                  onChange={(e) => setNewUser({ ...newUser, user_email: e.target.value })}
                  placeholder="e.g., jane.doe@multidayamitra.co.id"
                  required
                />
              </div>

              {/* Organization Hierarchy Cascading Dropdowns */}
              <div className="grid grid-cols-2 gap-4">
                {/* Department */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Department</Label>
                  {isNewDeptCustom ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={newUser.user_departement || ""}
                        onChange={(e) => setNewUser({ ...newUser, user_departement: e.target.value || null })}
                        placeholder="New department..."
                        className="h-9"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => {
                          setIsNewDeptCustom(false);
                          setNewUser({ ...newUser, user_departement: null });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={newUser.user_departement || "__unassigned__"}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setIsNewDeptCustom(true);
                          setNewUser({ 
                            ...newUser, 
                            user_departement: "",
                            user_site: null,
                            user_division: null,
                            user_team: null,
                            user_unit: null
                          });
                        } else {
                          const deptVal = val === "__unassigned__" ? null : val;
                          setNewUser({ 
                            ...newUser, 
                            user_departement: deptVal,
                            user_site: null,
                            user_division: null,
                            user_team: null,
                            user_unit: null
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Department..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned Department</SelectItem>
                        {existingDepts.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="font-semibold text-primary">
                          + Add New Department
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Site Location */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Site Location</Label>
                  {isNewSiteCustom ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={newUser.user_site || ""}
                        onChange={(e) => setNewUser({ ...newUser, user_site: e.target.value || null })}
                        placeholder="New site..."
                        className="h-9"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => {
                          setIsNewSiteCustom(false);
                          setNewUser({ ...newUser, user_site: null });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={newUser.user_site || "__unassigned__"}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setIsNewSiteCustom(true);
                          setNewUser({ 
                            ...newUser, 
                            user_site: "",
                            user_division: null,
                            user_team: null,
                            user_unit: null
                          });
                        } else {
                          const siteVal = val === "__unassigned__" ? null : val;
                          setNewUser({ 
                            ...newUser, 
                            user_site: siteVal,
                            user_division: null,
                            user_team: null,
                            user_unit: null
                          });
                        }
                      }}
                      disabled={!newUser.user_departement}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={newUser.user_departement ? "Select Site..." : "Select Dept first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned Site</SelectItem>
                        {getExistingSites(newUser.user_departement).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="font-semibold text-primary">
                          + Add New Site
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Division */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Division</Label>
                  {isNewDivCustom ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={newUser.user_division || ""}
                        onChange={(e) => setNewUser({ ...newUser, user_division: e.target.value || null })}
                        placeholder="New division..."
                        className="h-9"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => {
                          setIsNewDivCustom(false);
                          setNewUser({ ...newUser, user_division: null });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={newUser.user_division || "__unassigned__"}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setIsNewDivCustom(true);
                          setNewUser({ 
                            ...newUser, 
                            user_division: "",
                            user_team: null,
                            user_unit: null
                          });
                        } else {
                          const divVal = val === "__unassigned__" ? null : val;
                          setNewUser({ 
                            ...newUser, 
                            user_division: divVal,
                            user_team: null,
                            user_unit: null
                          });
                        }
                      }}
                      disabled={!newUser.user_site}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={newUser.user_site ? "Select Division..." : "Select Site first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned Division</SelectItem>
                        {getExistingDivs(newUser.user_departement, newUser.user_site).map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="font-semibold text-primary">
                          + Add New Division
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Team Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Team Name</Label>
                  {isNewTeamCustom ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={newUser.user_team || ""}
                        onChange={(e) => setNewUser({ ...newUser, user_team: e.target.value || null, user_unit: null })}
                        placeholder="New team..."
                        className="h-9"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => {
                          setIsNewTeamCustom(false);
                          setNewUser({ ...newUser, user_team: null, user_unit: null });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={newUser.user_team || "__unassigned__"}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setIsNewTeamCustom(true);
                          setNewUser({ ...newUser, user_team: "", user_unit: null });
                        } else {
                          const teamVal = val === "__unassigned__" ? null : val;
                          setNewUser({ ...newUser, user_team: teamVal, user_unit: null });
                        }
                      }}
                      disabled={!newUser.user_division}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={newUser.user_division ? "Select Team..." : "Select Division first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned Team</SelectItem>
                        {getExistingTeams(newUser.user_departement, newUser.user_site, newUser.user_division).map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="font-semibold text-primary">
                          + Add New Team
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Unit Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit Name</Label>
                  {isNewUnitCustom ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={newUser.user_unit || ""}
                        onChange={(e) => setNewUser({ ...newUser, user_unit: e.target.value || null })}
                        placeholder="New unit..."
                        className="h-9"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => {
                          setIsNewUnitCustom(false);
                          setNewUser({ ...newUser, user_unit: null });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={newUser.user_unit || "__unassigned__"}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setIsNewUnitCustom(true);
                          setNewUser({ ...newUser, user_unit: "" });
                        } else {
                          const unitVal = val === "__unassigned__" ? null : val;
                          setNewUser({ ...newUser, user_unit: unitVal });
                        }
                      }}
                      disabled={!newUser.user_team}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={newUser.user_team ? "Select Unit..." : "Select Team first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned Unit</SelectItem>
                        {getExistingUnits(newUser.user_departement, newUser.user_site, newUser.user_division, newUser.user_team).map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="font-semibold text-primary">
                          + Add New Unit
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Occupation Select Dropdown */}
              <div className="space-y-1.5 border-t pt-3">
                <Label className="text-xs font-semibold text-foreground block mb-1">Occupation / Role Assignment</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={isNewOccCustom ? "custom" : (newUser.user_occupation || "")}
                      onValueChange={(val) => {
                        if (val === "custom") {
                          setIsNewOccCustom(true)
                        } else {
                          setIsNewOccCustom(false)
                          setNewUser({ ...newUser, user_occupation: val || null })
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select occupation..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Staff / Unmapped (Level 1)</SelectItem>
                        {/* Only Super User caller can assign Super User or CO - Super User */}
                        {callerIsSU && (
                          <>
                            <SelectItem value="Super User">Super User (Level 7)</SelectItem>
                            <SelectItem value="CO - Super User">CO - Super User (Level 7)</SelectItem>
                          </>
                        )}
                        {selectableRoleLevels.map((r) => (
                          <SelectItem key={r.role_name} value={r.role_name}>
                            {r.role_name} (Level {r.level})
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="font-semibold text-primary">
                          + Other (Type Custom Role...)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isNewOccCustom && (
                  <div className="mt-2.5 p-3 rounded-lg border bg-muted/20 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="new-custom-occ" className="text-xs font-medium text-primary">Enter Custom Role Title</Label>
                    <div className="flex gap-2">
                      <Input
                        id="new-custom-occ"
                        value={newCustomOcc}
                        onChange={(e) => setNewCustomOcc(e.target.value)}
                        placeholder="e.g., Project Accountant"
                        className="h-9"
                        required={isNewOccCustom}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsNewOccCustom(false)
                          setNewCustomOcc("")
                        }}
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
