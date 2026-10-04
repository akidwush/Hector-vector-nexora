# Hector Vector — Hard Audit Source, Mobile UI & Tool Icons

**Audit date:** 2026-10-05  
**Scope:** the uploaded Hector Vector ZIP only. No remote repository, deployment, or account changes are part of this work.

## Executive result

The editor engine is not the reason the phone build feels uncomfortable. The strongest problem is the **phone shell composition**: the original portrait layout keeps the desktop idea of permanent vertical tool rails on both sides of the canvas. On a ~390 px phone the left tool rail is roughly 59 px wide and the right action rail roughly 55 px wide (button + padding + border), so about **114 px / 29% of the viewport** is spent before the artwork gets the remaining width. On a 360 px device the cost is ~32%.

The second strong problem is the icon language. The HTML uses assorted font glyphs such as `▣`, `✥`, `✒`, `⌒`, `◳`, `⚔`, `∪`, `∩`, `⧉⁺`, `⊳`, etc. Their appearance depends on the platform font, so Android/iOS/desktop do not necessarily render the same symbol, stroke, baseline, or visual weight. Several are mathematically clever but not immediately recognizable as editing tools.

This pass therefore changes **composition + icon language**, not the vector engine.

## Architecture understood

Hector Vector is intentionally a no-build application.

- `src/hv/` — side-effect-free vector/math layer: paths, transforms, shapes, colour, raster sampling, contours/booleans and curve fitting.
- `src/editor.js` + `src/editor/` — live SVG editor: selection, undo snapshots, layers, booleans, inspector rows and feature/tool mixins.
- `src/app.js` + `src/ui/` — application shell: dock system, menus, colour picker, Library, Processor, Info, export, mobile composition, adaptive action ranking, toolbar layout and pointer drag.
- `web/app.html` + `web/style.css` — authored editor DOM and all visual/layout rules. No bundler transforms them before production.
- `server.py` — compatibility/facade entry point.
- `hvserver/` — actual backend modules: paths/config, capabilities, files, jobs, models, engines, pipeline, documents, system, HTTP, PDF/EPS export.
- `engine.py` — classical mask/cutout image operations.
- `tools/` — worker programs for vectorization, SVG rendering/simplification, background removal, upscaling, face restoration, LaMa inpainting, analysis and document/geometry operations.
- `web/functions/_middleware.js` — small Cloudflare host router only; the browser editor remains the same source tree.

The backend shape is generally healthy: process execution uses argument arrays instead of shell strings, the local HTTP server binds to `127.0.0.1`, write requests check loopback/same-origin, companion CORS is exact-origin opt-in, and static file routes resolve + verify their allowed roots.

## High-priority UI findings in the original ZIP

### P0 — Portrait spends scarce width on permanent side rails

Original `web/style.css` changes the portrait phone editor to:

```css
grid-template-columns: auto minmax(0, 1fr) auto;
```

with `.toolstrip` on the left and `.actionbar` on the right. The primary tool rail uses up to 48 px buttons plus rail padding/border; the action rail uses 44 px buttons plus padding/border. This is structurally expensive on a 360–430 px display and is the main cause of the compressed canvas feeling.

**Fix in this package:** portrait now uses a full-width canvas. The existing real `.toolstrip` and `.actionbar` are laid out as two horizontal bottom docks. No handlers are cloned and no editor command is removed. Short landscape deliberately keeps side rails because landscape has the opposite constraint: little height, more width.

### P0 — Tool icons depend on Unicode/platform fonts

The authored markup uses dozens of Unicode glyphs for toolbar semantics. Examples: `✥` nodes, `✒` pen, `⌒` curvature, `◳` shape builder, `⚔` knife, `⊳` width, and mathematical set glyphs for booleans.

**Fix in this package:** `src/ui/icon-system.js` installs one local SVG outline icon language. It uses a consistent 24×24 coordinate system, `currentColor`, round caps/joins and ~2 px strokes. The design reference is the familiar editor/icon language used by **Lucide** (`https://lucide.dev/`, ISC licensed), while the vectors in this package are embedded locally so Hector Vector gains no CDN or package dependency and keeps its no-build architecture.

### P1 — Panels control looked like branding rather than an action

The original `#mobile-panels` was a floating circular button showing the Hector Vector brand logo. This creates an ambiguous mental model: is it Home/brand, or Panels?

**Fix:** the same real button is moved into the compact portrait utility bar and receives a neutral panels/dock icon. It no longer duplicates the brand over the artwork on portrait.

### P1 — Top quick bar duplicated pinch-zoom controls

Original mobile composition moved Zoom Out, Fit, Actual Size and Zoom In into the always-visible quick bar even though touch already has pinch zoom. That makes the top bar horizontally dense.

**Fix:** portrait quick access keeps File/Panels, Undo/Redo, Fit, Actual Size and Select All. `+/-` remain available under View and pinch remains the primary touch zoom gesture.

### P1 — Mobile status band consumed too much height

The original touch status band budgets 44 px and up to two lines. This is useful teaching text, so removing it entirely would hurt discoverability, but a permanent two-line budget is expensive.

**Fix:** portrait keeps the teaching line but compresses it to a 36 px one-line ellipsis surface. Tool titles/long-press/help remain available for detail.

### P1 — UI identity was inconsistent, not merely “too rounded/too modern”

The editor is actually mostly utility-oriented, but its symbols came from many unrelated typographic sources. The mismatch between mathematical runes, emoji-like platform glyphs, brand-logo actions, square desktop controls and circular phone FAB creates the “generated/AI-ish” feeling more than one color or border radius does.

**Fix:** one SVG icon family, mild 7–9 px radii, restrained borders, no new glow/gradient/card decoration, and a clearer information hierarchy.

## Existing mobile work worth keeping

Not everything needed redesign. These existing decisions are good and were intentionally preserved:

- 44 px-class touch targets for the important phone controls.
- pointer-based toolbar reordering instead of HTML5 drag-and-drop.
- pinch zoom / two-finger pan at the canvas level.
- adaptive, selection-aware contextual actions with a cap on visible commands.
- one-panel-at-a-time tabbed bottom sheet instead of a stack of nested mobile scrollers.
- separate short-landscape shell.
- safe-area handling and body pinning to avoid mobile browser rubber-band/layout jumps.
- per-form-factor persisted toolbar layout.

## Source-code hard audit findings outside the visual pass

### P1 — Unescaped `innerHTML` interpolation exists in a few metadata/image surfaces

There are several `innerHTML` sinks across the UI. Most inject constant application templates, but some interpolate values such as item `name`/`url` into `<img>` markup, for example in Library/Info surfaces. If metadata can be influenced by an untrusted filename or remote response, escaping is preferable to direct string interpolation.

**Recommendation:** progressively replace variable-bearing HTML strings with `createElement`, `textContent`, and property assignment (`img.src`, `img.alt`). This is not required for the mobile layout patch and was not broadly refactored here to avoid changing unrelated behavior.

### P1 — Large application modules still carry high change risk

`src/app.js`, `src/editor.js`, and `web/style.css` are large, high-fan-out files. The backend has already moved in the right direction by splitting behavior under `hvserver/`; the frontend should continue the same strategy.

**Recommendation:** move future shell-specific CSS into dedicated `mobile.css` / component files or CSS layers; continue extracting narrow UI modules instead of adding another override stack to `style.css`.

### P2 — Mobile screenshots/documentation can drift from source

The repository’s screenshots are generated by the E2E suite, but the checked-in phone image can lag behind shell changes. The README in this package has been updated to describe the new portrait composition; screenshots should be regenerated in a browser-capable CI/dev environment.

### P2 — Pre-existing E2E Python syntax error

`tests/e2e/editor_e2e.py` contained a JavaScript-style `//` comment outside a Python string, making the test file fail Python parsing. It was changed to `#` while the mobile assertions were updated for the new horizontal portrait dock.

## Files changed by this mobile/UI pass

- `src/ui/icon-system.js` — **new** local outline icon system.
- `src/app.js` — installs the icon system.
- `src/ui/formfactor.js` — Panels joins mobile chrome; quick bar is reduced; portrait comments/policy updated.
- `src/ui/layout.js` — layout/overflow documentation updated for live horizontal-vs-vertical toolbar axes.
- `web/app.html` — Panels fallback is a neutral control rather than a duplicate logo.
- `web/style.css` — portrait canvas-first layout and icon/UI styling.
- `tests/e2e/editor_e2e.py` — mobile layout expectations follow the horizontal dock; pre-existing parse bug fixed.
- `README.md` — phone layout description updated.

## Verification performed

Passed locally:

- `node --check` on the modified JS modules.
- syntax check across the JavaScript source tree.
- `python -m py_compile tests/e2e/editor_e2e.py`.
- `python tests/test_css_tokens.py` — CSS custom-property audit passed.
- `python tests/test_imports.py` — imports passed; optional MCP package remains optional/skipped when unavailable.
- `python tests/test_smoke.py` — backend/vector smoke suite passed.

Browser visual automation could **not** be completed in this execution environment because Chromium navigation to local/file URLs was blocked by the environment administrator. Therefore this package does **not** claim a browser screenshot/E2E pass here. The source, syntax, CSS-token and backend smoke validations above are real; the visual mobile pass should still be opened once on a real Android/iOS browser before production deployment.

## Final mobile composition

Portrait order:

1. compact utility bar — File, Panels, Undo, Redo, Fit, 1:1, Select All;
2. full-width canvas;
3. primary drawing-tool dock (horizontal, scrollable, 44 px targets);
4. advanced/vector action dock (horizontal, scrollable, 40 px targets);
5. selection-only contextual command row when needed;
6. compact status/help line;
7. tabbed Panels sheet on demand.

Short landscape keeps the existing spatial editor metaphor: tools left, canvas center, actions right, context/global controls across the top.

That split is intentional: **portrait spends height to protect canvas width; landscape spends width to protect canvas height.**
