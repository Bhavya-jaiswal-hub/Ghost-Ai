"use client"

import dynamic from "next/dynamic"
import {
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { userProfileAppearance } from "@/lib/clerk-appearance"

interface EditorNavbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  projectName?: string
  showWorkspaceActions?: boolean
  isAiSidebarOpen?: boolean
  onOpenShareDialog?: () => void
  onToggleAiSidebar?: () => void
}

function UserButtonPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="size-8 rounded-full border border-surface-border bg-elevated"
    />
  )
}

const ClientUserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  {
    ssr: false,
    loading: UserButtonPlaceholder,
  }
)

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
  projectName = "Ghost AI",
  showWorkspaceActions = false,
  isAiSidebarOpen = false,
  onOpenShareDialog,
  onToggleAiSidebar,
}: EditorNavbarProps) {
  const SidebarIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen

  return (
    <header className="relative flex h-14 shrink-0 items-center border-b border-surface-border bg-surface px-2">
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            isSidebarOpen ? "Close projects sidebar" : "Open projects sidebar"
          }
          onClick={onToggleSidebar}
        >
          <SidebarIcon className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center">
        <span className="max-w-[40vw] truncate text-sm font-medium text-copy-secondary">
          {projectName}
        </span>
      </div>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {showWorkspaceActions && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Share project"
              onClick={() => onOpenShareDialog?.()}
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                isAiSidebarOpen ? "Close AI sidebar" : "Open AI sidebar"
              }
              aria-pressed={isAiSidebarOpen}
              onClick={() => onToggleAiSidebar?.()}
            >
              <Bot className="h-5 w-5" />
            </Button>
          </>
        )}
        <ClientUserButton
          userProfileProps={{ appearance: userProfileAppearance }}
        />
      </div>
    </header>
  )
}
