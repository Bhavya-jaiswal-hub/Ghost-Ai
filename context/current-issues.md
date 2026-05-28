# Current Issues

## [ISSUE-001] Shape Tool Selection Not Rendering Correct Shape Type

### Status
Resolved

### Priority
Medium

### Area
`components/editor` - Canvas - Shape Rendering

### Description
When a user selects any shape tool from the toolbar (diamond, circle, connector,
frame, hexagon, etc.), the canvas always renders a **rectangle** regardless of
which tool was selected. The selected tool state appears to update correctly in
the UI (toolbar highlights the active tool), but the shape dropped onto the
canvas does not reflect the chosen geometry.

### Steps to Reproduce
1. Open any project and enter the editor workspace.
2. In the bottom toolbar, click any non-rectangle shape tool
   (e.g., circle, diamond, hexagon).
3. Click or drag on the canvas to place a shape.
4. Observe that a rectangle is rendered instead of the selected shape type.

### Expected Behavior
Each toolbar tool should render its corresponding shape type on the canvas:
- Rectangle tool -> rectangle node
- Circle tool -> circle/ellipse node
- Diamond tool -> diamond node
- Hexagon tool -> hexagon node
- Frame tool -> frame node
- Connector tool -> edge/connector

### Actual Behavior
All shape tools produce a rectangle node on the canvas, identical to the default
rectangle tool output.

### Root Cause Hypothesis
The shape type is likely not being passed through when a new node is created.
Probable locations to investigate:

1. **Tool state -> node creation bridge**: The active tool type (e.g., `circle`,
   `diamond`) may not be read when constructing the new node object on canvas
   click/drop. Check the `onCanvasClick` or `onDrop` handler inside the editor.

2. **Node `type` field not set**: React Flow uses the `type` field on a node
   object to determine which custom node component to render. If all new nodes
   are being created with `type: "rectangle"` (or no type, falling back to
   default), all shapes will look like rectangles.

3. **Custom node type map incomplete**: The `nodeTypes` map passed to
   `<ReactFlow>` may only register a rectangle component, so even if `type` is
   set correctly, React Flow silently falls back to the default (rectangle)
   node renderer for unrecognised types.

4. **Shape panel / toolbar not wiring `shapeType` into node factory**: The
   `12-shape-panel.md` spec covers the toolbar; verify that the selected shape
   value is being forwarded to whatever utility function creates the new node.

### Files to Investigate
- `components/editor/` - canvas click/drop handler, node factory utility
- `components/ui/` - shape toolbar / shape panel component
- React Flow `nodeTypes` registration (likely in the editor workspace shell -
  see `08-editor-workspace-shell.md`)
- `11-base-canvas.md` and `12-shape-panel.md` specs for intended behaviour

### Acceptance Criteria
- [x] Selecting the circle tool and clicking the canvas produces a circle node.
- [x] Selecting the diamond tool and clicking the canvas produces a diamond node.
- [x] All shape types defined in the toolbar have a corresponding registered
      `nodeType` in React Flow.
- [x] Existing rectangle nodes on saved canvases are unaffected.
- [x] Shape type is preserved when the canvas state is persisted to Liveblocks
      and reloaded.

### Resolution
The canvas node renderer now reads the saved `data.shape` value and renders
shape-specific geometry for rectangle, circle, diamond, pill, cylinder, and
hexagon nodes. The React Flow `nodeTypes` map registers both the legacy
`canvasNode` type and each toolbar shape type, so existing saved nodes continue
to render while newly created nodes use the selected shape type directly.

The toolbar now tracks an active shape for click-to-place behavior, and drag/drop
creation still writes the selected shape into Liveblocks node data.

Frame and connector tools are not currently part of the implemented Feature 12
toolbar; this resolution covers every shape type currently defined in the
toolbar.

### References
- `context/feature-specs/11-base-canvas.md`
- `context/feature-specs/12-shape-panel.md`
- `context/feature-specs/08-editor-workspace-shell.md`
- `context/architecture-context.md`

## [ISSUE-002] Sidebar and AI Chat Panel Collapse Canvas Instead of Overlaying

### Status
Resolved

### Priority
High

### Area
`components/editor` - Layout - Panel Behavior

### Description
When the Projects sidebar or the AI Assistant chat panel is opened, it pushes
and collapses the canvas horizontally instead of floating above it. The canvas
should remain full width at all times; both panels should overlay on top of the
canvas without affecting its dimensions or layout.

### Steps to Reproduce
1. Open any project and enter the editor workspace.
2. Click to open the Projects sidebar (left panel).
3. Observe the canvas shrinks horizontally to accommodate the panel.
4. Same behavior occurs when opening the AI Assistant panel (right side).

### Expected Behavior
- Both panels open as overlays above the canvas
- Canvas maintains full width and height regardless of panel state
- Panels can be dismissed by clicking outside or closing them

### Actual Behavior
- Panels push the canvas and cause it to resize
- Canvas loses usable space when either panel is open

### Root Cause Hypothesis
The editor layout is likely using CSS Flexbox or Grid where the sidebar, canvas,
and AI panel are siblings in the same row. When a panel opens it takes up space
in the flex/grid layout forcing the canvas to shrink.

The fix is to make panels use `position: fixed` or `position: absolute` so they
sit outside the normal document flow and overlay the canvas without affecting
its size.

### Files to Investigate
- `components/editor/` - main editor layout wrapper
- `components/ui/` - sidebar and AI chat panel components
- `08-editor-workspace-shell.md` - intended layout behavior
- Check for `flex`, `grid`, or `width` based layout on the editor shell

### Fix Approach
Change panel positioning from layout-based to overlay-based:
- `position: fixed` or `position: absolute`
- `z-index` above the canvas
- Canvas wrapper should be `width: 100%` always independent of panel state

### Acceptance Criteria
- [x] Opening sidebar does not resize the canvas
- [x] Opening AI chat panel does not resize the canvas
- [x] Both panels overlay on top of the canvas
- [x] Canvas remains fully interactive when panels are open
- [x] Closing panels does not cause canvas to reflow or jump

### Resolution
The workspace shell no longer adds left padding to the canvas when the Projects
sidebar is open. The canvas now stays in an absolute full-size wrapper.

The AI assistant panel is now a fixed overlay with its own close button and
slide-in transform, rather than a flex sibling that consumes layout width.
Pointer-down handling on the workspace closes open overlays when users interact
outside them without preventing canvas interaction.

### References
- `context/feature-specs/08-editor-workspace-shell.md`
- `context/feature-specs/07-wire-editor-home.md`



---

## [ISSUE-003] Clicking Empty Canvas Area Creates Unwanted Rectangle Node

### Status
Resolved

### Priority
High

### Area
`components/editor` · Canvas · Node Creation

### Description
Clicking anywhere on the empty canvas area automatically creates a rectangle
node at the clicked position. This should not happen — node creation should
only occur when the user explicitly selects a shape tool from the toolbar
and then clicks on the canvas. Accidental clicks for panning, selecting, or
repositioning the view should never create nodes.

### Steps to Reproduce
1. Open any project and enter the editor workspace.
2. Make sure no shape tool is actively selected in the toolbar.
3. Click anywhere on the empty canvas area.
4. Observe that a rectangle node is created at the click position.

### Expected Behavior
- Clicking on empty canvas with no tool selected should do nothing
- Node creation should only happen when a shape tool is explicitly
  selected from the toolbar and the user clicks on the canvas
- Default canvas click behavior should be pan or select only

### Actual Behavior
- Every click on empty canvas creates a rectangle node
- Canvas behaves as if the rectangle tool is always active
- No way to click on canvas without accidentally creating nodes

### Root Cause Hypothesis
The `onCanvasClick` or `onPaneClick` handler in the canvas component
is likely creating a new node on every click without checking whether
a shape tool is currently selected.

Probable causes:

1. **No tool state check**: The click handler creates a node
   unconditionally without checking if `activeTool` is set to a
   shape type. It should only create a node when a shape tool is
   explicitly active.

2. **Default tool is set to rectangle**: The toolbar may be
   initializing `activeTool` to `rectangle` by default instead
   of a neutral `select` or `pointer` state, causing every click
   to trigger node creation.

3. **onPaneClick wired incorrectly**: React Flow's `onPaneClick`
   event may be connected directly to the node creation function
   instead of first checking tool state.

### Files to Investigate
- `components/editor/canvas-workspace.tsx` — check `onPaneClick`
  or `onCanvasClick` handler
- `components/ui/button.tsx` — check toolbar default tool state
- `components/editor/editor-workspace-shell.tsx` — check how
  active tool state is initialized and passed to canvas
- `12-shape-panel.md` — intended toolbar and tool selection behavior

### Fix Approach
- Add a tool state check inside the click handler:
  only create a node if `activeTool` is a shape type
- Set default `activeTool` to `pointer` or `select` on load
- After a node is created, reset `activeTool` back to `pointer`
  so the user must re-select a tool for the next node

### Acceptance Criteria
- [x] Clicking empty canvas with no tool selected does nothing
- [x] Node creation only happens when a shape tool is active
- [x] After placing a node the tool resets to pointer/select mode
- [x] Existing drag to pan behavior on empty canvas is unaffected
- [x] Existing node selection behavior is unaffected

### Resolution
The canvas now starts with no active shape tool instead of defaulting to the
rectangle tool. The pane click handler exits early unless a shape has been
explicitly selected from the toolbar, so ordinary empty-canvas clicks no longer
create nodes.

Click-to-place and drag-to-place creation both reset the active shape back to
the neutral pointer state after adding a node. Toolbar buttons can also be
clicked again to deselect the active shape without placing anything.

### References
- `context/feature-specs/11-base-canvas.md`
- `context/feature-specs/12-shape-panel.md`
- `context/feature-specs/08-editor-workspace-shell.md`


## [ISSUE-004] Delete Nodes and Edges

Read liveblocks agent skills before implementing this. Then read the canvas wrapper compoenent and the existing node and edge mutation helpers.


Selected nodes and edges cannot be deleted from the canvas.

Add a keydown event listener to the canvas wrapper that:

-listens for Delete and Backspace keys
-does not fire when the event target is an input, textarea,
or contenteditable element
-gets currently selected nodes using useNodes() filtered 
by selected State
-gets currently selected edges using useEdges() filtered
-by selected state
- remove them using the existing Liveblocks collaborative 
 mutuation helpers

Do not use React flow's built-in deleteKeyCode or any React flow keyboard deletion behaviour. All deletions 
must 
go through the existing liveblocks colloborative state so
they sync across all connected clients in real time.

Do not change anything else.

## [Issue- 005] Drag and Drop position Offset

Read liveblocks agent skill before implementing this.

when dropping a shape from the shape pannel onto the canvas, 
the node places below where the cursor actually is.

Check the drop handler in the canvas wrapper.The position 
calculation must account for:

-the drag offset from where the use grabbed the shape inside the drag element , not just the element's top-left
corner
-the canvas container's bounding rect
-the current React flow pan offset and zoom scale via screenFlowPosition or project

The node should appear with its center at the exact cursor 
position on drop. 


# [Issue 006]— AI Generated Canvas Nodes Cluster at One Point Instead of Spreading Across Canvas

Status: Resolved

Description
When the AI design agent generates an architecture, all nodes render clustered in one corner/point of the canvas (top-right area) instead of being distributed across the canvas with proper spacing and layout.
Expected Behavior
Nodes should be spread across the canvas in a readable left-to-right or top-to-bottom flow layout, similar to the reference screenshot — with clear spacing between nodes, logical grouping, and edges connecting them cleanly without overlap.
Actual Behavior
All generated nodes stack or cluster at a single point on the canvas, making the diagram unreadable. Edges overlap and node labels are barely visible.
Root Cause
The AI agent is generating nodes without valid or distributed position values (x, y). Either:

positions are all defaulting to { x: 0, y: 0 } or a single hardcoded point
the layout algorithm is not being applied after node generation
or the canvas viewport is not being fit/reset after nodes are placed

Fix
In trigger/design-agent.ts:

ensure every generated node has a unique, calculated position based on its role in the architecture (e.g. row/column grid, dagre layout, or manual tier-based spacing)
apply a layout pass (dagre or simple tier-based x/y calculation) before pushing nodes to Liveblocks
after generation completes, trigger a fitView on the React Flow canvas so all nodes are visible

References

trigger/design-agent.ts — node generation and position assignment
context/architecture-context.md — layout and spacing rules
React Flow docs on fitView and node positioning

Acceptance Criteria

- [x] Generated nodes are distributed across the canvas with clear spacing
- [x] No two nodes overlap on generation
- [x] Edges connect nodes cleanly without crossing through unrelated nodes
- [x] Canvas fits all generated nodes in view after generation completes
- [x] npm run build passes

Resolution
The design agent now lays out generated nodes itself before mutating the
Liveblocks React Flow state. New nodes are grouped into left-to-right columns
from generated edge relationships, same-column nodes are spaced vertically, and
new diagrams start to the right of existing canvas content to avoid overlap.

The canvas also listens for the existing AI completion room event and calls
React Flow `fitView` after the collaborative update lands, so generated
architectures are immediately visible.

Follow-up
The generated-node layout was tightened to use a bounded architecture-layer
grid: client/user entry, gateway/API, services/workers, and data/storage.
Generated nodes in the same layer are spaced at least 170px apart vertically,
and directly connected generated nodes are compacted into neighboring columns
so edge endpoints do not drift into very large x positions.
Sonnet 4.6


# [Issue 007] — AI Sidebar Missing "Chat" Tab, Only Shows "AI Architect" and "Specs"
Description
The AI sidebar is missing the dedicated Chat tab. Currently only "AI Architect" and "Specs" tabs are visible. The chat feed logic (ai-chat Liveblocks feed) is wired up in the backend but the Chat tab is either not rendered or merged incorrectly into the AI Architect tab.
Expected Behavior
The sidebar should show three tabs: AI Architect, Chat, and Specs — matching the reference screenshot. The Chat tab should display room chat messages with sender name, timestamp, and message content, with the existing input and send button wired to the ai-chat feed.
Actual Behavior
Only two tabs render: AI Architect and Specs. Chat messages from the ai-chat feed have no dedicated tab to display in. Users cannot see or send room chat messages from the sidebar.
Root Cause
In components/editor/ai-sidebar.tsx the Tabs component is likely only defining two TabsTrigger and TabsContent entries (architect and specs). The Chat tab trigger and its content panel were either never added or were removed during a previous refactor.
Fix
In components/editor/ai-sidebar.tsx:

add a third TabsTrigger with value chat and label Chat between AI Architect and Specs
add the corresponding TabsContent with value chat
move the ai-chat feed subscription, message list, and input/send button into this ChatTab content panel
keep AI Architect tab for prompt submission and run status only
ensure tab styling stays consistent — active tab uses accent styling, inactive uses muted text

References

components/editor/ai-sidebar.tsx — tab definitions and content panels
types/tasks.ts — chat message Zod schema
Spec 25 — ai-chat feed wiring and message validation

Acceptance Criteria

- [x] Sidebar shows three tabs: AI Architect, Chat, Specs
- [x] Chat tab renders messages from ai-chat feed with sender, timestamp, content
- [x] Input and send button in Chat tab post to ai-chat feed
- [x] AI Architect tab is unchanged
- [x] npm run build passes

Status: Resolved

Resolution
The AI sidebar now defines a three-column tab list with AI Architect, Chat, and Specs. The validated `ai-chat` feed message list and room-only chat composer live in the Chat tab, while the AI Architect tab stays focused on starter prompts, design prompt submission, and active run status.

# [Issue 008] —  AI Generated Nodes Overlap in Production But Layout Correctly in Local Dev

Status: Resolved

Description
When the AI design agent generates an architecture in production (Trigger.dev cloud), all nodes render centered and overlapping at the same point. The exact same prompt works correctly in local development where nodes are properly distributed horizontally and vertically across the canvas.
Expected Behavior
Generated nodes should be distributed across the canvas with proper horizontal and vertical spacing regardless of environment — identical behavior in local dev and production.
Actual Behavior
In production all nodes render at the same position, causing complete overlap. The diagram is unreadable. Local dev works correctly.
Investigation Checklist
Before fixing, the agent should check the following in trigger/design-agent.ts:
1. Layout library dependency

Is dagre, elkjs, or any other layout library being used for position calculation?
Is that library listed in dependencies or only devDependencies in package.json?
If it's in devDependencies it won't be available in the Trigger.dev production bundle

2. Position calculation

Are node positions calculated before or after being pushed to Liveblocks?
Is the layout function async? If so, are positions being awaited properly?
Is there any setTimeout or deferred execution around position assignment?
What is the default/fallback position when calculation fails — is it {x:0, y:0}?

3. Environment differences

Does the layout function use window, document, or any browser API that doesn't exist in Node.js/Trigger.dev cloud?
Does it rely on React Flow's getLayoutedElements which only works client-side?
Are there any try/catch blocks silently swallowing layout errors and falling back to {x:0, y:0}?

4. Logging

Are there any logs showing what positions are being assigned before pushing to Liveblocks?
Check Trigger.dev run logs for the production run — do positions show as 0,0 or undefined?

Root Cause Hypothesis
Most likely one of:

Layout library is in devDependencies only → not bundled in production deploy
Layout function uses a browser/React API that fails silently in Node.js cloud environment
try/catch swallows layout error and falls back to {x:0, y:0} for all nodes
Async layout not properly awaited before Liveblocks push

Confirmed Root Cause
The production task was already using Node-compatible pure math layout and no
external layout library. The fragile path was the layout map key: generated node
positions were keyed by the AI-provided temporary id or, when absent, the label.
If production model output reused ids or labels, multiple add-node actions
resolved to the same layout entry and were pushed to Liveblocks at the same
position. Local runs could appear correct when the model happened to emit unique
temporary ids.

Fix Direction
Once root cause is confirmed:

If library missing in prod → move to dependencies or replace with pure math layout
If browser API used → replace with Node.js compatible pure function
If silent failure → add explicit error logging around layout calculation
Add position validation guard — if any node has x:0, y:0 after layout, apply tier-based fallback using layerIndex * 300 and nodeIndex * 180
Log all final node positions to Trigger.dev run logs before pushing to Liveblocks

References

trigger/design-agent.ts — node generation and position assignment
package.json — check layout library is in dependencies not devDependencies
context/architecture-context.md — layout and spacing rules
Trigger.dev run logs — check actual position values in production

Acceptance Criteria

- [x] Root cause identified and documented
- [x] Node positions are never {x:0, y:0} or undefined after layout
- [x] Layout works identically in local dev and production
- [x] Final node positions are logged to Trigger.dev before Liveblocks push
- [x] No browser/client APIs used in the Trigger.dev task
- [x] npm run build passes

Resolution
The design agent now keys layout positions by each add-node action's index in
the generated plan instead of by model-supplied ids or labels, so duplicate or
missing temporary identifiers cannot collapse generated nodes onto one
coordinate. Edge tiering still uses the first matching model reference for
source/target ordering, but every generated node receives its own final
position.

Empty-canvas generated diagrams now start from a non-zero origin, and the task
logs the final generated node positions to Trigger.dev immediately before
mutating the shared Liveblocks React Flow state. The add-edge mapping path also
resolves nodes through the same reference helper used by layout, improving
production robustness when the model omits explicit ids.

