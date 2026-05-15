"use client"

import { useEffect } from "react"
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react"

interface KeyboardShortcutOptions<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> {
  reactFlowInstance: ReactFlowInstance<NodeType, EdgeType>
  onUndo: () => void
  onRedo: () => void
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.closest("input, textarea, select")) {
    return true
  }

  const editableElement = target.closest("[contenteditable]")

  return editableElement !== null && editableElement.getAttribute("contenteditable") !== "false"
}

export function useKeyboardShortcuts<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>({
  reactFlowInstance,
  onUndo,
  onRedo,
}: KeyboardShortcutOptions<NodeType, EdgeType>) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const isModKey = event.metaKey || event.ctrlKey

      if (!isModKey && (event.key === "+" || event.key === "=")) {
        event.preventDefault()
        void reactFlowInstance.zoomIn({ duration: 160 })
        return
      }

      if (!isModKey && event.key === "-") {
        event.preventDefault()
        void reactFlowInstance.zoomOut({ duration: 160 })
        return
      }

      if (isModKey && key === "z" && event.shiftKey) {
        event.preventDefault()
        onRedo()
        return
      }

      if (isModKey && key === "y") {
        event.preventDefault()
        onRedo()
        return
      }

      if (isModKey && key === "z") {
        event.preventDefault()
        onUndo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onRedo, onUndo, reactFlowInstance])
}
