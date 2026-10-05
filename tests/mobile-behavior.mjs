// Dependency-free regression checks for the viewport and Node Tool drag contracts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const noImports = (s) => s.replace(/^import\s+(?:[\s\S]*?\s+from\s+)?["'][^"']+["'];\s*/gm, '').replace(/^export\s+/gm, '');

const button = {
  hidden: true, dataset: {}, attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; },
  replaceChildren() {}, querySelector() { return null },
};
const app = { classList: { toggle() {} } };
const node = new Function('document', 'setUiIcon', 'setStatus', 'nfmt', 'snap45',
  noImports(source('src/editor/tools/node.js')) + '\nreturn nodeMixin;')(
  { querySelector: (q) => q === '#node-handle-link' ? button : app },
  (el, icon) => { el.icon = icon; }, () => {}, String, (_x, _y, x, y) => ({ x, y }),
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
  _renderInspector() {}, _handleDragging: false,
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
  dot.handlers.pointermove({ clientX: x, clientY: y, altKey, shiftKey: false });
  dot.handlers.pointerup();
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

let frame = { left: 0, top: 0, width: 390, height: 844 };
const content = { style: {} };
const media = { tagName: 'svg', getAttribute: (key) => key === 'width' ? '100' : '100' };
const frameEl = { clientWidth: 390, clientHeight: 844, getBoundingClientRect: () => frame,
  querySelector: (q) => q === '.viewport-content' ? content : media };
const documentMock = { querySelector: () => null };
const viewportWindow = { innerWidth: 390, innerHeight: 844 };
let observer;
class RO { constructor(cb) { this.cb = cb; observer = this; } observe() {} }
const viewport = new Function('document', 'window', 'localStorage', 'ResizeObserver', 'getComputedStyle',
  'setTimeout', 'clearTimeout', 'editor',
  noImports(source('src/ui/viewport.js')) + '\nreturn { measureFit, observeViewportFrame, viewports };')(
  documentMock, viewportWindow, { getItem: () => null }, RO,
  () => ({ paddingLeft: '10', paddingRight: '10', paddingTop: '10', paddingBottom: '10' }),
  () => 1, () => {}, { onViewportChanged() {} },
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

// Pen construction owns Undo/Redo point-by-point without finishing the live path.
const pen = new Function('setStatus', noImports(source('src/editor/tools/pen.js')) + '\nreturn penMixin;')(() => {});
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

console.log('Mobile viewport, Pen history, raster import, and recovery behavior: PASS');
