"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type ToastVariant = "default" | "destructive" | "success"

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
}

export interface ToastItem extends ToastOptions {
  id: string
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
  toasts: ToastItem[]
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_TIMEOUT_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const activeTimer = timersRef.current.get(id)
    if (activeTimer) {
      clearTimeout(activeTimer)
      timersRef.current.delete(id)
    }
    setToasts((currentToasts) => currentToasts.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, variant = "default" }: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`

      const newToast: ToastItem = {
        id,
        title,
        description,
        variant,
      }

      setToasts((currentToasts) => [...currentToasts, newToast])

      const timer = setTimeout(() => {
        dismiss(id)
      }, TOAST_TIMEOUT_MS)

      timersRef.current.set(id, timer)

      return id
    },
    [dismiss]
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const contextValue = useMemo(
    () => ({ toast, dismiss, toasts }),
    [toast, dismiss, toasts]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

interface ToastViewportProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex max-h-screen w-full max-w-sm flex-col gap-2 p-4 pointer-events-none"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const { id, title, description, variant = "default" } = item

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur transition-all duration-200",
        "bg-surface text-copy-primary",
        variant === "destructive" && "border-state-error/40 text-copy-primary",
        variant === "success" && "border-state-success/40 text-copy-primary",
        variant === "default" && "border-surface-border"
      )}
    >
      {variant === "destructive" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-state-error" />
      ) : variant === "success" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-state-success" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
      )}

      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-xs font-semibold leading-tight text-copy-primary">
          {title}
        </h4>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-copy-secondary">
            {description}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Close notification"
        className="shrink-0 rounded-lg p-1 text-copy-muted transition-colors hover:bg-subtle hover:text-copy-primary focus:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

