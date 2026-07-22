"use client"

import React, { useMemo } from "react"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"

interface TicketingTableProps {
  tickets: any[]
  userMap: Map<string, string>
  getPriorityBadge: (priority: any) => React.ReactNode
  getStatusBadge: (status: any) => React.ReactNode
  handleViewTicket: (ticket: any) => void
}

export function TicketingTable({
  tickets,
  userMap,
  getPriorityBadge,
  getStatusBadge,
  handleViewTicket
}: TicketingTableProps) {
  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      header: "ID",
      accessorKey: "id",
      sortable: true,
      cell: (t) => (
        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
          {t.id}
        </span>
      )
    },
    {
      header: "Title",
      accessorKey: "title",
      sortable: true,
      cell: (t) => (
        <div className="font-medium text-foreground max-w-[200px] truncate" title={t.title}>
          {t.title}
        </div>
      )
    },
    {
      header: "Requester",
      accessorKey: "request_by",
      sortable: true,
      cell: (t) => (
        <span className="text-muted-foreground text-xs">
          {userMap.get(t.request_by) || t.request_by}
        </span>
      )
    },
    {
      header: "Request To",
      accessorKey: "request_to_division",
      sortable: true,
      cell: (t) => (
        <span className="text-xs font-medium">
          {t.request_to_division || "—"}
        </span>
      )
    },
    {
      header: "Tagged Person",
      accessorKey: "tag_person",
      sortable: true,
      cell: (t) => {
        const title = (t.team_user_ids || []).map((uid: string) => userMap.get(uid) || uid).join(", ")
        const content = (() => {
          const ids = t.team_user_ids || []
          if (ids.length === 0) {
            return t.tag_person ? (userMap.get(t.tag_person) || t.tag_person) : "—"
          }
          const names = ids.map((uid: string) => userMap.get(uid) || uid)
          if (names.length === 1) return names[0]
          return `${names[0]} +${names.length - 1} more`
        })()
        return (
          <span className="text-muted-foreground text-xs" title={title}>
            {content}
          </span>
        )
      }
    },
    {
      header: "Problem Type",
      accessorKey: "problem_type",
      sortable: true,
      cell: (t) => (
        <span className="text-xs text-muted-foreground font-medium">{t.problem_type}</span>
      )
    },
    {
      header: "Due Date",
      accessorKey: "due_date",
      sortable: true,
      className: "text-primary",
      cell: (t) => (
        <span className="text-muted-foreground text-xs">
          {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
        </span>
      )
    },
    {
      header: "Priority",
      accessorKey: "priority",
      sortable: true,
      cell: (t) => getPriorityBadge(t.priority)
    },
    {
      header: "Status",
      accessorKey: "status",
      sortable: true,
      cell: (t) => getStatusBadge(t.status)
    },
    {
      header: <div className="text-right w-full pr-4">Action</div>,
      className: "text-right pr-4",
      cell: (t) => (
        <Button
          variant="ghost"
          size="icon-sm"
          className="opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary rounded-lg transition-all"
          onClick={(e) => { e.stopPropagation(); handleViewTicket(t); }}
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }
  ], [getPriorityBadge, getStatusBadge, handleViewTicket, userMap])

  return (
    <DataTable
      columns={columns}
      data={tickets}
      emptyMessage="No tickets found matching the filter criteria."
      className="border-0 shadow-none rounded-none"
      onRowClick={(row) => handleViewTicket(row)}
    />
  )
}
