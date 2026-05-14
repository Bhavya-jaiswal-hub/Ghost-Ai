# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 18: Starter Template Library

## Current Goal

- Feature 18 complete; the editor now includes a starter template library, template preview/import modal, navbar entry point, and Liveblocks-backed canvas replacement flow.

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

Feature 08: Editor Workspace Shell - `/editor/[roomId]` is implemented as a server component route with Clerk authentication redirecting unauthenticated users to `/sign-in`. `lib/project-access.ts` centralizes current identity lookup and project access checks by owner or primary-email collaborator. Missing and unauthorized projects render `AccessDenied`. The workspace shell shows the current project name in the navbar, share and AI sidebar toggle actions, the existing project sidebar with the active room highlighted and project navigation links, a central canvas placeholder, and a right AI sidebar placeholder. ESLint clean and production build passes.

Feature 08 layout polish: workspace placeholder content now receives project-sidebar open state from `EditorLayout` and applies desktop-only left spacing while the projects overlay is open, keeping the canvas placeholder centered in the visible workspace when both sidebars are expanded.

Feature 09: Share Dialog - workspace Share button now opens a centered share dialog. Owners can copy the project link with temporary `Copied!` feedback, invite collaborators by normalized email, view Clerk-enriched collaborator names/avatars when available, and remove collaborators. Collaborators can open the dialog in read-only mode and view the collaborator list only. Added authenticated collaborator API route at `/api/projects/[projectId]/collaborators` with GET/POST/DELETE handlers, owner-only invite/remove enforcement, and database-backed collaborator storage without a local user table. ESLint clean and production build passes.

Feature 09 owner visibility follow-up: share responses now include the project owner from Clerk user data alongside collaborator rows. The share dialog renders a `People with access` list with the owner first, role badges for owner/collaborator, owner avatar/name/email when Clerk returns them, and collaborator remove controls only on collaborator rows. Owner rows appear for both project owners and read-only collaborators. ESLint clean and production build passes.

Build syntax fix: repaired malformed `collaboratorFilter` syntax in `lib/project-data.ts`, typed the Prisma project filter so case-insensitive email matching satisfies generated Prisma types, and repaired malformed braces in `lib/project-collaborators.ts`. ESLint clean and production build passes.

Feature 10: Liveblocks Setup - `liveblocks.config.ts` now defines cursor/isThinking presence and typed user metadata for name, avatar, and cursor color. Added cached Liveblocks Node client initialization in `lib/liveblocks.ts` plus deterministic Clerk user ID to cursor color mapping. Added `POST /api/liveblocks-auth`, which validates the Liveblocks room/project ID, requires Clerk auth, verifies project access with `getAccessibleProject`, creates the private Liveblocks room if needed, and returns a room-scoped session token with user metadata. `/api/liveblocks-auth` is allowed through proxy so the route can return JSON `401` responses. Added missing `@liveblocks/node` dependency. ESLint clean and production build passes.

Feature 11: Base Canvas - replaced the workspace placeholder with a client-side Liveblocks canvas wrapper at `components/editor/canvas-workspace.tsx`. The wrapper uses `LiveblocksProvider` with `/api/liveblocks-auth`, `RoomProvider` with the active room ID and initial cursor presence, `ClientSideSuspense` loading UI, and an error fallback for connection failures. React Flow is wired through `useLiveblocksFlow` with suspense, empty initial nodes/edges, loose connections, `fitView`, `MiniMap`, and dot-pattern background. Added shared canvas node/edge schema, node color palette, and node shape constants in `types/canvas.ts`; Liveblocks storage is typed for the synced flow. React Flow base styles are imported globally. ESLint clean and production build passes.

Feature 12: Shape Panel - added a bottom-center floating shape toolbar with draggable icon buttons for rectangle, diamond, circle, pill, cylinder, and hexagon nodes. Drag payloads now include the shape and default size; the canvas handles dragover/drop events, converts screen coordinates with React Flow, and creates Liveblocks-synced custom canvas nodes with empty labels, default colors, shape data, and generated IDs based on shape, timestamp, and counter. Added a basic custom node renderer that displays all shapes as bordered rectangles for this unit. Production build passes.

Hydration fix: `EditorNavbar` now loads Clerk's `UserButton` as a client-only dynamic component with a stable same-size placeholder, preventing a server/client HTML mismatch during workspace hydration. ESLint clean and production build passes.

Issue 001 shape rendering fix: canvas nodes now render shape-specific geometry from `data.shape`, the bottom toolbar tracks an active shape for click-to-place behavior, newly created nodes use their shape as a registered React Flow custom node type, and the legacy `canvasNode` type remains registered for saved nodes. ESLint clean and production build passes.

Issue 002 overlay layout fix: workspace panels no longer resize the canvas. The Projects sidebar remains a fixed overlay without workspace padding, the AI assistant panel now slides in as a fixed overlay with a close button, and outside workspace interaction dismisses open overlays without blocking canvas interaction. ESLint clean and production build passes.

Issue 003 node ID collision fix: canvas node creation now uses `crypto.randomUUID()` for shape node IDs instead of a timestamp plus module-local counter, preventing cross-client ID collisions in shared Liveblocks state. ESLint clean and production build passes.

Feature 13: Node Shape - replaced duplicated placeholder shape logic with shared shape rendering for canvas nodes and drag previews. Rectangle, pill, and circle use CSS border radius shapes; diamond, hexagon, and cylinder use scalable inline SVG geometry with subtle resting borders and bright selected borders. Shape drags now show a cursor-attached ghost preview using the same shape type and default size payload used on drop, and the preview clears after drop/cancel without changing node creation behavior. ESLint and `tsc --noEmit` clean. Production build compiled app code but external Google font fetches failed during `next/font` asset resolution in this environment.

Feature 14: Node Editing - selected canvas nodes now show subtle React Flow resize handles with minimum dimensions, and resize changes flow through the existing Liveblocks-backed node state. Node labels now render centered placeholder text when empty, open an overlaid centered textarea on double-click, update collaboratively as users type, and close on blur or Escape while blocking text interactions from dragging or panning the canvas. ESLint, `tsc --noEmit`, and production build pass.

Feature 15: Node Color Toolbar - selected canvas nodes now render a compact floating swatch toolbar above the node using the predefined `NODE_COLORS` fill/text pairs. Swatch interactions are marked `nodrag nopan` and stop propagation so they do not drag nodes or pan the canvas. Choosing a swatch updates both node background and text color immediately through the existing Liveblocks-backed node state with no server calls. ESLint, `tsc --noEmit`, and production build pass.

Feature 16: Edge Behaviour - new canvas connections are created as custom `canvasEdge` edges with light rounded strokes, arrowheads, and wider invisible interaction paths. Existing rendered edges are normalized through the custom renderer so hover and selection brighten them without increasing visible stroke width. Edge labels are stored in collaborative edge data, rendered via `EdgeLabelRenderer` using the midpoint coordinates from `getSmoothStepPath`, and edited inline on double-click with save-on-blur, Enter, or Escape behavior. Node connection handles remain available on all four sides with subtle hover reveal. ESLint, `tsc --noEmit`, and production build pass.

Issue 003 canvas click creation fix: the shape toolbar now starts with no active tool, empty pane clicks exit without creating nodes unless a shape has been explicitly selected, and click/drop node placement resets the toolbar back to the neutral pointer state afterward. ESLint, `tsc --noEmit`, and production build pass.

Feature 17: Canvas Ergonomics - added a bottom-left floating pill control bar with zoom out, fit view, zoom in, undo, and redo controls separated into zoom and history groups. Zoom actions use the active React Flow instance with short animated transitions. Undo and redo use Liveblocks history hooks with disabled states driven by `useCanUndo` and `useCanRedo`. Added `hooks/use-keyboard-shortcuts.ts` for canvas shortcuts: `+`/`=` zoom in, `-` zoom out, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, and Cmd/Ctrl+Y redo, while skipping inputs, textareas, selects, and editable fields. Removed the bottom-right minimap. ESLint, `tsc --noEmit`, and production build pass.

Feature 18: Starter Template Library - added `components/editor/starter-templates.ts` with three shared-schema templates: microservices commerce, CI/CD pipeline, and event-driven orders. Added `components/editor/starter-templates-modal.tsx` with scrollable template cards, fixed-viewport SVG previews calculated from template node bounds, and import actions. The workspace navbar now includes a starter template entry point, and selecting a template replaces the current collaborative canvas by deleting existing nodes/edges, adding the template nodes/edges through the existing Liveblocks React Flow change flow, and fitting the view after import. ESLint, `tsc --noEmit`, and production build pass.

## In Progress

- None.

## Open Questions

- None.

## Next Steps

- Move to the next feature spec.
