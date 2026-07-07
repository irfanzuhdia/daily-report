"use client"

import React, { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Briefcase,
  CheckSquare,
  FileText,
  Clock
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type TreeNode = {
  id: string
  name: string
  type: "category" | "project" | "task" | "report"
  hours: number
  children?: TreeNode[]
  subtitle?: string
}

interface TreeItemProps {
  node: TreeNode
  initiallyExpanded?: boolean
  grandTotalHours: number
}

function TreeItem({ node, initiallyExpanded = false, grandTotalHours }: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded)
  const [displayCount, setDisplayCount] = useState(5)

  const hasChildren = node.children && node.children.length > 0
  const visibleChildren = hasChildren ? node.children!.slice(0, displayCount) : []
  const hasMore = hasChildren && displayCount < node.children!.length

  const toggleExpand = () => setIsExpanded(!isExpanded)
  const loadMore = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDisplayCount(prev => prev + 10)
  }

  const getIcon = () => {
    switch (node.type) {
      case "category": return <Folder className="h-4 w-4 text-blue-500" />
      case "project": return <Briefcase className="h-4 w-4 text-emerald-500" />
      case "task": return <CheckSquare className="h-4 w-4 text-amber-500" />
      case "report": return <FileText className="h-4 w-4 text-muted-foreground" />
      default: return <Folder className="h-4 w-4" />
    }
  }

  const getBarColor = () => {
    switch (node.type) {
      case "category": return "bg-blue-500"
      case "project": return "bg-emerald-500"
      case "task": return "bg-amber-500"
      case "report": return "bg-muted-foreground"
      default: return "bg-primary"
    }
  }

  const percent = grandTotalHours > 0 ? (node.hours / grandTotalHours) * 100 : 0

  return (
    <div className="pl-4 border-l border-border/50 ml-2 my-1.5">
      <div 
        className={`flex flex-col py-2 px-3 hover:bg-muted/50 rounded-md group ${hasChildren ? 'cursor-pointer' : ''}`}
        onClick={hasChildren ? toggleExpand : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <div className="w-4 shrink-0" />
            )}
            {getIcon()}
            <div className="flex flex-col truncate">
              <span className="text-sm font-medium truncate">{node.name}</span>
              {node.subtitle && <span className="text-[10px] text-muted-foreground truncate">{node.subtitle}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-4">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">{node.hours.toFixed(1)}h</span>
          </div>
        </div>
        
        {/* Progress Bar Line */}
        <div className="mt-2 ml-6 flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBarColor()} transition-all duration-500 ease-out`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{Math.round(percent)}%</span>
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="mt-1">
          {visibleChildren.map(child => (
            <TreeItem key={child.id} node={child} grandTotalHours={grandTotalHours} />
          ))}
          {hasMore && (
            <div className="pl-8 py-2">
              <Button variant="ghost" size="sm" onClick={loadMore} className="h-7 text-xs text-muted-foreground hover:text-primary">
                Load more... ({node.children!.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface TimeDistributionTreeProps {
  data: TreeNode[]
}

export function TimeDistributionTree({ data }: TimeDistributionTreeProps) {
  const [displayCount, setDisplayCount] = useState(5)
  const visibleData = data.slice(0, displayCount)
  const hasMore = displayCount < data.length
  
  const grandTotalHours = data.reduce((sum, n) => sum + n.hours, 0)

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No time logs available for the selected period.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Time Distribution Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {visibleData.map(node => (
            <TreeItem key={node.id} node={node} grandTotalHours={grandTotalHours} />
          ))}
          {hasMore && (
            <div className="pl-4 py-2">
              <Button variant="outline" size="sm" onClick={() => setDisplayCount(prev => prev + 5)}>
                Load more categories
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
