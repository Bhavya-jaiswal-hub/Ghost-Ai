# Progress Tracker

## Current Phase

- Complete: `context/feature-specs/03-auth.md`

## Completed Work

- Read project, architecture, UI, code standards, AI workflow, and design-system context.
- Initialized shadcn/ui with the Next.js Nova preset.
- Generated initial `components/ui/button.tsx` and `lib/utils.ts` through the shadcn CLI.
- Added `card`, `dialog`, `input`, `tabs`, `textarea`, and `scroll-area` through the shadcn CLI.
- Confirmed `lucide-react` is installed.
- Aligned `globals.css` with the dark-only Ghost AI design tokens and mapped shadcn variables to the same palette.
- Applied the root `dark` class in `app/layout.tsx`.
- Verified lint, TypeScript, `cn()` class merging, and production build.
- Read `context/feature-specs/02-editor.md` and started the editor chrome implementation.
- Added `components/editor/editor-navbar.tsx` with left/center/right sections and a sidebar toggle using `PanelLeftOpen` / `PanelLeftClose`.
- Added `components/editor/project-sidebar.tsx` as a floating, slide-in project sidebar with tabs, empty states, close action, and a full-width `New Project` button.
- Wired the editor chrome into `app/page.tsx` with local sidebar state.
- Updated the existing dialog primitives to use Ghost AI color tokens, `rounded-3xl` modal styling, title/description support, and footer actions.
- Verified `npm.cmd run lint` and `npm.cmd run build`.
- Added `components/editor/editor-layout.tsx` so the editor navbar and project sidebar are composed in a reusable layout shell.
- Refactored `app/page.tsx` to render its content inside `EditorLayout`.
- Read `context/feature-specs/03-auth.md` and started the Clerk auth implementation.
- Installed `@clerk/ui` for Clerk's dark base theme support.
- Added shared auth route constants that use Clerk's standard public URL env vars with local auth route fallbacks.
- Added shared Clerk appearance configuration using existing Ghost AI CSS variables.
- Wrapped the root layout in `ClerkProvider` with `/sign-in` and `/sign-up` routes.
- Added protected-first `proxy.ts` route protection with public root, sign-in, and sign-up paths.
- Added minimal dark sign-in and sign-up pages with two-panel desktop layouts and form-only mobile layouts.
- Moved the editor workspace to `/editor` and changed `/` to redirect authenticated users to `/editor` and unauthenticated users to `/sign-in`.
- Added Clerk's built-in `UserButton` to the editor navbar.
- Verified `npm.cmd run lint` and `npm.cmd run build`.
- Refined the auth pages to use a 50/50 desktop split with a branded left panel, feature rows, centered Clerk form, and explicit Geist font styling across the app shell and Clerk elements.
- Re-verified `npm.cmd run lint` and `npm.cmd run build`.
- Added root body hydration warning suppression for browser-extension-injected attributes such as `cz-shortcut-listen`.
- Re-verified `npm.cmd run lint` and `npm.cmd run build`.
- Fixed Clerk sign-out to redirect directly to the configured sign-in route.
- Narrowed the Clerk auth form card so the right-side sign-in panel matches the intended 50/50 layout proportions.
- Moved the editor navbar profile avatar to the absolute right edge, reduced navbar padding, and centered navbar controls vertically.
- Removed the decorative brand strip from the auth left panel and tightened auth/root wrappers to full-width, overflow-hidden backgrounds.
- Split UserProfile-specific Clerk appearance overrides out of the provider appearance and passed them through `UserButton` profile props so the built-in manage account modal keeps its wider two-column layout.

## Open Questions

- None.

## Next Steps

- Move to the next feature spec.
