"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"

/* ─────────────────────── Types ─────────────────────── */

type ToastVariant = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (options: Omit<Toast, "id">) => void
  dismiss: (id: string) => void
}

/* ─────────────────────── Context ─────────────────────── */

const ToastContext = React.createContext<ToastContextValue>({
  toast: () => {},
  dismiss: () => {},
})

export function useToast() {
  return React.useContext(ToastContext)
}

/* ─────────────────────── Provider ─────────────────────── */

const TOAST_DURATION = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (options: Omit<Toast, "id">) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { ...options, id }])
      setTimeout(() => dismiss(id), TOAST_DURATION)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

/* ─────────────────────── Viewport ─────────────────────── */

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: React.ElementType; containerClass: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    containerClass: "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-500/20",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: AlertCircle,
    containerClass: "border-red-500/20 bg-red-50 dark:bg-red-950/30 dark:border-red-500/20",
    iconClass: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    containerClass: "border-amber-500/20 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/20",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    containerClass: "border-blue-500/20 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500/20",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => {
        const config = VARIANT_STYLES[t.variant]
        const Icon = config.icon
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-sm",
              "animate-in slide-in-from-bottom-3 fade-in-0 duration-300",
              config.containerClass
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClass)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
