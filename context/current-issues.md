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
