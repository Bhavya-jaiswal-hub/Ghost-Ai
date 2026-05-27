"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type CanvasEdge, type CanvasNode } from "@/types/canvas"

export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error"

interface UseCanvasAutosaveOptions {
  projectId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  enabled: boolean
  debounceMs?: number
}

interface UseCanvasAutosaveResult {
  saveNow: () => void
  status: CanvasSaveStatus
}

export function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  enabled,
  debounceMs = 1200,
}: UseCanvasAutosaveOptions): UseCanvasAutosaveResult {
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null)
  const [requestState, setRequestState] = useState<"idle" | "saving" | "error">(
    "idle"
  )
  const hasInitializedRef = useRef(false)
  const initialSnapshotRef = useRef<string | null>(null)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const pendingSaveControllerRef = useRef<AbortController | null>(null)
  const saveRequestIdRef = useRef(0)
  const snapshot = useMemo(
    () =>
      JSON.stringify({
        nodes,
        edges,
      }),
    [edges, nodes]
  )
  const snapshotRef = useRef(snapshot)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const clearPendingSave = useCallback(() => {
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }

    if (pendingSaveControllerRef.current) {
      pendingSaveControllerRef.current.abort()
      pendingSaveControllerRef.current = null
    }
  }, [])

  const persistSnapshot = useCallback(
    async (snapshotToSave: string) => {
      clearPendingSave()

      const controller = new AbortController()
      const requestId = saveRequestIdRef.current + 1

      pendingSaveControllerRef.current = controller
      saveRequestIdRef.current = requestId
      setRequestState("saving")

      try {
        const response = await fetch(`/api/projects/${projectId}/canvas`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: snapshotToSave,
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Canvas save failed.")
        }

        setLastSavedSnapshot(snapshotToSave)

        if (saveRequestIdRef.current === requestId) {
          setRequestState("idle")
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error("Canvas save failed.", error)

        if (saveRequestIdRef.current === requestId) {
          setRequestState("error")
        }
      } finally {
        if (pendingSaveControllerRef.current === controller) {
          pendingSaveControllerRef.current = null
        }
      }
    },
    [clearPendingSave, projectId]
  )

  const saveNow = useCallback(() => {
    if (requestState === "saving") {
      return
    }

    void persistSnapshot(snapshotRef.current)
  }, [persistSnapshot, requestState])

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      initialSnapshotRef.current = snapshot
      return
    }

    if (lastSavedSnapshot === snapshot) {
      return
    }

    const isUntouchedInitialSnapshot =
      lastSavedSnapshot === null &&
      initialSnapshotRef.current === snapshot

    if (isUntouchedInitialSnapshot) {
      return
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      void persistSnapshot(snapshot)
    }, debounceMs)

    return () => {
      clearPendingSave()
    }
  }, [
    clearPendingSave,
    debounceMs,
    enabled,
    lastSavedSnapshot,
    persistSnapshot,
    snapshot,
  ])

  useEffect(() => clearPendingSave, [clearPendingSave])

  const status =
    requestState === "saving"
      ? "saving"
      : lastSavedSnapshot !== null &&
          lastSavedSnapshot === snapshot
        ? "saved"
        : requestState === "error"
          ? "error"
          : "idle"

  return {
    saveNow,
    status,
  }
}
