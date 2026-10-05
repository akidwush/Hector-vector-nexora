// Dependency-free regression checks for the viewport and Node Tool drag contracts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const noImports = (s) => s.replace(/^import\s+(?:[\s\S]*?\s+from\s+)?["'][^"']+["'];\s*/gm, '').replace(/^export\s+/gm, '');

const makeButton = () => ({
  hidden: true, disabled: true, dataset: {}, attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; },
  replaceChildren() {}, querySelector() { return null },
});
const button = makeButton(), deleteButton = makeButton(), joinButton = makeButton();
const appClasses = new Set();
const app = { classList: { toggle(name, on) { if (on) appClasses.add(name); else appClasses.delete(name); } } };
const paths = new Map();
const pathToAnchors = (el) => el.pa;
const node = new Function('document', 'setUiIcon', 'setStatus', 'nfmt', 'snap45',
  'pathToAnchors', 'rebuildSubs', 'penAnchorsToD', 'penPathD',
  noImports(source('src/editor/tools/node.js')) + '\nreturn nodeMixin;')(
  { querySelector: (q) => q === '#node-handle-link' ? button
    : q === '#node-delete-point' ? deleteButton
    : q === '#node-join-points' ? joinButton
    : q === 'main.app' ? app : null },
  (el, icon) => { el.icon = icon; }, () => {}, String, (_x, _y, x, y) => ({ x, y }),
  pathToAnchors,
  (anchors, subs) => ({ anchors, subs }),
  (anchors) => anchors.map((a) => `${a.x},${a.y}`).join(' '),
  (anchors, closed) => `${anchors.map((a) => `${a.x},${a.y}`).join(' ')}${closed ? ' Z' : ''}`,
);

const nd = {
  id: 'p', k: 1, x: 0, y: 0, inH: { x: -10, y: 0 }, outH: { x: 10, y: 0 },
  setOut(x, y, mirror) {
    this.outH = { x, y };
    if (mirror) this.inH = { x: -x, y: -y };
  },
};
const editor = { ...node, tool: 'node', _nodeSel: new Set(['p#1']),
  _nodeEls: new Map([['p#1', { nd, rect: { classList: { toggle() {} } } }]]),
  stageCTM: () => ({ inverse: () => ({}) }), push() {}, mountNodeHandles() {},
  _renderInspector() {}, _renderLayers() {}, _handleDragging: false,
  nodeById(id) { return paths.get(id) || null; },
};
globalThis.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
class Dot {
  handlers = {};
  classList = { add() {}, remove() {} };
  addEventListener(event, fn) { this.handlers[event] = fn; }
  removeEventListener(event) { delete this.handlers[event]; }
  setAttribute() {} setPointerCapture() {} releasePointerCapture() {}
}
const dot = new Dot();
const refs = { outLine: { setAttribute() {} }, outDot: dot,
  inLine: { setAttribute() {} }, inDot: new Dot() };
const drag = (x, y, altKey = false) => {
  dot.handlers.pointerdown({ pointerId: 1, stopPropagation() {}, preventDefault() {} });
  dot.handlers.pointermove({ pointerId: 1, clientX: x, clientY: y, altKey, shiftKey: false });
  dot.handlers.pointerup({ pointerId: 1, type: 'pointerup' });
};
editor._syncNodeHandleToggle();
assert.equal(button.icon, 'unlink');
editor.toggleNodeHandleLink();
assert.equal(button.icon, 'link');
assert.deepEqual(nd.outH, { x: 10, y: 0 }, 'toggle must not rewrite path');
editor._bindHandleDrag(dot, nd, 'out', refs);
drag(0, 15);
assert.deepEqual(nd.inH, { x: -10, y: 0 }, 'unlinked opposite stays fixed');
editor.toggleNodeHandleLink();
drag(5, 20);
assert.deepEqual(nd.inH, { x: -5, y: -20 }, 'linked tangent mirrors on next drag');
drag(3, 22, true);
assert.deepEqual(nd.inH, { x: -5, y: -20 }, 'desktop Alt overrides linked mode');

// Point actions are driven by selection, not by the presence of two Bezier handles.
const corner = { id: 'corner', k: 0, x: 0, y: 0, inH: null, outH: null };
editor._nodeSel = new Set(['corner#0']);
editor._nodeEls = new Map([['corner#0', { nd: corner, rect: { classList: { toggle() {} } } }]]);
editor._syncNodeHandleToggle();
assert.equal(button.hidden, true, 'corner has no handle link action');
assert.equal(deleteButton.hidden, false, 'corner still exposes explicit Delete point');
assert.equal(deleteButton.disabled, false);
assert.equal(deleteButton.attributes['aria-label'], 'Delete point');
assert.equal(appClasses.has('has-node-selection'), true);

const fakePath = (id, count = 3, closed = false) => {
  const attrs = new Map([['data-hv-id', id], ['d', 'original'], ['stroke', '#123456']]);
  return { pa: { editable: true, closed, subs: [{ start: 0, count, closed }],
      anchors: Array.from({ length: count }, (_, i) => ({ x: i * 10, y: 0, in: null, out: null })) },
    removed: false,
    getAttribute: (name) => attrs.get(name) || null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
    remove() { this.removed = true; paths.delete(id); },
  };
};
const pathA = fakePath('a'), pathB = fakePath('b'); paths.set('a', pathA); paths.set('b', pathB);
editor._nodeSel = new Set(['a#0', 'b#2']); editor._syncNodeActions();
assert.equal(deleteButton.attributes['aria-label'], 'Delete 2 points');
assert.equal(joinButton.disabled, false, 'two open endpoints enable Join');
assert.equal(joinButton.attributes['aria-label'], 'Join paths');
editor._nodeSel = new Set(['a#1', 'b#1']); editor._syncNodeActions();
assert.equal(joinButton.disabled, true, 'two interior points do not enable Join');

editor._nodeSel = new Set(['a#1']);
let deletePushes = 0; editor.push = () => { deletePushes++; };
assert.equal(editor.deleteNodeSelection(), true);
assert.equal(deletePushes, 1, 'point deletion is one history action');
assert.equal(pathA.pa.anchors.length, 2, 'exactly the selected point is removed');
assert.equal(editor._nodeSel.size, 0, 'point selection clears after delete');

let frame = { left: 0, top: 0, width: 390, height: 844 };
const content = { style: {} };
const media = { tagName: 'svg', getAttribute: (key) => key === 'width' ? '100' : '100' };
class EventTargetMock {
  constructor() { this.handlers = new Map(); this.isConnected = true; }
  addEventListener(type, fn) { const list = this.handlers.get(type) || []; list.push(fn); this.handlers.set(type, list); }
  removeEventListener(type, fn) { this.handlers.set(type, (this.handlers.get(type) || []).filter((v) => v !== fn)); }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const fn of [...(this.handlers.get(event.type) || [])]) fn(event);
    return !event.defaultPrevented;
  }
}
globalThis.PointerEvent = class {
  constructor(type, init = {}) { Object.assign(this, init); this.type = type; this.defaultPrevented = false; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
};
const frameEl = Object.assign(new EventTargetMock(), {
  clientWidth: 390, clientHeight: 844, getBoundingClientRect: () => frame,
  querySelector: (q) => q === '.viewport-content' ? content : media,
});
const documentMock = { querySelector: () => null };
const viewportWindow = { innerWidth: 390, innerHeight: 844 };
let observer;
class RO { constructor(cb) { this.cb = cb; observer = this; } observe() {} }
const touchState = { geometry: 0, history: 0 };
let touchSnapshot = null, rollbacks = 0;
const touchEditor = {
  stage: {}, _touchGesture: false,
  beginTouchEdit(pointerId) { touchSnapshot = { pointerId, ...touchState }; },
  discardTouchEdit(pointerId) { if (touchSnapshot?.pointerId === pointerId) touchSnapshot = null; },
  rollbackTouchEdit(pointerId) {
    if (touchSnapshot?.pointerId !== pointerId) return false;
    touchState.geometry = touchSnapshot.geometry; touchState.history = touchSnapshot.history;
    touchSnapshot = null; rollbacks++; return true;
  },
  onViewportChanged() {},
};
const viewport = new Function('document', 'window', 'localStorage', 'ResizeObserver', 'getComputedStyle',
  'setTimeout', 'clearTimeout', 'editor',
  noImports(source('src/ui/viewport.js')) + '\nreturn { measureFit, observeViewportFrame, bindViewportTouch, viewports };')(
  documentMock, viewportWindow, { getItem: () => null }, RO,
  () => ({ paddingLeft: '10', paddingRight: '10', paddingTop: '10', paddingBottom: '10' }),
  () => 1, () => {}, touchEditor,
);
const vp = viewport.viewports.output;
vp.el = frameEl; vp.scale = 3; vp.x = 27; vp.y = -45;
viewport.observeViewportFrame(vp);
for (const size of [[360, 800], [390, 844], [412, 915], [430, 932]]) {
  const before = { x: frame.left + frame.width / 2 + vp.x, y: frame.top + frame.height / 2 + vp.y };
  frame = { left: 0, top: 50, width: size[0], height: size[1] - 100 };
  frameEl.clientWidth = frame.width; frameEl.clientHeight = frame.height;
  observer.cb();
  assert.equal(vp.scale, 3);
  assert.equal(frame.left + frame.width / 2 + vp.x, before.x);
  assert.equal(frame.top + frame.height / 2 + vp.y, before.y);
}
viewportWindow.innerWidth = 900; viewportWindow.innerHeight = 430;
const oldScale = vp.scale, oldX = vp.x;
frame = { left: 0, top: 0, width: 900, height: 430 }; observer.cb();
assert.equal(vp.scale, oldScale); assert.equal(vp.x, oldX);

// The first touch may reach a mutating tool; the second promotes it to navigation and
// restores the exact pre-first-touch state while preserving pinch zoom/pan.
frame = { left: 0, top: 0, width: 390, height: 800 };
vp.scale = 1; vp.x = 0; vp.y = 0;
viewport.bindViewportTouch(vp);
const firstTarget = new EventTargetMock(); let navigationCancel = 0;
firstTarget.addEventListener('pointerup', (event) => { if (event._hvNavigationCancel) navigationCancel++; });
const pe = (type, pointerId, clientX, clientY, target = frameEl) =>
  frameEl.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', clientX, clientY, target }));
pe('pointerdown', 10, 120, 300, firstTarget);
touchState.geometry = 1; touchState.history = 1; // model Pen/shape mutation after capture phase
pe('pointerdown', 11, 240, 300);
assert.equal(navigationCancel, 1, 'first pointer listeners receive explicit navigation cancellation cleanup');
assert.deepEqual(touchState, { geometry: 0, history: 0 }, 'second touch rolls back provisional geometry and history');
pe('pointermove', 10, 60, 290, firstTarget); pe('pointermove', 11, 300, 310);
assert.ok(vp.scale > 1.8, 'pinch still changes viewport scale');
assert.notEqual(vp.y, 0, 'two-finger centroid movement still pans');
pe('pointerup', 10, 60, 290, firstTarget); pe('pointerup', 11, 300, 310);
assert.equal(touchEditor._touchGesture, false);
assert.equal(rollbacks, 1);

// Native pointercancel on an ordinary one-finger touch is cancellation, never commit.
pe('pointerdown', 12, 100, 200, firstTarget); touchState.geometry = 2; touchState.history = 1;
pe('pointercancel', 12, 100, 200, firstTarget);
assert.deepEqual(touchState, { geometry: 0, history: 0 });
assert.equal(rollbacks, 2);

// Pen construction owns Undo/Redo point-by-point without finishing the live path.
globalThis.window = new EventTargetMock();
let penStatus = '', nearestHit = null, nearestTolerance = 0;
const parsePath = (el) => ({ ...el.pa,
  anchors: el.pa.anchors.map((a) => ({ ...a, in: a.in && { ...a.in }, out: a.out && { ...a.out } })),
  subs: el.pa.subs.map((s) => ({ ...s })),
});
const serializePen = (anchors, closed) => anchors.map((a) => `${a.x},${a.y}`).join(' ') + (closed ? ' Z' : '');
const pen = new Function('setStatus', 'nearestOnPaths', 'pathToAnchors', 'penPathD',
  noImports(source('src/editor/tools/pen.js')) + '\nreturn penMixin;')(
  (message) => { penStatus = message; },
  (_stage, _x, _y, tolerance) => { nearestTolerance = tolerance; return nearestHit && { ...nearestHit }; },
  parsePath, serializePen,
);
const pedit = {
  ...pen,
  _pen: { pts: [], closed: false, dragging: false, pointUndo: [], pointRedo: [] },
  redraws: 0,
  _redrawPen() { this.redraws++; }, _renderPenMarks() {}, _setPenCloseCursor() {}, _updateButtons() {},
};
const point = (x) => ({ x, y: x, in: null, out: null });
pedit._recordPenPoint(); pedit._pen.pts.push(point(1));
pedit._recordPenPoint(); pedit._pen.pts.push(point(2));
pedit._recordPenPoint(); pedit._pen.pts.push(point(3));
const liveDraft = pedit._pen;
assert.equal(pedit._undoPenPoint(), true);
assert.equal(pedit._pen, liveDraft, 'undo must keep the Pen construction active');
assert.deepEqual(pedit._pen.pts.map((p) => p.x), [1, 2], 'undo removes exactly one point');
assert.equal(pedit._redoPenPoint(), true);
assert.deepEqual(pedit._pen.pts.map((p) => p.x), [1, 2, 3], 'redo restores exactly one point');
pedit._undoPenPoint(); pedit._recordPenPoint(); pedit._pen.pts.push(point(4));
assert.equal(pedit._pen.pointRedo.length, 0, 'a new point clears only the draft redo branch');

// Pen continuation resolves from the actual touch press; no pointermove/hover is required.
const penPath = (id, options = {}) => {
  const attrs = new Map([['data-hv-id', id], ['d', '0,0 10,0 20,0'], ['stroke', '#7755aa'], ['fill', 'none']]);
  return { attrs, parentNode: { children: [] },
    pa: { editable: options.editable !== false, closed: !!options.closed,
      subs: options.compound ? [{ start: 0, count: 2 }, { start: 2, count: 1 }] : [{ start: 0, count: 3 }],
      anchors: [0, 10, 20].map((x) => ({ x, y: 0, in: null, out: null })) },
    getAttribute(name) { return attrs.get(name) || null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
  };
};
const openPath = penPath('keep-id');
const sibling = { name: 'sibling' }; openPath.parentNode.children.push(openPath, sibling);
let coalesceBefore = null, finishHistory = [];
const penEditor = {
  ...pen, tool: 'pen', stage: {}, _pen: null, _penTempSelect: false,
  selection: new Set(), artboardSelected: false,
  stageCTM: () => ({ a: 2, b: 0, inverse: () => ({}) }),
  beginCoalesce() { coalesceBefore = openPath.getAttribute('d'); },
  commitCoalesce(label) { finishHistory.push({ label, d: coalesceBefore }); coalesceBefore = null; },
  _renderPenHint() {}, _setPenCursor() {}, _renderSelection() {}, _redrawPen() {}, _renderPenMarks() {},
  _overlayEl: () => null, _setPenCloseCursor() {}, _renderInspector() {}, _renderLayers() {}, _updateButtons() {},
};
const touchDown = (x) => ({ button: 0, pointerId: 31, pointerType: 'touch', clientX: x, clientY: 0,
  stopPropagation() {}, preventDefault() {} });

nearestHit = { mode: 'anchor', el: openPath, k: 2, count: 3, closed: false };
penEditor._penDown(touchDown(20));
assert.equal(penEditor._pen.node, openPath, 'continuation reuses the same SVG element');
assert.deepEqual(penEditor._pen.pts.map((p) => p.x), [0, 10, 20], 'ending endpoint keeps orientation and adds no duplicate');
assert.equal(openPath.getAttribute('data-hv-id'), 'keep-id');
assert.equal(openPath.getAttribute('stroke'), '#7755aa');
assert.deepEqual(openPath.parentNode.children, [openPath, sibling], 'layer order is unchanged');
assert.match(penStatus, /Continuing path/);
assert.equal(nearestTolerance, 6, '12 CSS-pixel touch target is converted through current zoom');

penEditor._pen.pts.push({ x: 30, y: 5, in: null, out: null });
penEditor._finishPen(true);
assert.equal(finishHistory.length, 1, 'finishing continuation commits one history action');
assert.equal(openPath.getAttribute('data-hv-id'), 'keep-id');
openPath.setAttribute('d', finishHistory[0].d); // the contract exercised by document Undo
assert.equal(openPath.getAttribute('d'), '0,0 10,0 20,0', 'undo snapshot restores pre-continuation geometry');

nearestHit = { mode: 'anchor', el: openPath, k: 0, count: 3, closed: false };
penEditor._penDown(touchDown(0));
assert.deepEqual(penEditor._pen.pts.map((p) => p.x), [20, 10, 0], 'starting endpoint reverses path orientation');
penEditor._pen = null;
nearestHit = { mode: 'anchor', el: openPath, k: 1, count: 3, closed: false };
assert.equal(penEditor._resolvePenHit(10, 0, 'touch'), null, 'touch never implicitly deletes an interior anchor');

for (const invalid of [penPath('closed', { closed: true }), penPath('compound', { compound: true }), penPath('locked', { editable: false })]) {
  const before = invalid.getAttribute('d'); penEditor._pen = null;
  penEditor._continuePen(invalid, 0);
  assert.equal(penEditor._pen, null, 'invalid path is not placed into continuation mode');
  assert.equal(invalid.getAttribute('d'), before, 'invalid path geometry stays untouched');
}

// Large recovery payloads are IndexedDB-backed and event-driven.  Keep the cloud/mobile
// picker wired to the existing raster-to-canvas path instead of the desktop upload API.
const recoverySource = source('src/ui/recovery.js');
const appSource = source('src/app.js');
const htmlSource = source('web/app.html');
assert.match(recoverySource, /indexedDB\.open\(/);
assert.doesNotMatch(recoverySource, /localStorage\s*\.\s*(?:get|set|remove|clear)|setTimeout\s*\(/);
assert.match(recoverySource, /new MutationObserver/);
assert.match(appSource, /isReloadNavigation\(\).*restoreRecoveryDraft/s);
assert.match(appSource, /for \(const file of valid\).*loadFileToCanvas/s);
assert.match(htmlSource, /id="reference-file-input"[^>]+image\/png[^>]+image\/jpeg/);

console.log('Mobile gesture rollback, Pen continuation/history, point actions, raster import, and recovery behavior: PASS');
