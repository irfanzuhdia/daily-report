import { Card, CardContent } from "@/components/ui/card"

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-muted animate-pulse" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 flex-1 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-2">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-6 w-16 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="h-8 w-48 rounded bg-muted animate-pulse" />
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded bg-muted animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-24 w-full rounded bg-muted animate-pulse" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded bg-muted animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded bg-muted animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function PageSkeleton({ type = "default" }: { type?: "default" | "stats" | "form" | "detail" }) {
  switch (type) {
    case "stats":
      return (
        <div className="space-y-6">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <StatsSkeleton />
          <CardSkeleton />
        </div>
      )
    case "form":
      return <FormSkeleton />
    case "detail":
      return (
        <div className="space-y-6">
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
          <CardSkeleton rows={6} />
          <CardSkeleton rows={3} />
        </div>
      )
    default:
      return (
        <div className="space-y-6">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <CardSkeleton />
        </div>
      )
  }
}
