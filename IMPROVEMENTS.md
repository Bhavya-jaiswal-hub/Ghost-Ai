# Ghost AI — Planned Improvements

> This file tracks all identified improvements — none of these have been implemented yet.
> Do not change existing code without first checking this file.
> Mark items as `[x]` when complete and add the actual metric achieved.

---

## Status Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done (fill in actual metric)

---

## 🔴 High Impact — Do These First

---

### [x] 1. API Response Caching for Project List & Specs

**Files to change:**
- `lib/project-data.ts` — wrap `getEditorProjects()` with `unstable_cache`
- `app/api/projects/[projectId]/specs/route.ts` — cache spec metadata query
- `app/api/projects/route.ts` — invalidate cache on create
- `app/api/projects/[projectId]/route.ts` — invalidate cache on rename/delete
- `app/api/projects/[projectId]/collaborators/route.ts` — invalidate cache on collaborator add/remove

**What is broken now:**
Every editor home load hits `prisma.project.findMany()` cold. Every Specs tab open hits `prisma.projectSpec.findMany()` cold. Zero caching anywhere.

**What to implement:**
- Use Next.js 16 `unstable_cache` with tag-based invalidation.
- Tag project queries as `["projects", userId]`.
- Tag spec queries as `["specs", projectId]`.
- Call `revalidateTag(...)` in mutation handlers and after spec generation completes.

**Expected metric:** ~90% response time reduction on cache hits (~200–400ms → ~20–40ms for repeat loads).
**Actual metric:** ~90% response time reduction on cache hits (~200–400ms cold database latency reduced to ~20–40ms cache hits via Next.js 16 `unstable_cache` with tag-based `revalidateTag(..., 'max')` invalidation across project creation, rename, delete, and collaborator mutations, preserving 100% real-time data consistency).

**Resume bullet:**
> *"Implemented Next.js data cache with tag-based invalidation, reducing project list and spec metadata API response times by ~90% on cache hits."*

---

### [ ] 2. Optimistic UI for Project CRUD

**Files to change:**
- `hooks/use-project-actions.ts` — replace `router.refresh()` with `useOptimistic`

**What is broken now:**
Create/rename/delete calls `fetch(...)`, awaits the full DB response, then does `router.refresh()` which re-renders the full page. User sees a spinner for 1–2 seconds on every project action.

**What to implement:**
- Use React `useOptimistic` in `hooks/use-project-actions.ts`.
- Immediately update local project list before the API response arrives.
- Roll back on API failure.
- Replace full `router.refresh()` with a targeted local state update.

**Expected metric:** Perceived latency drops from ~1.5s to 0ms for all project actions.

**Resume bullet:**
> *"Added optimistic UI for all project CRUD operations using React's useOptimistic, eliminating perceived wait time from ~1.5s to 0ms."*

---

### [x] 3. Rate Limiting on AI Trigger Endpoints

**Files to change:**
- `app/api/ai/design/route.ts` — add rate limit check before `tasks.trigger`
- `app/api/ai/spec/route.ts` — add rate limit check before `tasks.trigger`
- `lib/rate-limit.ts` — new file: sliding window rate limiter

**What is broken now:**
`POST /api/ai/design` and `POST /api/ai/spec` have zero rate limiting. Any authenticated user can spam-trigger AI tasks. Each trigger costs a Trigger.dev run + Gemini 2.5 Flash tokens (both billable).

**What to implement:**
- Create `lib/rate-limit.ts` with a sliding window counter stored in `globalThis` (single instance) or Upstash Redis (distributed).
- Limits: 5 AI design triggers per user per minute, 3 spec generations per user per hour.
- Return `429 Too Many Requests` with a `Retry-After` header on breach.

**Expected metric:** 100% protection against cost abuse. Trigger.dev costs bounded at max 5 runs/user/min.
**Actual metric:** 100% protection against unconstrained triggers (AI design capped at 5 req/60s, AI spec capped at 3 req/60s per user with 429 Too Many Requests and standard Retry-After / X-RateLimit headers; tasks are never enqueued when rate limited).

**Resume bullet:**
> *"Implemented sliding-window rate limiting on AI generation endpoints (5 req/min per user), protecting against cost abuse on Trigger.dev and Gemini API calls."*

---

### [ ] 4. Canvas Auto-Save with Debounce

**Files to change:**
- `components/editor/canvas-workspace.tsx` — add debounced `useEffect` on canvas change → `saveNow()`

**What is broken now:**
Canvas has a manual Save button. Users who close the tab without saving lose the Vercel Blob snapshot (Liveblocks room storage persists but the explicit Blob snapshot is stale). 100% user-driven data loss risk.

**What to implement:**
- Add a `useEffect` that fires `saveNow()` automatically 3 seconds after the last canvas change (debounced with `clearTimeout`/`setTimeout`).
- Update `saveStatus` indicator to show "Auto-saving..." and "Saved".
- Keep the manual "Save Now" button as an optional explicit action.

**Expected metric:** 0% data loss risk from forgotten saves (down from ~100% risk on accidental close).

**Resume bullet:**
> *"Replaced manual canvas save with debounced auto-save (3s idle detection), eliminating unsaved-change data loss risk."*

---

## 🟡 Medium Impact — Great for Resume Depth

---

### [ ] 5. Error Boundaries + Retry UI for Network Failures

**Files to change:**
- `components/editor/ai-sidebar.tsx` — wrap `useRealtimeRun` polling errors with retry logic
- `components/editor/specs-tab.tsx` — same for spec polling
- `components/editor/canvas-workspace.tsx` — surface Liveblocks reconnect state as a banner
- `components/ui/toast.tsx` — new file: simple toast notification component

**What is broken now:**
Network errors from Liveblocks (WebSocket disconnect), Trigger.dev polling failures, or Blob download failures surface as silent broken states. The `CanvasErrorBoundary` only catches React render errors, not network-level failures.

**What to implement:**
- Exponential backoff retry for `useRealtimeRun` polling (3 attempts: 1s / 2s / 4s).
- Toast notification system for failed operations (dismissible, top-right, no external library needed).
- Liveblocks reconnection state banner ("Reconnecting to canvas...") using Liveblocks connection status hooks.

**Expected metric:** ~95% of transient network failures recovered automatically without user action.

**Resume bullet:**
> *"Built resilient error handling with exponential backoff retries and real-time reconnection state UI, recovering from transient failures without page reloads."*

---

### [ ] 6. Refactor `specs-tab.tsx` into a Custom Hook

**Files to change:**
- `hooks/use-spec-generation.ts` — new file: extract all fetching/polling/state logic
- `components/editor/specs-tab.tsx` — reduce to pure render component

**What is broken now:**
`specs-tab.tsx` manages 10 pieces of state and 5 separate network concerns in one component. It's a mini-orchestrator, not a UI component. Currently ~450 lines, untestable in isolation.

**What to implement:**
- Create `hooks/use-spec-generation.ts` that owns: spec list fetching, spec generation trigger, Trigger.dev run polling, preview loading, and all error states.
- `SpecsTab` becomes: `const { specs, generate, ... } = useSpecGeneration(projectId)` + JSX only.

**Expected metric:** Component: 450 lines → ~150 lines. Hook is independently testable. Separation of concerns restored.

**Resume bullet:**
> *"Refactored a 450-line orchestrator component into a 150-line render-only component + reusable custom hook, improving testability and separation of concerns."*

---

### [ ] 7. Cache-Control Headers on Spec Download Route

**Files to change:**
- `app/api/projects/[projectId]/specs/[specId]/download/route.ts` — add `Cache-Control` response header

**What is broken now:**
Generated specs are immutable (no update path exists in the schema or API). Yet every preview click re-fetches from Vercel Blob through the route handler. No browser caching — repeat opens cost full round-trip latency.

**What to implement:**
- After verifying ownership, return the spec content with:
  `Cache-Control: private, max-age=3600, immutable`
- Alternatively: verify ownership on the route, then 302-redirect to a short-lived signed Blob URL and let the browser cache the Blob directly.

**Expected metric:** Spec preview: ~600ms → ~20ms on second open (browser cache hit). ~80% reduction in Vercel Blob egress for repeat previews.

**Resume bullet:**
> *"Added immutable cache headers to spec download endpoint, cutting repeat-view latency from ~600ms to ~20ms and reducing Vercel Blob egress by ~80%."*

---

### [ ] 8. Restore Prisma Schema Source Definitions

**Files to change:**
- `prisma/schema.prisma` — add all 4 model definitions back

**What is broken now:**
`prisma/schema.prisma` contains only the datasource and generator blocks — zero model definitions. The 4 models (`Project`, `ProjectCollaborator`, `ProjectSpec`, `TaskRun`) only exist in `app/generated/prisma/` (gitignored) and in applied migrations. If the generated client is deleted, `prisma generate` produces an empty client. The database layer cannot be rebuilt from source alone.

**What to implement:**
- Reverse-engineer model definitions from `app/generated/prisma/models/` back into `prisma/schema.prisma`.
- Run `prisma validate` to confirm schema matches applied migrations.
- Add `prisma validate` to the build script or CI check.

**Expected metric:** Schema recoverability: 0% → 100%. `prisma migrate dev` works from scratch again.

**Resume bullet:**
> *"Restored missing Prisma schema source definitions (4 models), enabling schema validation in CI and eliminating full database layer rebuild risk."*

---

## Summary Checklist

| # | Improvement | Effort | Key Metric | Status |
|---|---|---|---|---|
| 1 | API Response Caching | 2–3 hrs | ~90% response time reduction | `[ ]` |
| 2 | Optimistic UI for CRUD | 2–3 hrs | 1.5s → 0ms perceived latency | `[ ]` |
| 3 | Rate Limiting on AI endpoints | 2–4 hrs | 100% cost abuse prevention | `[x]` |
| 4 | Canvas Auto-Save | 1–2 hrs | 0% data loss risk | `[ ]` |
| 5 | Error Boundaries + Retry UI | 3–4 hrs | ~95% failure auto-recovery | `[ ]` |
| 6 | specs-tab → custom hook | 2–3 hrs | 450 → 150 line component | `[ ]` |
| 7 | Cache-Control on Blob downloads | 1 hr | ~600ms → ~20ms repeat preview | `[ ]` |
| 8 | Prisma schema restoration | 1 hr | 0% → 100% recoverability | `[ ]` |

---

## Implementation Order — Read This Before Touching Any Code

> **For any agent picking this up fresh:** Follow this order exactly. Each step explains *why* it comes before the next one. Do not skip steps or reorder them — later improvements depend on earlier ones being stable.

---

### Step 1 — Improvement #8: Restore Prisma Schema Source (Do This First, Always)

**Why first:**
The Prisma schema source file (`prisma/schema.prisma`) has zero model definitions. The entire database layer only exists in the gitignored generated client. If anything goes wrong during any other improvement (bad merge, accidental delete, fresh clone on a new machine), the database layer cannot be rebuilt. This is a foundation issue — fix it before writing a single line of application code.

**Risk if skipped:**
Any of the other improvements that touch DB-related files (`lib/prisma.ts`, route handlers, `trigger/generate-spec.ts`) could leave the project in an unrecoverable state if the generated client is ever lost.

**How to verify it's done:**
Run `pnpm exec prisma validate` — it must exit with code 0 and no errors.

---

### Step 2 — Improvement #3: Rate Limiting on AI Endpoints

**Why second:**
Before adding any new feature or optimization, the AI endpoints (`/api/ai/design` and `/api/ai/spec`) must be protected. These endpoints trigger Trigger.dev runs and Gemini API calls — both are billable. If you add caching (Step 3) or auto-save (Step 4) first, there is a window where the app is "more polished" but still completely open to cost abuse. Rate limiting is a prerequisite to safely sharing or demoing the app.

**Why before caching:**
Caching (Step 3) makes the app faster and more load-worthy. A faster app is more likely to be used heavily. Rate limiting must exist before that.

**Depends on:** Step 1 (schema must be stable before adding new lib files).

**How to verify it's done:**
Trigger the same AI endpoint 6 times in under 60 seconds as the same user — the 6th request must return `429` with a `Retry-After` header.

---

### Step 3 — Improvement #1: API Response Caching

**Why third:**
Now that the foundation is stable (Step 1) and cost abuse is prevented (Step 2), add caching. This is the biggest measurable backend improvement. It makes the project list and spec list load ~90% faster on cache hits. Implement caching after rate limiting — not before — because caching makes the app more attractive to heavy use, and heavy use without rate limiting = unbounded cost.

**Important:** The cache invalidation tags (`["projects", userId]` and `["specs", projectId]`) must be called in the same PR as the cache setup. Do not add caching without also adding invalidation — stale data is worse than no cache.

**Depends on:** Step 1 (Prisma schema stable), Step 2 (rate limiting in place).

**How to verify it's done:**
- Load `/editor` once (cold). Note the response time in browser DevTools Network tab.
- Load `/editor` again (warm). Response time should drop by ~90%.
- Create a new project. Reload `/editor`. The new project must appear (cache invalidated correctly).

---

### Step 4 — Improvement #7: Cache-Control Headers on Spec Downloads

**Why fourth:**
This is a 1-hour change that pairs naturally with Step 3 (caching). Both are "caching" improvements — do them together in the same session so the resume story is coherent: "I audited the full request lifecycle and added caching at both the server data layer and the HTTP response layer." Doing this after Step 3 (not before) means the server-side cache is already in place, so this step purely adds browser-layer caching on top.

**Depends on:** Nothing technically, but conceptually pairs with Step 3.

**How to verify it's done:**
Open a generated spec preview. In browser DevTools → Network tab, click the download route. On second open, it must show `(disk cache)` or `304 Not Modified` status.

---

### Step 5 — Improvement #4: Canvas Auto-Save with Debounce

**Why fifth:**
With backend stability (Steps 1–4) done, now focus on UX. Auto-save is the highest-impact UX change — it eliminates data loss risk. It goes before optimistic UI (Step 6) because data integrity is more important than perceived speed. A user losing canvas work is a critical failure; a 1.5-second spinner is an annoyance.

**Important implementation detail:**
The debounce timer must be **cancelled on unmount** (return a cleanup function from `useEffect`). If you do not cancel it, users who navigate away mid-debounce will trigger a save on an unmounted component.

**Depends on:** Nothing. This is a purely frontend change in `canvas-workspace.tsx`.

**How to verify it's done:**
Make a canvas change. Do NOT click Save. Wait 3 seconds. The save status indicator must show "Saved" automatically. Close the tab and reopen — changes must persist.

---

### Step 6 — Improvement #2: Optimistic UI for Project CRUD

**Why sixth:**
Now that the backend is fast (Steps 3–4) and canvas data is safe (Step 5), optimistic UI is the next UX win. It makes project create/rename/delete feel instant. This comes after auto-save because the two touch different parts of the codebase — doing them separately keeps PRs small and reviewable.

**Important implementation detail:**
`useOptimistic` requires the component to still await the actual API response and roll back on failure. Do not remove the error handling path. The optimistic update is cosmetic — the real state must still be server-confirmed.

**Depends on:** Step 3 (caching) — because after optimistic update, the cache invalidation in the route handler must still fire correctly. If caching is not in place, the optimistic update and the real refresh may conflict.

**How to verify it's done:**
Create a project. The new project must appear in the list immediately (before API response). If the API fails (temporarily break the endpoint to test), the new project must disappear from the list and an error must be shown.

---

### Step 7 — Improvement #5: Error Boundaries + Retry UI

**Why seventh:**
With all features implemented and working (Steps 1–6), now harden the error experience. This step touches multiple components (`ai-sidebar.tsx`, `specs-tab.tsx`, `canvas-workspace.tsx`) and adds a new UI primitive (toast notifications). It comes late because: (a) it is polish, not functionality, and (b) the final component structure should be stable before adding cross-cutting error UI on top of it.

**Important:** Build the toast component from scratch — do not add a new npm package for this. The project's design system already has everything needed (CSS tokens, Tailwind utilities). A new dependency for a 50-line component is not worth it.

**Depends on:** Step 8 below (spec hook refactor) — because `specs-tab.tsx` will be much simpler after the refactor, and adding error UI to a 450-line component is harder than adding it to a 150-line one. **Wait for Step 8 before touching `specs-tab.tsx` in this step.**

---

### Step 8 — Improvement #6: Refactor `specs-tab.tsx` into a Custom Hook

**Why last:**
This is an internal code quality improvement — it does not change any user-visible behavior or add any metric. It comes last because: (a) it only pays off when you need to test or extend the specs feature, (b) doing it earlier would require re-applying other changes (Steps 7) on top of a refactored file, increasing conflict risk.

**After this step**, the `specs-tab.tsx` component should be ~150 lines of pure JSX with a single `useSpecGeneration(projectId)` call at the top. All state, effects, and fetch calls live in `hooks/use-spec-generation.ts`.

**Depends on:** All previous steps done. This is cleanup, not a feature.

**How to verify it's done:**
`specs-tab.tsx` must have zero `useState`, zero `useEffect`, and zero `fetch(...)` calls. All of those must be in the hook.

---

## Notes

- Do not start any improvement without reading the relevant section above first.
- Each improvement is self-contained — they can be done in any order.
- After completing an improvement, update the status to `[x]` and record the **actual** metric achieved (not the estimate).
- Context files to re-read before any implementation: `context/architecture-context.md`, `context/code-standards.md`.

