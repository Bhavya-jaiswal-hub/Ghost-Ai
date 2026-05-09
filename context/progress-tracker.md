# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 07: Wire Editor Home

## Current Goal

- Feature 07 complete; editor home uses real project data and mutations.

## Completed

Feature 01: Design System - shadcn/ui installed and configured for Tailwind v4, dark-only theme tokens in globals.css, Button/Card/Dialog/Input/Tabs/Textarea/ScrollArea components added to components/ui/, lucide-react installed, lib/utils.ts cn() helper in place. TypeScript compiles clean.

Feature 02: Editor Chrome - EditorNavbar (fixed top bar with PanelLeftOpen/PanelLeftClose toggle) and ProjectSidebar (fixed overlay, slides from left, Projects title + close button, My Projects/Shared tabs with empty states, New Project button) added to components/editor/. Dialog pattern confirmed ready via existing components/ui/dialog.tsx. TypeScript and ESLint clean.

Feature 03: Auth - @clerk/ui installed. ClerkProvider wraps root layout with dark theme from @clerk/ui/themes, overriding appearance variables using CSS tokens (no hardcoded colors). proxy.ts at project root uses clerkMiddleware + createRouteMatcher to protect all routes except /sign-in and /sign-up (resolved from NEXT_PUBLIC_CLERK_SIGN_IN_URL / NEXT_PUBLIC_CLERK_SIGN_UP_URL env vars). Sign-in and sign-up pages use a minimal two-panel layout (left panel with logo/tagline/feature list hidden on mobile, right panel with centered Clerk form). app/page.tsx redirects authenticated users to /editor and unauthenticated users to /sign-in. UserButton added to EditorNavbar right section. app/editor/page.tsx shell created with sidebar state management.

Feature 04: Project Dialogs - hooks/use-project-dialogs.ts manages dialog/form/loading state and mock project data (CRUD operations on local state). components/editor/project-dialogs.tsx renders Create (name + live slug preview), Rename (prefilled, auto-focus, Enter submits), and Delete (destructive confirm) dialogs. ProjectSidebar updated with project item list showing rename/delete actions on hover/focus for owned projects only, shared projects shown without actions, mobile backdrop scrim added. app/editor/page.tsx updated with centered home screen (heading, description, New Project button) wired to Create dialog. TypeScript and ESLint clean.

Feature 05: Prisma - prisma/models/project.prisma added with Project and ProjectCollaborator models, ProjectStatus enum, cascade collaborator deletion, owner/date/email/project-date indexes, and project/email collaborator unique constraint. lib/prisma.ts added as a cached singleton that uses Prisma Accelerate for prisma+postgres:// URLs and @prisma/adapter-pg for direct PostgreSQL URLs. prisma.config.ts now loads Next-compatible env files for CLI access. Migrations 20260507070217_add_project_models and 20260507070410_use_collaborator_unique_constraint applied. Prisma Client generated. Production build passes.

Feature 06: Project APIs - backend-only REST route handlers added for GET/POST `/api/projects` and PATCH/DELETE `/api/projects/[projectId]`. Routes use Clerk `auth()` inside handlers, return JSON 401 for unauthenticated access, default missing create names to `Untitled Project`, validate request bodies, use Prisma's existing cuid project IDs, and enforce owner-only rename/delete with 403 for non-owner mutations. `/api/projects(.*)` is allowed through proxy so handlers can return the specified API error responses. ESLint clean and production build passes.

Feature 07: Wire Editor Home - editor home now fetches owned/shared projects server-side through `lib/project-data.ts` and passes serializable lists into the client editor shell. Mock project state was replaced by `hooks/use-project-actions.ts`, which manages create/rename/delete dialogs, room ID previews, API mutations, refresh/redirect behavior, and navigation to `/editor/{projectId}` after create. `POST /api/projects` now accepts a validated room-safe project ID so project IDs and Liveblocks room IDs stay aligned. Sidebar and dialogs render real project data. ESLint clean and production build passes.

Project API hardening: PATCH/DELETE `/api/projects/[projectId]` now convert Prisma record-not-found races after ownership checks into `404 Not Found` responses instead of leaking as server errors. ESLint clean and production build passes.

Project action dialog fix: successful rename/delete project mutations now force-reset dialog state even while the mutation loading flag is still true, preserving the loading guard for user-initiated dialog closes. ESLint clean and production build passes.

## In Progress

- None.

## Open Questions

- None.

## Next Steps

- Move to the next feature spec.
