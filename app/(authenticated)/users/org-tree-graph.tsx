"use client"

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { 
  Building, 
  MapPin, 
  GitBranch, 
  Users, 
  Shield, 
  FolderOpen,
  HelpCircle,
  Plus,
  Pencil,
  Eye,
  Trash2
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
  level?: number
}

interface RoleLevel {
  role_name: string
  level: number
}

interface OrgTreeGraphProps {
  users: UserProfile[]
  roleLevels: RoleLevel[]
  currentUserId: string
  currentUserOccupation: string | null
  currentUserEmail: string
  realUserEmail?: string
  onUsersUpdate: (updatedUsers: UserProfile[]) => void
  triggerNotice: (type: "success" | "error", message: string) => void
  onEditUser?: (user: UserProfile) => void
  onImpersonateUser?: (userId: string) => void
  startTransition?: React.TransitionStartFunction
}

// Check if caller is Admin (Super User or Co-Super User)
const isSuperUser = (occ: string | null | undefined) => {
  if (!occ) return false
  const o = occ.toLowerCase().replace(/\s+/g, "")
  return o === "superuser"
}

const isCoSuperUser = (occ: string | null | undefined) => {
  if (!occ) return false
  const o = occ.toLowerCase().replace(/\s+/g, "")
  return o === "cosuperuser" || o === "co-superuser"
}

export function OrgTreeGraph({
  users,
  roleLevels,
  currentUserId,
  currentUserOccupation,
  currentUserEmail,
  realUserEmail,
  onUsersUpdate,
  triggerNotice,
  onEditUser,
  onImpersonateUser,
  startTransition: parentStartTransition,
}: OrgTreeGraphProps) {
  const router = useRouter()
  const [isTransitionPending, localStartTransition] = useTransition()
  const startTransition = parentStartTransition || localStartTransition
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null)
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null)

  // Local state for empty custom nodes
  const [customDepts, setCustomDepts] = useState<string[]>([])
  const [customSites, setCustomSites] = useState<Record<string, string[]>>({})
  const [customDivs, setCustomDivs] = useState<Record<string, string[]>>({})
  const [customTeams, setCustomTeams] = useState<Record<string, string[]>>({})
  const [customUnits, setCustomUnits] = useState<Record<string, string[]>>({})

  // Modal State for node creation
  const [createModal, setCreateModal] = useState<{
    type: "dept" | "site" | "div" | "team" | "unit" | null
    parentDept: string | null
    parentSite: string | null
    parentDiv: string | null
    parentTeam: string | null
    inputValue: string
  }>({
    type: null,
    parentDept: null,
    parentSite: null,
    parentDiv: null,
    parentTeam: null,
    inputValue: "",
  })

  // Modal State for node deletion confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "dept" | "site" | "div" | "team" | "unit" | null
    dept: string | null
    site: string | null
    div: string | null
    team: string | null
    unit: string | null
    affectedUserCount: number
    affectedUserIds: string[]
  }>({
    type: null,
    dept: null,
    site: null,
    div: null,
    team: null,
    unit: null,
    affectedUserCount: 0,
    affectedUserIds: [],
  })

  // State for inline node renaming (double click)
  const [editingNode, setEditingNode] = useState<{
    type: "dept" | "site" | "div" | "team" | "unit"
    oldName: string
    dept: string | null
    site: string | null
    div: string | null
    team: string | null
    inputValue: string
  } | null>(null)

  // Refs and state for drag auto-scrolling
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const verticalScrollSpeed = useRef(0)
  const horizontalScrollSpeed = useRef(0)
  const animationFrameId = useRef<number | null>(null)

  // Drag auto-scroll animation loop
  useEffect(() => {
    if (draggedUserId === null) {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
        animationFrameId.current = null
      }
      verticalScrollSpeed.current = 0
      horizontalScrollSpeed.current = 0
      return
    }

    const scrollLoop = () => {
      // Scroll window vertically
      if (verticalScrollSpeed.current !== 0) {
        window.scrollBy(0, verticalScrollSpeed.current)
      }

      // Scroll tree container horizontally
      if (horizontalScrollSpeed.current !== 0 && treeContainerRef.current) {
        treeContainerRef.current.scrollBy(horizontalScrollSpeed.current, 0)
      }

      animationFrameId.current = requestAnimationFrame(scrollLoop)
    }

    animationFrameId.current = requestAnimationFrame(scrollLoop)

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [draggedUserId])

  // Track global drag position to calculate scroll speeds
  const handleGlobalDragOver = (e: React.DragEvent) => {
    if (!callerIsAdmin || !draggedUserId) return

    const clientX = e.clientX
    const clientY = e.clientY
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const threshold = 80
    const speedMax = 15

    // 1. Vertical Scrolling (Window)
    if (clientY > viewportHeight - threshold) {
      const ratio = Math.min((clientY - (viewportHeight - threshold)) / threshold, 1)
      verticalScrollSpeed.current = ratio * speedMax
    } else if (clientY < threshold) {
      const ratio = Math.min((threshold - clientY) / threshold, 1)
      verticalScrollSpeed.current = -ratio * speedMax
    } else {
      verticalScrollSpeed.current = 0
    }

    // 2. Horizontal Scrolling (Tree Container)
    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect()
      if (clientX > rect.right - threshold) {
        const ratio = Math.min((clientX - (rect.right - threshold)) / threshold, 1)
        horizontalScrollSpeed.current = ratio * speedMax
      } else if (clientX < rect.left + threshold) {
        const ratio = Math.min((threshold - (clientX - rect.left)) / threshold, 1)
        horizontalScrollSpeed.current = -ratio * speedMax
      } else {
        horizontalScrollSpeed.current = 0
      }
    }
  }

  // Load custom nodes from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const depts = localStorage.getItem("org_custom_depts")
      const sites = localStorage.getItem("org_custom_sites")
      const divs = localStorage.getItem("org_custom_divs")
      const teams = localStorage.getItem("org_custom_teams")
      const units = localStorage.getItem("org_custom_units")
      if (depts) setCustomDepts(JSON.parse(depts))
      if (sites) setCustomSites(JSON.parse(sites))
      if (divs) setCustomDivs(JSON.parse(divs))
      if (teams) setCustomTeams(JSON.parse(teams))
      if (units) setCustomUnits(JSON.parse(units))
    } catch (e) {
      console.error("Failed to load custom org nodes:", e)
    }
  }, [])

  // Helpers to save custom nodes
  const saveDepts = (newDepts: string[]) => {
    setCustomDepts(newDepts)
    localStorage.setItem("org_custom_depts", JSON.stringify(newDepts))
  }

  const saveSites = (newSites: Record<string, string[]>) => {
    setCustomSites(newSites)
    localStorage.setItem("org_custom_sites", JSON.stringify(newSites))
  }

  const saveDivs = (newDivs: Record<string, string[]>) => {
    setCustomDivs(newDivs)
    localStorage.setItem("org_custom_divs", JSON.stringify(newDivs))
  }

  const saveTeams = (newTeams: Record<string, string[]>) => {
    setCustomTeams(newTeams)
    localStorage.setItem("org_custom_teams", JSON.stringify(newTeams))
  }

  const saveUnits = (newUnits: Record<string, string[]>) => {
    setCustomUnits(newUnits)
    localStorage.setItem("org_custom_units", JSON.stringify(newUnits))
  }

  // Resolve user level on the fly
  const getUserLevel = useCallback((occ: string | null | undefined): number => {
    if (!occ) return 1
    const o = occ.toLowerCase().replace(/\s+/g, "")
    if (["superuser", "cosuperuser", "co-superuser"].includes(o)) return 7
    const role = roleLevels.find((r) => r.role_name.toLowerCase() === occ.toLowerCase())
    return role ? role.level : 1
  }, [roleLevels])

  const realEmail = realUserEmail ?? currentUserEmail
  const isSuperUserCaller = realEmail === "gadmin@multidayamitra.co.id"
  const callerIsAdmin = isSuperUserCaller || isSuperUser(currentUserOccupation) || isCoSuperUser(currentUserOccupation)

  // Handle Drag & Drop events
  const handleDragStart = useCallback((e: React.DragEvent, userId: string) => {
    if (!callerIsAdmin) {
      e.preventDefault()
      return
    }
    setDraggedUserId(userId)
    e.dataTransfer.setData("text/plain", userId)
    e.dataTransfer.effectAllowed = "move"
  }, [callerIsAdmin])

  const handleDragEnd = useCallback(() => {
    setDraggedUserId(null)
    setHoveredDropZone(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, zoneId: string) => {
    if (!callerIsAdmin) return
    e.preventDefault()
    setHoveredDropZone(zoneId)
  }, [callerIsAdmin])

  const handleDragLeave = useCallback(() => {
    setHoveredDropZone(null)
  }, [])

  const handleDrop = useCallback(async (
    e: React.DragEvent,
    target: {
      dept: string | null
      site: string | null
      div: string | null
      team: string | null
      unit: string | null
    }
  ) => {
    e.preventDefault()
    setHoveredDropZone(null)
    const userId = e.dataTransfer.getData("text/plain") || draggedUserId
    if (!userId) return

    const targetUser = users.find((u) => u.user_id === userId)
    if (!targetUser) return

    // Prevent dragging locked accounts (other Admins if caller is Co-Super User)
    const targetIsSU = isSuperUser(targetUser.user_occupation)
    const targetIsCOSU = isCoSuperUser(targetUser.user_occupation)
    const canModify = !targetIsSU && (!targetIsCOSU || isSuperUserCaller)

    if (!canModify) {
      triggerNotice("error", "You do not have permission to modify this administrator's penempatan.")
      return
    }

    // Resolve site name: if dropping on a real site, set it. If "__no_site__" or unassigned, set it to null.
    // If dropping on Department, preserve their existing site.
    let targetSite = target.site
    if (target.site === "__no_site__") {
      targetSite = null
    } else if (target.site === null && target.dept !== null) {
      // Preserved site if dropped on Department card directly
      targetSite = targetUser.user_site
    }

    // Prepare payload
    const payload = {
      user_name: targetUser.user_name,
      user_occupation: targetUser.user_occupation,
      user_departement: target.dept,
      user_division: target.div,
      user_site: targetSite,
      user_team: target.team,
      user_unit: target.unit,
    }

    // Optimistic Update
    const originalUsers = [...users]
    const updatedUsers = users.map((u) => 
      u.user_id === userId 
        ? { 
            ...u, 
            user_departement: target.dept, 
            user_division: target.div, 
            user_site: targetSite,
            user_team: target.team,
            user_unit: target.unit
          } 
        : u
    )
    onUsersUpdate(updatedUsers)

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to update user organizational unit")
      }

      // Cleanup virtual nodes from localStorage if dropped into them
      if (target.dept && customDepts.includes(target.dept)) {
        saveDepts(customDepts.filter((d) => d !== target.dept))
      }
      if (target.dept && target.site) {
        const currentSites = customSites[target.dept] || []
        if (currentSites.includes(target.site)) {
          saveSites({
            ...customSites,
            [target.dept]: currentSites.filter((s) => s !== target.site),
          })
        }
      }
      if (target.dept && target.site && target.div) {
        const key = `${target.dept}:${target.site}`
        const currentDivs = customDivs[key] || []
        if (currentDivs.includes(target.div)) {
          saveDivs({
            ...customDivs,
            [key]: currentDivs.filter((d) => d !== target.div),
          })
        }
      }
      if (target.dept && target.site && target.div && target.team) {
        const key = `${target.dept}:${target.site}:${target.div}`
        const currentTeams = customTeams[key] || []
        if (currentTeams.includes(target.team)) {
          saveTeams({
            ...customTeams,
            [key]: currentTeams.filter((t) => t !== target.team),
          })
        }
      }
      if (target.dept && target.site && target.div && target.team && target.unit) {
        const key = `${target.dept}:${target.site}:${target.div}:${target.team}`
        const currentUnits = customUnits[key] || []
        if (currentUnits.includes(target.unit)) {
          saveUnits({
            ...customUnits,
            [key]: currentUnits.filter((u) => u !== target.unit),
          })
        }
      }

      triggerNotice(
        "success", 
        `Successfully moved ${targetUser.user_name || targetUser.user_email} to ${
          target.unit || target.team || target.div || target.site || target.dept || "Unassigned pool"
        }.`
      )
      
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      onUsersUpdate(originalUsers)
      triggerNotice("error", err.message || "An error occurred while moving the user.")
    }
  }, [users, callerIsAdmin, draggedUserId, customDepts, customSites, customDivs, customTeams, customUnits, onUsersUpdate, triggerNotice, startTransition, router, isSuperUserCaller])

  // Handle new node creation
  const handleCreateNode = () => {
    const name = createModal.inputValue.trim()
    if (!name) return

    if (createModal.type === "dept") {
      const dbDepts = Array.from(
        new Set(users.map((u) => u.user_departement).filter(Boolean))
      ) as string[]
      if (dbDepts.includes(name) || customDepts.includes(name)) {
        triggerNotice("error", `Department "${name}" already exists.`)
        return
      }
      saveDepts([...customDepts, name])
      triggerNotice("success", `Department "${name}" added to the tree.`)
    } else if (createModal.type === "site" && createModal.parentDept) {
      const dept = createModal.parentDept
      const deptUsers = users.filter((u) => u.user_departement === dept)
      const dbSites = Array.from(
        new Set(deptUsers.map((u) => u.user_site).filter(Boolean))
      ) as string[]
      const currentSites = customSites[dept] || []
      if (dbSites.includes(name) || currentSites.includes(name)) {
        triggerNotice("error", `Site "${name}" already exists under this department.`)
        return
      }
      saveSites({
        ...customSites,
        [dept]: [...currentSites, name],
      })
      triggerNotice("success", `Site "${name}" added under ${dept}.`)
    } else if (createModal.type === "div" && createModal.parentDept && createModal.parentSite) {
      const dept = createModal.parentDept
      const site = createModal.parentSite
      const key = `${dept}:${site}`
      const siteUsers = users.filter((u) => u.user_departement === dept && u.user_site === site)
      const dbDivs = Array.from(
        new Set(siteUsers.map((u) => u.user_division).filter(Boolean))
      ) as string[]
      const currentDivs = customDivs[key] || []
      if (dbDivs.includes(name) || currentDivs.includes(name)) {
        triggerNotice("error", `Division "${name}" already exists under this site.`)
        return
      }
      saveDivs({
        ...customDivs,
        [key]: [...currentDivs, name],
      })
      triggerNotice("success", `Division "${name}" added under ${site}.`)
    } else if (createModal.type === "team" && createModal.parentDept && createModal.parentSite && createModal.parentDiv) {
      const dept = createModal.parentDept
      const site = createModal.parentSite
      const div = createModal.parentDiv
      const key = `${dept}:${site}:${div}`
      const divUsers = users.filter(
        (u) => u.user_departement === dept && u.user_site === site && u.user_division === div
      )
      const dbTeams = Array.from(
        new Set(divUsers.map((u) => u.user_team).filter(Boolean))
      ) as string[]
      const currentTeams = customTeams[key] || []
      if (dbTeams.includes(name) || currentTeams.includes(name)) {
        triggerNotice("error", `Team "${name}" already exists under this division.`)
        return
      }
      saveTeams({
        ...customTeams,
        [key]: [...currentTeams, name],
      })
      triggerNotice("success", `Team "${name}" added under ${div}.`)
    } else if (createModal.type === "unit" && createModal.parentDept && createModal.parentSite && createModal.parentDiv && createModal.parentTeam) {
      const dept = createModal.parentDept
      const site = createModal.parentSite
      const div = createModal.parentDiv
      const team = createModal.parentTeam
      const key = `${dept}:${site}:${div}:${team}`
      const teamUsers = users.filter(
        (u) => u.user_departement === dept && u.user_site === site && u.user_division === div && u.user_team === team
      )
      const dbUnits = Array.from(
        new Set(teamUsers.map((u) => u.user_unit).filter(Boolean))
      ) as string[]
      const currentUnits = customUnits[key] || []
      if (dbUnits.includes(name) || currentUnits.includes(name)) {
        triggerNotice("error", `Unit "${name}" already exists under this team.`)
        return
      }
      saveUnits({
        ...customUnits,
        [key]: [...currentUnits, name],
      })
      triggerNotice("success", `Unit "${name}" added under ${team}.`)
    }

    setCreateModal({ type: null, parentDept: null, parentSite: null, parentDiv: null, parentTeam: null, inputValue: "" })
  }

  // Handle node deletion click
  const handleDeleteClick = (
    type: "dept" | "site" | "div" | "team" | "unit",
    dept: string | null,
    site: string | null,
    div: string | null,
    team: string | null,
    unit: string | null = null
  ) => {
    let affectedUsers: UserProfile[] = []
    if (type === "dept" && dept) {
      affectedUsers = users.filter((u) => u.user_departement === dept)
    } else if (type === "site" && dept && site) {
      affectedUsers = users.filter((u) => u.user_departement === dept && u.user_site === site)
    } else if (type === "div" && dept && site && div) {
      affectedUsers = users.filter((u) => u.user_departement === dept && u.user_site === site && u.user_division === div)
    } else if (type === "team" && dept && site && div && team) {
      affectedUsers = users.filter(
        (u) => u.user_departement === dept && u.user_site === site && u.user_division === div && u.user_team === team
      )
    } else if (type === "unit" && dept && site && div && team && unit) {
      affectedUsers = users.filter(
        (u) => u.user_departement === dept && u.user_site === site && u.user_division === div && u.user_team === team && u.user_unit === unit
      )
    }

    const count = affectedUsers.length
    const userIds = affectedUsers.map((u) => u.user_id)

    // If it is an empty virtual node, delete it immediately without confirmation
    if (count === 0) {
      executeDeleteNode(type, dept, site, div, team, [], unit)
    } else {
      // Show confirmation dialog for occupied nodes
      setDeleteConfirm({
        type,
        dept,
        site,
        div,
        team,
        unit,
        affectedUserCount: count,
        affectedUserIds: userIds,
      })
    }
  }

  // Execute actual node deletion and user updates
  const executeDeleteNode = async (
    type: "dept" | "site" | "div" | "team" | "unit",
    dept: string | null,
    site: string | null,
    div: string | null,
    team: string | null,
    userIdsToUpdate: string[],
    unit: string | null = null
  ) => {
    // 1. Client-side cleanup of localStorage virtual states
    if (type === "dept" && dept) {
      saveDepts(customDepts.filter((d) => d !== dept))
      // Cleanup child custom sites
      if (customSites[dept]) {
        const nextSites = { ...customSites }
        delete nextSites[dept]
        saveSites(nextSites)
      }
    } else if (type === "site" && dept && site) {
      const currentSites = customSites[dept] || []
      saveSites({
        ...customSites,
        [dept]: currentSites.filter((s) => s !== site),
      })
      const prefix = `${dept}:${site}`
      // Cleanup child custom divisions
      const nextDivs = { ...customDivs }
      let changedDivs = false
      for (const k of Object.keys(nextDivs)) {
        if (k === prefix || k.startsWith(prefix + ":")) {
          delete nextDivs[k]
          changedDivs = true
        }
      }
      if (changedDivs) saveDivs(nextDivs)
    } else if (type === "div" && dept && site && div) {
      const key = `${dept}:${site}`
      const currentDivs = customDivs[key] || []
      saveDivs({
        ...customDivs,
        [key]: currentDivs.filter((d) => d !== div),
      })
      const prefix = `${dept}:${site}:${div}`
      // Cleanup child custom teams
      const nextTeams = { ...customTeams }
      let changedTeams = false
      for (const k of Object.keys(nextTeams)) {
        if (k === prefix || k.startsWith(prefix + ":")) {
          delete nextTeams[k]
          changedTeams = true
        }
      }
      if (changedTeams) saveTeams(nextTeams)
    } else if (type === "team" && dept && site && div && team) {
      const key = `${dept}:${site}:${div}`
      const currentTeams = customTeams[key] || []
      saveTeams({
        ...customTeams,
        [key]: currentTeams.filter((t) => t !== team),
      })
      const prefix = `${dept}:${site}:${div}:${team}`
      // Cleanup child custom units
      const nextUnits = { ...customUnits }
      let changedUnits = false
      for (const k of Object.keys(nextUnits)) {
        if (k === prefix || k.startsWith(prefix + ":")) {
          delete nextUnits[k]
          changedUnits = true
        }
      }
      if (changedUnits) saveUnits(nextUnits)
    } else if (type === "unit" && dept && site && div && team && unit) {
      const key = `${dept}:${site}:${div}:${team}`
      const currentUnits = customUnits[key] || []
      saveUnits({
        ...customUnits,
        [key]: currentUnits.filter((u) => u !== unit),
      })
    }

    // 2. If occupied, bulk-update users in the database
    if (userIdsToUpdate.length > 0) {
      const originalUsers = [...users]
      
      // Optimistic update: clear assignments locally
      const updatedUsers = users.map((u) => {
        if (userIdsToUpdate.includes(u.user_id)) {
          if (type === "dept") {
            return { ...u, user_departement: null, user_site: null, user_division: null, user_team: null, user_unit: null }
          } else if (type === "site") {
            return { ...u, user_site: null, user_division: null, user_team: null, user_unit: null }
          } else if (type === "div") {
            return { ...u, user_division: null, user_team: null, user_unit: null }
          } else if (type === "team") {
            return { ...u, user_team: null, user_unit: null }
          } else if (type === "unit") {
            return { ...u, user_unit: null }
          }
        }
        return u
      })
      onUsersUpdate(updatedUsers)

      try {
        triggerNotice("success", `Deleting node and updating ${userIdsToUpdate.length} staff assignments...`)

        // Update each user in parallel on the backend
        const promises = userIdsToUpdate.map(async (userId) => {
          const targetUser = users.find((u) => u.user_id === userId)
          if (!targetUser) return

          const payload = {
            user_name: targetUser.user_name,
            user_occupation: targetUser.user_occupation,
            user_departement: type === "dept" ? null : targetUser.user_departement,
            user_site: type === "dept" || type === "site" ? null : targetUser.user_site,
            user_division: type === "dept" || type === "site" || type === "div" ? null : targetUser.user_division,
            user_team: type === "dept" || type === "site" || type === "div" || type === "team" ? null : targetUser.user_team,
            user_unit: type === "dept" || type === "site" || type === "div" || type === "team" || type === "unit" ? null : targetUser.user_unit,
          }

          const res = await fetch(`/api/users/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            throw new Error(`Failed to update user ${userId}`)
          }
        })

        await Promise.all(promises)
        triggerNotice("success", `Successfully deleted node and re-assigned staff.`)

        startTransition(() => {
          router.refresh()
        })
      } catch (err: any) {
        onUsersUpdate(originalUsers)
        triggerNotice("error", err.message || "An error occurred while deleting the node.")
      }
    } else {
      triggerNotice("success", `Deleted empty virtual node.`)
    }

    // Close confirmation modal
    setDeleteConfirm({
      type: null,
      dept: null,
      site: null,
      div: null,
      team: null,
      unit: null,
      affectedUserCount: 0,
      affectedUserIds: [],
    })
  }

  // Execute actual node renaming and database/local state updates
  const executeRenameNode = async (
    type: "dept" | "site" | "div" | "team" | "unit",
    oldName: string,
    newName: string,
    context: {
      dept: string | null
      site: string | null
      div: string | null
      team: string | null
    }
  ) => {
    newName = newName.trim()
    if (!newName || newName === oldName) {
      setEditingNode(null)
      return
    }

    // 1. Check for duplicates in existing nodes (database + custom)
    if (type === "dept") {
      const dbDepts = Array.from(new Set(users.map((u) => u.user_departement).filter(Boolean))) as string[]
      if (dbDepts.includes(newName) || customDepts.includes(newName)) {
        triggerNotice("error", `Department "${newName}" already exists.`)
        return
      }
    } else if (type === "site" && context.dept) {
      const dept = context.dept
      const deptUsers = users.filter((u) => u.user_departement === dept)
      const dbSites = Array.from(new Set(deptUsers.map((u) => u.user_site).filter(Boolean))) as string[]
      const currentSites = customSites[dept] || []
      if (dbSites.includes(newName) || currentSites.includes(newName)) {
        triggerNotice("error", `Site "${newName}" already exists under this department.`)
        return
      }
    } else if (type === "div" && context.dept && context.site) {
      const dept = context.dept
      const site = context.site
      const key = `${dept}:${site}`
      const siteUsers = users.filter((u) => u.user_departement === dept && u.user_site === site)
      const dbDivs = Array.from(new Set(siteUsers.map((u) => u.user_division).filter(Boolean))) as string[]
      const currentDivs = customDivs[key] || []
      if (dbDivs.includes(newName) || currentDivs.includes(newName)) {
        triggerNotice("error", `Division "${newName}" already exists under this site.`)
        return
      }
    } else if (type === "team" && context.dept && context.site && context.div) {
      const dept = context.dept
      const site = context.site
      const div = context.div
      const key = `${dept}:${site}:${div}`
      const divUsers = users.filter((u) => u.user_departement === dept && u.user_site === site && u.user_division === div)
      const dbTeams = Array.from(new Set(divUsers.map((u) => u.user_team).filter(Boolean))) as string[]
      const currentTeams = customTeams[key] || []
      if (dbTeams.includes(newName) || currentTeams.includes(newName)) {
        triggerNotice("error", `Team "${newName}" already exists under this division.`)
        return
      }
    } else if (type === "unit" && context.dept && context.site && context.div && context.team) {
      const dept = context.dept
      const site = context.site
      const div = context.div
      const team = context.team
      const key = `${dept}:${site}:${div}:${team}`
      const teamUsers = users.filter((u) => u.user_departement === dept && u.user_site === site && u.user_division === div && u.user_team === team)
      const dbUnits = Array.from(new Set(teamUsers.map((u) => u.user_unit).filter(Boolean))) as string[]
      const currentUnits = customUnits[key] || []
      if (dbUnits.includes(newName) || currentUnits.includes(newName)) {
        triggerNotice("error", `Unit "${newName}" already exists under this team.`)
        return
      }
    }

    // 2. Identify affected users in the database
    let affectedUsers: UserProfile[] = []
    if (type === "dept") {
      affectedUsers = users.filter((u) => u.user_departement === oldName)
    } else if (type === "site" && context.dept) {
      affectedUsers = users.filter((u) => u.user_departement === context.dept && u.user_site === oldName)
    } else if (type === "div" && context.dept && context.site) {
      affectedUsers = users.filter((u) => u.user_departement === context.dept && u.user_site === context.site && u.user_division === oldName)
    } else if (type === "team" && context.dept && context.site && context.div) {
      affectedUsers = users.filter(
        (u) => u.user_departement === context.dept && u.user_site === context.site && u.user_division === context.div && u.user_team === oldName
      )
    } else if (type === "unit" && context.dept && context.site && context.div && context.team) {
      affectedUsers = users.filter(
        (u) => u.user_departement === context.dept && u.user_site === context.site && u.user_division === context.div && u.user_team === context.team && u.user_unit === oldName
      )
    }

    const userIdsToUpdate = affectedUsers.map((u) => u.user_id)

    // 3. Client-side update of localStorage virtual states
    if (type === "dept") {
      if (customDepts.includes(oldName)) {
        saveDepts(customDepts.map((d) => (d === oldName ? newName : d)))
      }
      const nextSites = { ...customSites }
      if (nextSites[oldName]) {
        nextSites[newName] = nextSites[oldName]
        delete nextSites[oldName]
        saveSites(nextSites)
      }
      const nextDivs = { ...customDivs }
      let changedDivs = false
      for (const k of Object.keys(nextDivs)) {
        if (k.startsWith(oldName + ":")) {
          const suffix = k.substring(oldName.length)
          nextDivs[newName + suffix] = nextDivs[k]
          delete nextDivs[k]
          changedDivs = true
        }
      }
      if (changedDivs) saveDivs(nextDivs)
      const nextTeams = { ...customTeams }
      let changedTeams = false
      for (const k of Object.keys(nextTeams)) {
        if (k.startsWith(oldName + ":")) {
          const suffix = k.substring(oldName.length)
          nextTeams[newName + suffix] = nextTeams[k]
          delete nextTeams[k]
          changedTeams = true
        }
      }
      if (changedTeams) saveTeams(nextTeams)
      const nextUnits = { ...customUnits }
      let changedUnits = false
      for (const k of Object.keys(nextUnits)) {
        if (k.startsWith(oldName + ":")) {
          const suffix = k.substring(oldName.length)
          nextUnits[newName + suffix] = nextUnits[k]
          delete nextUnits[k]
          changedUnits = true
        }
      }
      if (changedUnits) saveUnits(nextUnits)

    } else if (type === "site" && context.dept) {
      const dept = context.dept
      if (customSites[dept]) {
        saveSites({
          ...customSites,
          [dept]: customSites[dept].map((s) => (s === oldName ? newName : s)),
        })
      }
      const oldPrefix = `${dept}:${oldName}`
      const newPrefix = `${dept}:${newName}`
      const nextDivs = { ...customDivs }
      if (nextDivs[oldPrefix]) {
        nextDivs[newPrefix] = nextDivs[oldPrefix]
        delete nextDivs[oldPrefix]
        saveDivs(nextDivs)
      }
      const nextTeams = { ...customTeams }
      let changedTeams = false
      for (const k of Object.keys(nextTeams)) {
        if (k.startsWith(oldPrefix + ":")) {
          const suffix = k.substring(oldPrefix.length)
          nextTeams[newPrefix + suffix] = nextTeams[k]
          delete nextTeams[k]
          changedTeams = true
        }
      }
      if (changedTeams) saveTeams(nextTeams)
      const nextUnits = { ...customUnits }
      let changedUnits = false
      for (const k of Object.keys(nextUnits)) {
        if (k.startsWith(oldPrefix + ":")) {
          const suffix = k.substring(oldPrefix.length)
          nextUnits[newPrefix + suffix] = nextUnits[k]
          delete nextUnits[k]
          changedUnits = true
        }
      }
      if (changedUnits) saveUnits(nextUnits)

    } else if (type === "div" && context.dept && context.site) {
      const dept = context.dept
      const site = context.site
      const key = `${dept}:${site}`
      if (customDivs[key]) {
        saveDivs({
          ...customDivs,
          [key]: customDivs[key].map((d) => (d === oldName ? newName : d)),
        })
      }
      const oldPrefix = `${dept}:${site}:${oldName}`
      const newPrefix = `${dept}:${site}:${newName}`
      const nextTeams = { ...customTeams }
      if (nextTeams[oldPrefix]) {
        nextTeams[newPrefix] = nextTeams[oldPrefix]
        delete nextTeams[oldPrefix]
        saveTeams(nextTeams)
      }
      const nextUnits = { ...customUnits }
      let changedUnits = false
      for (const k of Object.keys(nextUnits)) {
        if (k.startsWith(oldPrefix + ":")) {
          const suffix = k.substring(oldPrefix.length)
          nextUnits[newPrefix + suffix] = nextUnits[k]
          delete nextUnits[k]
          changedUnits = true
        }
      }
      if (changedUnits) saveUnits(nextUnits)

    } else if (type === "team" && context.dept && context.site && context.div) {
      const dept = context.dept
      const site = context.site
      const div = context.div
      const key = `${dept}:${site}:${div}`
      if (customTeams[key]) {
        saveTeams({
          ...customTeams,
          [key]: customTeams[key].map((t) => (t === oldName ? newName : t)),
        })
      }
      const oldPrefix = `${dept}:${site}:${div}:${oldName}`
      const newPrefix = `${dept}:${site}:${div}:${newName}`
      const nextUnits = { ...customUnits }
      if (nextUnits[oldPrefix]) {
        nextUnits[newPrefix] = nextUnits[oldPrefix]
        delete nextUnits[oldPrefix]
        saveUnits(nextUnits)
      }
    } else if (type === "unit" && context.dept && context.site && context.div && context.team) {
      const dept = context.dept
      const site = context.site
      const div = context.div
      const team = context.team
      const key = `${dept}:${site}:${div}:${team}`
      if (customUnits[key]) {
        saveUnits({
          ...customUnits,
          [key]: customUnits[key].map((u) => (u === oldName ? newName : u)),
        })
      }
    }

    // 4. Update users in database if there are affected users
    if (userIdsToUpdate.length > 0) {
      const originalUsers = [...users]
      
      // Optimistic Update
      const updatedUsers = users.map((u) => {
        if (userIdsToUpdate.includes(u.user_id)) {
          if (type === "dept") return { ...u, user_departement: newName }
          if (type === "site") return { ...u, user_site: newName }
          if (type === "div") return { ...u, user_division: newName }
          if (type === "team") return { ...u, user_team: newName }
          if (type === "unit") return { ...u, user_unit: newName }
        }
        return u
      })
      onUsersUpdate(updatedUsers)

      try {
        triggerNotice("success", `Renaming node and updating ${userIdsToUpdate.length} staff records...`)

        const promises = userIdsToUpdate.map(async (userId) => {
          const targetUser = users.find((u) => u.user_id === userId)
          if (!targetUser) return

          const payload = {
            user_name: targetUser.user_name,
            user_occupation: targetUser.user_occupation,
            user_departement: type === "dept" ? newName : targetUser.user_departement,
            user_site: type === "site" ? newName : targetUser.user_site,
            user_division: type === "div" ? newName : targetUser.user_division,
            user_team: type === "team" ? newName : targetUser.user_team,
            user_unit: type === "unit" ? newName : targetUser.user_unit,
          }

          const res = await fetch(`/api/users/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            throw new Error(`Failed to update user ${userId}`)
          }
        })

        await Promise.all(promises)
        triggerNotice("success", `Successfully renamed "${oldName}" to "${newName}".`)
        
        startTransition(() => {
          router.refresh()
        })
      } catch (err: any) {
        onUsersUpdate(originalUsers)
        triggerNotice("error", err.message || "An error occurred while renaming the node.")
      }
    } else {
      triggerNotice("success", `Successfully renamed empty node to "${newName}".`)
    }

    setEditingNode(null)
  }

  const [showInactive, setShowInactive] = useState(false)

  // Filter users based on active status toggle
  const activeOrAllUsers = users.filter((u) => {
    if (!showInactive && u.deleted_at) return false
    return true
  })

  // Build Tree Structure
  // 1. Executive / Global Office (Level >= 6 and has no department)
  const executives = activeOrAllUsers.filter((u) => {
    const userLevel = getUserLevel(u.user_occupation)
    return userLevel >= 6 && !u.user_departement
  })

  // 2. Unassigned Staff (Level < 6 and has no department)
  const unassignedStaff = activeOrAllUsers.filter((u) => {
    const userLevel = getUserLevel(u.user_occupation)
    return userLevel < 6 && !u.user_departement
  })

  // 3. Departments list (Database + Custom empty departments)
  const dbDepts = Array.from(
    new Set(activeOrAllUsers.map((u) => u.user_departement).filter(Boolean))
  ) as string[]
  const deptsList = Array.from(new Set([...dbDepts, ...customDepts]))

  return (
    <div className="space-y-6" onDragOver={handleGlobalDragOver}>
      {/* Legend & Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <GitBranch className="h-4 w-4 text-primary" />
            Interactive Corporate Structure
          </h3>
          <p className="text-xs text-muted-foreground">
            {callerIsAdmin 
              ? "Drag and drop staff cards to assign them. Nesting order is Department > Site > Division > Team."
              : "View-only mode: Drag and drop and tree modification are restricted to Super Users and Co-Super Users."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 border-b sm:border-b-0 sm:border-r border-muted pb-2 sm:pb-0 pr-0 sm:pr-4 w-full sm:w-auto">
            <input
              type="checkbox"
              id="tree-show-inactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="tree-show-inactive" className="text-xs text-muted-foreground cursor-pointer font-medium select-none">
              Show Inactive Users
            </label>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-medium">
              <Shield className="h-3.5 w-3.5" /> Executive
            </div>
            <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-medium">
              <Building className="h-3.5 w-3.5" /> Department
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <MapPin className="h-3.5 w-3.5" /> Site
            </div>
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <FolderOpen className="h-3.5 w-3.5" /> Division
            </div>
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <Users className="h-3.5 w-3.5" /> Team
            </div>
            <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-medium">
              <GitBranch className="h-3.5 w-3.5" /> Unit
            </div>
          </div>
        </div>
      </div>

      {/* Admin Action: Add Top-level Department */}
      {callerIsAdmin && (
        <div className="flex justify-start">
          <button
            onClick={() => setCreateModal({ type: "dept", parentDept: null, parentSite: null, parentDiv: null, parentTeam: null, inputValue: "" })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add New Department
          </button>
        </div>
      )}

      {/* Horizontal Scrollable Tree Container */}
      <div ref={treeContainerRef} className="w-full overflow-x-auto pb-6">
        <div className="min-w-[1200px] p-2 space-y-8 select-none">
          
          {/* 1. EXECUTIVE / GLOBAL SECTION */}
          <div className="flex items-start gap-6 pl-4 border-l-4 border-violet-500 bg-violet-500/5 py-4 rounded-r-xl">
            <div 
              className="w-64 shrink-0 space-y-2"
              onDragOver={(e) => {
                e.stopPropagation();
                handleDragOver(e, "exec");
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.stopPropagation();
                handleDrop(e, { dept: null, site: null, div: null, team: null, unit: null });
              }}
            >
              <div 
                className={`p-3 rounded-lg border bg-violet-50/50 dark:bg-violet-950/10 border-violet-200 dark:border-violet-800 transition-all ${
                  hoveredDropZone === "exec" ? "ring-2 ring-violet-500 border-violet-500 bg-violet-100 dark:bg-violet-950/30" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 font-semibold text-sm">
                  <Shield className="h-4 w-4" />
                  Executive Office
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Corporate Headquarters & SU / COSU</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {executives.map((u) => (
                <UserNode 
                  key={u.user_id} 
                  user={u} 
                  level={getUserLevel(u.user_occupation)}
                  callerIsAdmin={callerIsAdmin}
                  isSuperUser={isSuperUser}
                  isCoSuperUser={isCoSuperUser}
                  isSuperUserCaller={isSuperUserCaller}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onEditUser={onEditUser}
                  onImpersonateUser={onImpersonateUser}
                  currentUserId={currentUserId}
                />
              ))}
              {executives.length === 0 && (
                <p className="text-xs text-muted-foreground self-center italic">No executive users</p>
              )}
            </div>
          </div>

          {/* 2. UNASSIGNED STAFF SECTION */}
          {unassignedStaff.length > 0 && (
            <div className="flex items-start gap-6 pl-4 border-l-4 border-slate-400 bg-slate-500/5 py-4 rounded-r-xl">
              <div 
                className="w-64 shrink-0 space-y-2"
                onDragOver={(e) => {
                  e.stopPropagation();
                  handleDragOver(e, "unassigned");
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleDrop(e, { dept: null, site: null, div: null, team: null, unit: null });
                }}
              >
                <div 
                  className={`p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-950/10 border-slate-200 dark:border-slate-800 transition-all ${
                    hoveredDropZone === "unassigned" ? "ring-2 ring-slate-400 border-slate-400 bg-slate-100 dark:bg-slate-950/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-400 font-semibold text-sm">
                    <HelpCircle className="h-4 w-4" />
                    Unassigned Staff
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pending department / site assignment</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {unassignedStaff.map((u) => (
                  <UserNode 
                    key={u.user_id} 
                    user={u} 
                    level={getUserLevel(u.user_occupation)}
                    callerIsAdmin={callerIsAdmin}
                    isSuperUser={isSuperUser}
                    isCoSuperUser={isCoSuperUser}
                    isSuperUserCaller={isSuperUserCaller}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEditUser={onEditUser}
                    onImpersonateUser={onImpersonateUser}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3. CORPORATE DEPARTMENTS BRANCHES */}
          <div className="space-y-6">
            {deptsList.map((deptName) => {
              const deptUsers = activeOrAllUsers.filter(
                (u) => u.user_departement === deptName
              )
              
              // Sites operating in this department (Database + Custom empty sites)
              const dbSites = Array.from(
                new Set(deptUsers.map((u) => u.user_site).filter(Boolean))
              ) as string[]
              const deptSites = Array.from(new Set([...dbSites, ...(customSites[deptName] || [])]))

              // Check if we have site-less users in this department who belong to a division/team
              const hasNoSiteUsers = deptUsers.some((u) => !u.user_site && (u.user_division || u.user_team))

              // Combine sites to render, adding virtual "__no_site__" if site-less users exist
              const sitesToRender = [...deptSites]
              if (hasNoSiteUsers) {
                sitesToRender.push("__no_site__")
              }

              // Users assigned directly to Department (no Site, no Division, no Team)
              const directDeptUsers = deptUsers.filter((u) => !u.user_site && !u.user_division && !u.user_team)
              const deptZoneId = `dept-${deptName}`

              return (
                <div key={deptName} className="flex items-start gap-6 pl-4 border-l-4 border-cyan-500 bg-cyan-500/5 py-4 rounded-r-xl">
                  {/* Department Card */}
                  <div 
                    className={`w-64 shrink-0 space-y-3 self-stretch transition-all rounded-lg p-2 -m-2 ${
                      hoveredDropZone === deptZoneId ? "bg-cyan-500/[0.06] ring-1 ring-cyan-500/20" : ""
                    }`}
                    onDragOver={(e) => {
                      e.stopPropagation();
                      handleDragOver(e, deptZoneId);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDrop(e, { dept: deptName, site: null, div: null, team: null, unit: null });
                    }}
                  >
                    <div 
                      className={`p-3 rounded-lg border bg-cyan-50/50 dark:bg-cyan-950/10 border-cyan-200 dark:border-cyan-800 transition-all ${
                        hoveredDropZone === deptZoneId ? "bg-cyan-500/[0.06] ring-1 ring-cyan-500/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {editingNode && editingNode.type === "dept" && editingNode.oldName === deptName ? (
                          <input
                            type="text"
                            value={editingNode.inputValue}
                            onChange={(e) => setEditingNode({ ...editingNode, inputValue: e.target.value })}
                            onBlur={() => executeRenameNode("dept", deptName, editingNode.inputValue, { dept: null, site: null, div: null, team: null })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                executeRenameNode("dept", deptName, editingNode.inputValue, { dept: null, site: null, div: null, team: null })
                              }
                              if (e.key === "Escape") {
                                setEditingNode(null)
                              }
                            }}
                            className="px-1.5 py-0.5 text-xs rounded border border-cyan-300 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div 
                            className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-semibold text-sm cursor-pointer select-none"
                            onDoubleClick={() => {
                              if (callerIsAdmin) {
                                setEditingNode({
                                  type: "dept",
                                  oldName: deptName,
                                  dept: null,
                                  site: null,
                                  div: null,
                                  team: null,
                                  inputValue: deptName,
                                })
                              }
                            }}
                            title={callerIsAdmin ? "Double-click to rename" : undefined}
                          >
                            <Building className="h-4 w-4" />
                            {deptName}
                          </div>
                        )}
                        {callerIsAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setCreateModal({ type: "site", parentDept: deptName, parentSite: null, parentDiv: null, parentTeam: null, inputValue: "" })}
                              className="p-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 transition-colors"
                              title="Add Site"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick("dept", deptName, null, null, null)}
                              className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                              title="Delete Department"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Department Level</p>
                    </div>

                    {/* Direct Department Users */}
                    {directDeptUsers.length > 0 && (
                      <div className="space-y-2 pl-2 border-l border-cyan-300/40">
                        <p className="text-[10px] uppercase font-bold text-cyan-600/70 tracking-wider">Direct Dept Staff</p>
                        <div className="flex flex-col gap-2">
                          {directDeptUsers.map((u) => (
                            <UserNode 
                              key={u.user_id} 
                              user={u} 
                              compact 
                              level={getUserLevel(u.user_occupation)}
                              callerIsAdmin={callerIsAdmin}
                              isSuperUser={isSuperUser}
                              isCoSuperUser={isCoSuperUser}
                              isSuperUserCaller={isSuperUserCaller}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onEditUser={onEditUser}
                              onImpersonateUser={onImpersonateUser}
                              currentUserId={currentUserId}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Department Sites Branches */}
                  <div className="flex-1 space-y-6">
                    {sitesToRender.map((siteName) => {
                      const isVirtualNoSite = siteName === "__no_site__"
                      const siteUsers = deptUsers.filter((u) => isVirtualNoSite ? !u.user_site : u.user_site === siteName)
                      
                      // Divisions operating in this site (Database + Custom empty divisions)
                      const dbDivs = Array.from(
                        new Set(siteUsers.map((u) => u.user_division).filter(Boolean))
                      ) as string[]
                      const key = `${deptName}:${siteName}`
                      const siteDivs = Array.from(new Set([...dbDivs, ...(customDivs[key] || [])]))

                      // Users assigned directly to Site (no Division, no Team)
                      const directSiteUsers = siteUsers.filter((u) => !u.user_division && !u.user_team)
                      const siteZoneId = `site-${deptName}-${siteName}`

                      return (
                        <div 
                          key={siteName} 
                          className="flex items-start gap-6 pl-4 border-l-2 border-emerald-300 dark:border-emerald-800"
                        >
                          {/* Site Card */}
                          <div 
                            className={`w-60 shrink-0 space-y-3 self-stretch transition-all rounded-lg p-2 -m-2 ${
                              hoveredDropZone === siteZoneId ? "bg-emerald-500/[0.06] ring-1 ring-emerald-500/20" : ""
                            }`}
                            onDragOver={(e) => {
                              e.stopPropagation();
                              handleDragOver(e, siteZoneId);
                            }}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => {
                              e.stopPropagation();
                              handleDrop(e, { dept: deptName, site: siteName, div: null, team: null, unit: null });
                            }}
                          >
                            <div 
                              className={`p-2.5 rounded-lg border transition-all ${
                                isVirtualNoSite 
                                  ? "border-dashed border-slate-300 dark:border-slate-800 bg-slate-500/[0.02]" 
                                  : "bg-emerald-50/40 dark:bg-emerald-950/5 border-emerald-200 dark:border-emerald-900"
                              } ${
                                hoveredDropZone === siteZoneId ? "bg-emerald-500/[0.06] ring-1 ring-emerald-500/20" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                {editingNode && editingNode.type === "site" && editingNode.dept === deptName && editingNode.oldName === siteName ? (
                                  <input
                                    type="text"
                                    value={editingNode.inputValue}
                                    onChange={(e) => setEditingNode({ ...editingNode, inputValue: e.target.value })}
                                    onBlur={() => executeRenameNode("site", siteName, editingNode.inputValue, { dept: deptName, site: null, div: null, team: null })}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        executeRenameNode("site", siteName, editingNode.inputValue, { dept: deptName, site: null, div: null, team: null })
                                      }
                                      if (e.key === "Escape") {
                                        setEditingNode(null)
                                      }
                                    }}
                                    className="px-1.5 py-0.5 text-xs rounded border border-emerald-300 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <div 
                                    className={`flex items-center gap-1.5 font-semibold text-xs select-none ${
                                      isVirtualNoSite ? "text-slate-500 cursor-default" : "text-emerald-700 dark:text-emerald-400 cursor-pointer"
                                    }`}
                                    onDoubleClick={() => {
                                      if (callerIsAdmin && !isVirtualNoSite) {
                                        setEditingNode({
                                          type: "site",
                                          oldName: siteName,
                                          dept: deptName,
                                          site: null,
                                          div: null,
                                          team: null,
                                          inputValue: siteName,
                                        })
                                      }
                                    }}
                                    title={callerIsAdmin && !isVirtualNoSite ? "Double-click to rename" : undefined}
                                  >
                                    <MapPin className="h-3.5 w-3.5" />
                                    {isVirtualNoSite ? "No Site Location" : siteName}
                                  </div>
                                )}
                                {callerIsAdmin && !isVirtualNoSite && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => setCreateModal({ type: "div", parentDept: deptName, parentSite: siteName, parentDiv: null, parentTeam: null, inputValue: "" })}
                                      className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors"
                                      title="Add Division"
                                    >
                                      <Plus className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClick("site", deptName, siteName, null, null)}
                                      className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                                      title="Delete Site"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Direct Site Users */}
                            {directSiteUsers.length > 0 && (
                              <div className="space-y-1.5 pl-2 border-l border-emerald-300/30">
                                <div className="flex flex-col gap-1.5">
                                  {directSiteUsers.map((u) => (
                                    <UserNode 
                                      key={u.user_id} 
                                      user={u} 
                                      compact 
                                      level={getUserLevel(u.user_occupation)}
                                      callerIsAdmin={callerIsAdmin}
                                      isSuperUser={isSuperUser}
                                      isCoSuperUser={isCoSuperUser}
                                      isSuperUserCaller={isSuperUserCaller}
                                      onDragStart={handleDragStart}
                                      onDragEnd={handleDragEnd}
                                      onEditUser={onEditUser}
                                      onImpersonateUser={onImpersonateUser}
                                      currentUserId={currentUserId}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Site Divisions Branches */}
                          <div className="flex-1 space-y-6">
                            {siteDivs.map((divName) => {
                              const divUsers = siteUsers.filter((u) => u.user_division === divName)
                              
                              // Teams in this division (Database + Custom empty teams)
                              const dbTeams = Array.from(
                                new Set(divUsers.map((u) => u.user_team).filter(Boolean))
                              ) as string[]
                              const teamKey = `${deptName}:${siteName}:${divName}`
                              const divTeams = Array.from(new Set([...dbTeams, ...(customTeams[teamKey] || [])]))

                              // Users assigned directly to Division (no Team)
                              const directDivUsers = divUsers.filter((u) => !u.user_team)
                              const divZoneId = `div-${deptName}-${siteName}-${divName}`

                              return (
                                <div key={divName} className="flex items-start gap-6 pl-4 border-l-2 border-amber-300 dark:border-amber-800">
                                  {/* Division Card */}
                                  <div 
                                    className={`w-56 shrink-0 space-y-3 self-stretch transition-all rounded-lg p-2 -m-2 ${
                                      hoveredDropZone === divZoneId ? "bg-amber-500/[0.06] ring-1 ring-amber-500/20" : ""
                                    }`}
                                    onDragOver={(e) => {
                                      e.stopPropagation();
                                      handleDragOver(e, divZoneId);
                                    }}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => {
                                      e.stopPropagation();
                                      handleDrop(e, { dept: deptName, site: siteName, div: divName, team: null, unit: null });
                                    }}
                                  >
                                    <div 
                                      className={`p-2.5 rounded-lg border bg-amber-50/40 dark:bg-amber-950/5 border-amber-200 dark:border-amber-900 transition-all ${
                                        hoveredDropZone === divZoneId ? "bg-amber-500/[0.06] ring-1 ring-amber-500/20" : ""
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        {editingNode && editingNode.type === "div" && editingNode.dept === deptName && editingNode.site === siteName && editingNode.oldName === divName ? (
                                          <input
                                            type="text"
                                            value={editingNode.inputValue}
                                            onChange={(e) => setEditingNode({ ...editingNode, inputValue: e.target.value })}
                                            onBlur={() => executeRenameNode("div", divName, editingNode.inputValue, { dept: deptName, site: siteName, div: null, team: null })}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                executeRenameNode("div", divName, editingNode.inputValue, { dept: deptName, site: siteName, div: null, team: null })
                                              }
                                              if (e.key === "Escape") {
                                                setEditingNode(null)
                                              }
                                            }}
                                            className="px-1.5 py-0.5 text-xs rounded border border-amber-300 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        ) : (
                                          <div 
                                            className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-xs cursor-pointer select-none"
                                            onDoubleClick={() => {
                                              if (callerIsAdmin) {
                                                setEditingNode({
                                                  type: "div",
                                                  oldName: divName,
                                                  dept: deptName,
                                                  site: siteName,
                                                  div: null,
                                                  team: null,
                                                  inputValue: divName,
                                                })
                                              }
                                            }}
                                            title={callerIsAdmin ? "Double-click to rename" : undefined}
                                          >
                                            <FolderOpen className="h-3.5 w-3.5" />
                                            {divName}
                                          </div>
                                        )}
                                        {callerIsAdmin && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              onClick={() => setCreateModal({ type: "team", parentDept: deptName, parentSite: siteName, parentDiv: divName, parentTeam: null, inputValue: "" })}
                                              className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 transition-colors"
                                              title="Add Team"
                                            >
                                              <Plus className="h-2.5 w-2.5" />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteClick("div", deptName, siteName, divName, null)}
                                              className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                                              title="Delete Division"
                                            >
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Direct Division Users */}
                                    {directDivUsers.length > 0 && (
                                      <div className="space-y-1.5 pl-2 border-l border-amber-300/30">
                                        <div className="flex flex-col gap-1.5">
                                          {directDivUsers.map((u) => (
                                            <UserNode 
                                              key={u.user_id} 
                                              user={u} 
                                              compact 
                                              level={getUserLevel(u.user_occupation)}
                                              callerIsAdmin={callerIsAdmin}
                                              isSuperUser={isSuperUser}
                                              isCoSuperUser={isCoSuperUser}
                                              isSuperUserCaller={isSuperUserCaller}
                                              onDragStart={handleDragStart}
                                              onDragEnd={handleDragEnd}
                                              onEditUser={onEditUser}
                                              onImpersonateUser={onImpersonateUser}
                                              currentUserId={currentUserId}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Division Teams Branches */}
                                  <div className="flex-1 space-y-4">
                                    {divTeams.map((teamName) => {
                                      const teamUsers = divUsers.filter((u) => u.user_team === teamName)
                                      const teamZoneId = `team-${deptName}-${siteName}-${divName}-${teamName}`

                                      // Units operating in this team (Database + Custom empty units)
                                      const dbUnits = Array.from(
                                        new Set(teamUsers.map((u) => u.user_unit).filter(Boolean))
                                      ) as string[]
                                      const unitKey = `${deptName}:${siteName}:${divName}:${teamName}`
                                      const teamUnits = Array.from(new Set([...dbUnits, ...(customUnits[unitKey] || [])]))

                                      // Filter direct team-level users (no unit)
                                      const directTeamUsers = teamUsers.filter((u) => !u.user_unit)

                                      return (
                                        <div 
                                          key={teamName} 
                                          className={`flex items-start gap-4 pl-4 border-l border-indigo-200 dark:border-indigo-900 transition-all rounded-r-lg ${
                                            hoveredDropZone === teamZoneId ? "bg-indigo-500/[0.02] border-l-2 border-indigo-500" : ""
                                          }`}
                                          onDragOver={(e) => {
                                            e.stopPropagation();
                                            handleDragOver(e, teamZoneId);
                                          }}
                                          onDragLeave={handleDragLeave}
                                      onDrop={(e) => {
                                            e.stopPropagation();
                                            handleDrop(e, { dept: deptName, site: siteName, div: divName, team: teamName, unit: null });
                                          }}
                                        >
                                           {/* Team Card & Direct Users Column (Column 4, purple) */}
                                           <div className="w-48 shrink-0 flex flex-col gap-2">
                                             <div 
                                               className={`p-2 rounded-lg border bg-indigo-50/40 dark:bg-indigo-950/5 border-indigo-100 dark:border-indigo-900 transition-all ${
                                                 hoveredDropZone === teamZoneId ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-100 dark:bg-indigo-950/20" : ""
                                               }`}
                                             >
                                               <div className="flex items-center justify-between gap-1.5">
                                                 {editingNode && editingNode.type === "team" && editingNode.dept === deptName && editingNode.site === siteName && editingNode.div === divName && editingNode.oldName === teamName ? (
                                                   <input
                                                     type="text"
                                                     value={editingNode.inputValue}
                                                     onChange={(e) => setEditingNode({ ...editingNode, inputValue: e.target.value })}
                                                     onBlur={() => executeRenameNode("team", teamName, editingNode.inputValue, { dept: deptName, site: siteName, div: divName, team: null })}
                                                     onKeyDown={(e) => {
                                                       if (e.key === "Enter") {
                                                         executeRenameNode("team", teamName, editingNode.inputValue, { dept: deptName, site: siteName, div: divName, team: null })
                                                       }
                                                       if (e.key === "Escape") {
                                                         setEditingNode(null)
                                                       }
                                                     }}
                                                     className="px-1.5 py-0.5 text-[10px] rounded border border-indigo-300 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                                     autoFocus
                                                     onClick={(e) => e.stopPropagation()}
                                                   />
                                                 ) : (
                                                   <div 
                                                     className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold text-[11px] truncate cursor-pointer select-none"
                                                     onDoubleClick={() => {
                                                       if (callerIsAdmin) {
                                                         setEditingNode({
                                                           type: "team",
                                                           oldName: teamName,
                                                           dept: deptName,
                                                           site: siteName,
                                                           div: divName,
                                                           team: null,
                                                           inputValue: teamName,
                                                         })
                                                       }
                                                     }}
                                                     title={callerIsAdmin ? "Double-click to rename" : undefined}
                                                   >
                                                     <Users className="h-3 w-3 shrink-0" />
                                                     {teamName}
                                                   </div>
                                                 )}
                                                 {callerIsAdmin && (
                                                   <div className="flex items-center gap-1 shrink-0">
                                                     <button
                                                       onClick={() => setCreateModal({ type: "unit", parentDept: deptName, parentSite: siteName, parentDiv: divName, parentTeam: teamName, inputValue: "" })}
                                                       className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 transition-colors"
                                                       title="Add Unit"
                                                     >
                                                       <Plus className="h-2.5 w-2.5" />
                                                     </button>
                                                     <button
                                                       onClick={() => handleDeleteClick("team", deptName, siteName, divName, teamName, null)}
                                                       className="p-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors shrink-0"
                                                       title="Delete Team"
                                                     >
                                                       <Trash2 className="h-2.5 w-2.5" />
                                                     </button>
                                                   </div>
                                                 )}
                                               </div>
                                             </div>

                                             {/* Direct Team Users stacked vertically */}
                                             {directTeamUsers.length > 0 && (
                                               <div className="space-y-1.5 pl-2 border-l border-indigo-300/30">
                                                 <div className="flex flex-col gap-1.5">
                                                   {directTeamUsers.map((u) => (
                                                     <UserNode 
                                                       key={u.user_id} 
                                                       user={u} 
                                                       compact 
                                                       level={getUserLevel(u.user_occupation)}
                                                       callerIsAdmin={callerIsAdmin}
                                                       isSuperUser={isSuperUser}
                                                       isCoSuperUser={isCoSuperUser}
                                                       isSuperUserCaller={isSuperUserCaller}
                                                       onDragStart={handleDragStart}
                                                       onDragEnd={handleDragEnd}
                                                       onEditUser={onEditUser}
                                                       onImpersonateUser={onImpersonateUser}
                                                       currentUserId={currentUserId}
                                                     />
                                                   ))}
                                                 </div>
                                               </div>
                                             )}
                                           </div>

                                           {/* Team Units Columns (Column 5, teal) */}
                                           {teamUnits.length > 0 && (
                                             <div className="flex-1 space-y-4">
                                               {teamUnits.map((unitName) => {
                                                 const unitUsers = teamUsers.filter((u) => u.user_unit === unitName)
                                                 const unitZoneId = `unit-${deptName}-${siteName}-${divName}-${teamName}-${unitName}`

                                                 return (
                                                   <div
                                                     key={unitName}
                                                     className={`flex flex-col gap-2 pl-4 border-l transition-all rounded-r-lg ${
                                                       hoveredDropZone === unitZoneId
                                                         ? "bg-teal-500/[0.02] border-l-2 border-teal-500"
                                                         : "border-teal-200 dark:border-teal-900"
                                                     }`}
                                                     onDragOver={(e) => {
                                                       e.stopPropagation();
                                                       handleDragOver(e, unitZoneId);
                                                     }}
                                                     onDragLeave={handleDragLeave}
                                                     onDrop={(e) => {
                                                       e.stopPropagation();
                                                       handleDrop(e, { dept: deptName, site: siteName, div: divName, team: teamName, unit: unitName });
                                                     }}
                                                   >
                                                     {/* Unit Card */}
                                                     <div className="w-44 shrink-0">
                                                       <div
                                                         className={`p-2 rounded-lg border transition-all bg-teal-50/40 dark:bg-teal-950/5 border-teal-100 dark:border-teal-900 ${
                                                           hoveredDropZone === unitZoneId ? "ring-2 ring-teal-500 border-teal-500 bg-teal-100 dark:bg-teal-950/20" : ""
                                                         }`}
                                                       >
                                                         <div className="flex items-center justify-between gap-1.5">
                                                           {editingNode && editingNode.type === "unit" && editingNode.dept === deptName && editingNode.site === siteName && editingNode.div === divName && editingNode.team === teamName && editingNode.oldName === unitName ? (
                                                             <input
                                                               type="text"
                                                               value={editingNode.inputValue}
                                                               onChange={(e) => setEditingNode({ ...editingNode, inputValue: e.target.value })}
                                                               onBlur={() => executeRenameNode("unit", unitName, editingNode.inputValue, { dept: deptName, site: siteName, div: divName, team: teamName })}
                                                               onKeyDown={(e) => {
                                                                 if (e.key === "Enter") {
                                                                   executeRenameNode("unit", unitName, editingNode.inputValue, { dept: deptName, site: siteName, div: divName, team: teamName })
                                                                 }
                                                                 if (e.key === "Escape") {
                                                                   setEditingNode(null)
                                                                 }
                                                               }}
                                                               className="px-1.5 py-0.5 text-[10px] rounded border border-teal-300 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 w-full"
                                                               autoFocus
                                                               onClick={(e) => e.stopPropagation()}
                                                             />
                                                           ) : (
                                                             <div
                                                               className="flex items-center gap-1.5 font-semibold text-[10px] truncate select-none text-teal-700 dark:text-teal-400 cursor-pointer"
                                                               onDoubleClick={() => {
                                                                 if (callerIsAdmin) {
                                                                   setEditingNode({
                                                                     type: "unit",
                                                                     oldName: unitName,
                                                                     dept: deptName,
                                                                     site: siteName,
                                                                     div: divName,
                                                                     team: teamName,
                                                                     inputValue: unitName,
                                                                   })
                                                                 }
                                                               }}
                                                               title={callerIsAdmin ? "Double-click to rename" : undefined}
                                                             >
                                                               <GitBranch className="h-3 w-3 shrink-0 text-teal-500" />
                                                               {unitName}
                                                             </div>
                                                           )}
                                                           {callerIsAdmin && (
                                                             <button
                                                               onClick={() => handleDeleteClick("unit", deptName, siteName, divName, teamName, unitName)}
                                                               className="p-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors shrink-0"
                                                               title="Delete Unit"
                                                             >
                                                               <Trash2 className="h-2.5 w-2.5" />
                                                             </button>
                                                           )}
                                                         </div>
                                                       </div>
                                                     </div>

                                                     {/* Unit Users stacked vertically */}
                                                     {unitUsers.length > 0 && (
                                                       <div className="space-y-1.5 pl-2 border-l border-teal-300/30 w-44 shrink-0">
                                                         <div className="flex flex-col gap-1.5">
                                                           {unitUsers.map((u) => (
                                                             <UserNode 
                                                               key={u.user_id} 
                                                               user={u} 
                                                               compact 
                                                               level={getUserLevel(u.user_occupation)}
                                                               callerIsAdmin={callerIsAdmin}
                                                               isSuperUser={isSuperUser}
                                                               isCoSuperUser={isCoSuperUser}
                                                               isSuperUserCaller={isSuperUserCaller}
                                                               onDragStart={handleDragStart}
                                                               onDragEnd={handleDragEnd}
                                                               onEditUser={onEditUser}
                                                               onImpersonateUser={onImpersonateUser}
                                                               currentUserId={currentUserId}
                                                             />
                                                           ))}
                                                         </div>
                                                       </div>
                                                     )}
                                                   </div>
                                                 )
                                               })}
                                             </div>
                                           )}
                                         </div>
                                      )
                                    })}
                                 </div>
                               </div>
                             )
                           })}
                         </div>

                        </div>
                      )
                    })}
                  </div>

                </div>
              )
            })}
          </div>

        </div>
      </div>

      {/* Dynamic Node Creation Modal Overlay */}
      {createModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border shadow-2xl bg-background/95 backdrop-blur-md">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2 text-foreground text-left">
                {createModal.type === "dept" && "Add New Department"}
                {createModal.type === "site" && `Add Site under "${createModal.parentDept}"`}
                {createModal.type === "div" && `Add Division under "${createModal.parentSite}"`}
                {createModal.type === "team" && `Add Team under "${createModal.parentDiv}"`}
                {createModal.type === "unit" && `Add Unit under "${createModal.parentTeam}"`}
              </h3>
              <div className="space-y-2 text-left">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={createModal.inputValue}
                  onChange={(e) => setCreateModal({ ...createModal, inputValue: e.target.value })}
                  placeholder="Enter name..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateNode()
                    if (e.key === "Escape") setCreateModal({ type: null, parentDept: null, parentSite: null, parentDiv: null, parentTeam: null, inputValue: "" })
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setCreateModal({ type: null, parentDept: null, parentSite: null, parentDiv: null, parentTeam: null, inputValue: "" })}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNode}
                  disabled={!createModal.inputValue.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors shadow-sm"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Node Confirmation Modal Overlay */}
      {deleteConfirm.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border border-red-200 dark:border-red-900 shadow-2xl bg-background/95 backdrop-blur-md">
            <CardContent className="p-6 space-y-4 text-left">
              <h3 className="font-semibold text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5 shrink-0" />
                Confirm Node Deletion
              </h3>
              <p className="text-sm text-foreground">
                Are you sure you want to delete the following node?
              </p>
              <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1">
                <p><span className="font-semibold">Type:</span> {deleteConfirm.type.toUpperCase()}</p>
                {deleteConfirm.dept && <p><span className="font-semibold">Department:</span> {deleteConfirm.dept}</p>}
                {deleteConfirm.site && <p><span className="font-semibold">Site:</span> {deleteConfirm.site}</p>}
                {deleteConfirm.div && <p><span className="font-semibold">Division:</span> {deleteConfirm.div}</p>}
                {deleteConfirm.team && <p><span className="font-semibold">Team:</span> {deleteConfirm.team}</p>}
                {deleteConfirm.unit && <p><span className="font-semibold">Unit:</span> {deleteConfirm.unit}</p>}
              </div>
              <div className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50 bg-yellow-500/[0.03] text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                <p className="font-bold uppercase tracking-wider">Warning:</p>
                <p>
                  This node currently contains <span className="font-bold">{deleteConfirm.affectedUserCount}</span> staff. 
                  Deleting this node will clear their assignments, and they will be moved to the unassigned pool.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirm({ type: null, dept: null, site: null, div: null, team: null, unit: null, affectedUserCount: 0, affectedUserIds: [] })}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executeDeleteNode(deleteConfirm.type!, deleteConfirm.dept, deleteConfirm.site, deleteConfirm.div, deleteConfirm.team, deleteConfirm.affectedUserIds, deleteConfirm.unit)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"
                >
                  Yes, Delete Node
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Subcomponent: UserNode
function UserNode({
  user,
  compact = false,
  level,
  callerIsAdmin,
  isSuperUser,
  isCoSuperUser,
  isSuperUserCaller,
  onDragStart,
  onDragEnd,
  onEditUser,
  onImpersonateUser,
  currentUserId,
}: {
  user: UserProfile
  compact?: boolean
  level: number
  callerIsAdmin: boolean
  isSuperUser: (occ: string | null | undefined) => boolean
  isCoSuperUser: (occ: string | null | undefined) => boolean
  isSuperUserCaller: boolean
  onDragStart: (e: React.DragEvent, userId: string) => void
  onDragEnd: () => void
  onEditUser?: (user: UserProfile) => void
  onImpersonateUser?: (userId: string) => void
  currentUserId?: string
}) {
  const isTargetSU = isSuperUser(user.user_occupation)
  const isTargetCOSU = isCoSuperUser(user.user_occupation)
  const isLocked = isTargetSU || (isTargetCOSU && !isSuperUserCaller)
  const canDrag = callerIsAdmin && !isLocked

  const displayInitials = (user.user_name || user.user_email).charAt(0).toUpperCase()
  const isUserAdmin = isTargetSU || isTargetCOSU

  // Security checks for action buttons
  const canEdit = callerIsAdmin && (!isTargetSU && (!isTargetCOSU || isSuperUserCaller))
  const canImpersonate = callerIsAdmin && (!isTargetSU || isSuperUserCaller) && user.user_id !== currentUserId && !user.deleted_at

  if (compact) {
    return (
      <div
        draggable={canDrag}
        onDragStart={(e) => onDragStart(e, user.user_id)}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border bg-card text-card-foreground shadow-sm max-w-xs select-none transition-all ${
          canDrag 
            ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40" 
            : "opacity-80 cursor-default"
        } ${user.deleted_at ? "border-dashed border-red-300 dark:border-red-900 bg-red-500/[0.02]" : ""}`}
      >
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isUserAdmin 
            ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" 
            : "bg-primary/10 text-primary"
        }`}>
          {displayInitials}
        </div>
        <div className="min-w-0 text-left flex-1">
          <p className="text-xs font-semibold truncate leading-tight flex items-center gap-1">
            {user.user_name || "No Name"}
            {user.deleted_at && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Inactive" />
            )}
          </p>
          <p className="text-[9px] text-muted-foreground truncate leading-none mt-0.5">{user.user_occupation || "Staff"}</p>
          {user.user_site && (
            <span className="text-[8px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-1 bg-emerald-500/[0.04] px-1 rounded border border-emerald-500/10 w-fit">
              <MapPin className="h-2 w-2 shrink-0 text-emerald-500" />
              {user.user_site}
            </span>
          )}
        </div>

        {/* Compact Actions Column */}
        {(canEdit || canImpersonate) && (
          <div className="flex flex-col gap-1 shrink-0 ml-1 border-l border-muted/40 pl-1.5">
            {canImpersonate && onImpersonateUser && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onImpersonateUser(user.user_id)
                }}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Impersonate"
              >
                <Eye className="h-3 w-3" />
              </button>
            )}
            {canEdit && onEditUser && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditUser(user)
                }}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, user.user_id)}
      onDragEnd={onDragEnd}
      className={`w-60 select-none transition-all ${
        canDrag 
          ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30" 
          : "cursor-default"
      } ${user.deleted_at ? "border-dashed border-red-300 dark:border-red-800 bg-red-500/[0.01]" : ""}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            isUserAdmin 
              ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" 
              : "bg-primary/10 text-primary"
          }`}>
            {displayInitials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5 justify-between">
              <span className="font-semibold text-xs truncate text-foreground">{user.user_name || "No Name"}</span>
              {user.deleted_at && (
                <Badge variant="destructive" className="h-3.5 px-1 py-0 text-[8px] font-bold">INACTIVE</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{user.user_email}</p>
            
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge 
                variant="secondary" 
                className={`text-[9px] px-1 py-0 font-medium ${
                  isUserAdmin 
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-950/25 dark:text-violet-400" 
                    : ""
                }`}
              >
                {user.user_occupation || "Staff"}
              </Badge>
              {level && (
                <span className="text-[9px] text-muted-foreground">Lvl {level}</span>
              )}
              {user.user_site && (
                <Badge 
                  variant="outline" 
                  className="text-[8px] px-1 py-0 font-medium border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 flex items-center gap-0.5"
                >
                  <MapPin className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                  {user.user_site}
                </Badge>
              )}
            </div>

            {/* Actions Row */}
            {(canEdit || canImpersonate) && (
              <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-muted/40">
                {canImpersonate && onImpersonateUser && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onImpersonateUser(user.user_id)
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Impersonate User"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                {canEdit && onEditUser && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditUser(user)
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit User Profile"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
