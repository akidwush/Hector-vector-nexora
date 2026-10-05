# Hard audit — mobile raster import, refresh recovery, Pen history

Date: 2026-10-05  
Scope: `akidwush/Hector-vector-nexora` only

## Findings

### Raster reference import

- `loadFileToCanvas(file)`, `loadRasterToCanvas(item)`, and `editor.placeImage(...)` already formed a working client-side import engine.
- Window drag/drop also routed raster files to that engine.
- The visible Library add action still routed its file picker to `uploadFiles(...)`. In the cloud build that requires the unavailable desktop backend.
- Android has no practical OS file drag/drop workflow, so the working client-side engine was unreachable from the normal mobile picker.

### Refresh recovery

- `hector-vector:last-doc` stored only a small source descriptor in `localStorage`.
- An unsaved/cloud canvas, embedded raster `data:` URLs, and undo/redo stacks were not stored.
- The default startup preference is a blank canvas, so a refresh discarded active cloud work unless it happened to point at a reloadable server resource.
- Large project data must not be written to synchronous, quota-small `localStorage`.

### Pen Undo/Redo

- Starting a Pen path opened one document-wide coalesced history action.
- `history.undo()` called `_finishPen(true)` before undoing, so Undo ended construction and removed the complete path.
- No draft-level point history existed while `_pen` was active.

## Implemented contract

- A dedicated PNG/JPEG picker is reachable from File and from the cloud Library add button. Files go through the existing client-side `loadFileToCanvas` path.
- The active document, embedded rasters, selection, and undo/redo stacks are stored in IndexedDB.
- Persistence is driven by a `MutationObserver` and idle/frame scheduling; there is no polling, DOM polling, or timer-based autosave.
- Reload navigation always restores the IndexedDB draft. A normal cold launch restores it only when the existing Resume preference is enabled.
- An active Pen construction owns a temporary point Undo/Redo stack. Undo/Redo changes one anchor and does not finish the path. Finishing the path still produces one normal document-history action.

## Verification

- All frontend ES modules parse.
- ESLint undefined-name guard passes.
- Python import, CSS token, smoke, capability, and text guards pass.
- Cloud bundle builds successfully (92 files).
- Dependency-free mobile behavior regression passes.
- Headless Chromium mobile verification passes at 360, 390, 412, and 430 px:
  - PNG picker creates a raster layer and image-sized canvas;
  - embedded raster survives reload through IndexedDB;
  - history survives reload;
  - Pen Undo removes one point while construction remains active;
  - Pen Redo restores that point;
  - no page errors or horizontal overflow.
