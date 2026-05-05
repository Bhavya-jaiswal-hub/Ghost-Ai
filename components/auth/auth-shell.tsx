import type { ReactNode } from "react"
import { Bot, FileText, GitBranch } from "lucide-react"

interface AuthShellProps {
  children: ReactNode
}

const features = [
  {
    icon: Bot,
    title: "AI Architecture Generation",
    description: "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: GitBranch,
    title: "Real-time Collaboration",
    description: "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: FileText,
    title: "Instant Spec Generation",
    description: "Export a complete Markdown technical spec directly from the canvas graph.",
  },
]

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="grid min-h-screen w-full overflow-x-hidden bg-base font-sans text-copy-primary lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-surface-border bg-elevated lg:flex">
        <div className="absolute inset-y-0 right-0 w-px bg-border-subtle" />
        <div className="flex w-full flex-col justify-between px-12 py-10 xl:px-20">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-xl bg-brand shadow-none" />
            <span className="text-lg font-semibold text-copy-primary">Ghost AI</span>
          </div>

          <div className="max-w-2xl">
            <div className="mb-14 max-w-xl">
              <h1 className="text-4xl font-semibold leading-tight text-copy-primary xl:text-5xl">
                Design systems at the speed of thought.
              </h1>
              <p className="mt-7 text-base leading-7 text-copy-muted xl:text-lg">
                Describe your architecture in plain English. Ghost AI maps it to a shared canvas your whole team can refine in real time.
              </p>
            </div>

            <ul className="space-y-8">
              {features.map(({ description, icon: Icon, title }) => (
                <li key={title} className="flex gap-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand bg-accent-dim text-brand">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-copy-secondary">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-copy-muted">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-copy-faint">(c) 2026 Ghost AI. All rights reserved.</p>
        </div>
      </section>
      <section className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-base px-4 py-8 sm:px-6 lg:px-12">
        {children}
      </section>
    </main>
  )
}
