import Link from "next/link"
import { LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-6 text-copy-primary">
      <section className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-border bg-elevated text-copy-secondary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold leading-tight">
          Workspace unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-copy-muted">
          This project does not exist, or you do not have access to it.
        </p>
        <Button asChild className="mt-6">
          <Link href="/editor">Back to editor</Link>
        </Button>
      </section>
    </main>
  )
}
