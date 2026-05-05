"use client"

import { UserButton } from "@clerk/nextjs"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { userProfileAppearance } from "@/lib/clerk-appearance"

interface EditorNavbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
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
        <span className="text-sm font-medium text-copy-secondary">Ghost AI</span>
      </div>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        <UserButton userProfileProps={{ appearance: userProfileAppearance }} />
      </div>
    </header>
  )
}
