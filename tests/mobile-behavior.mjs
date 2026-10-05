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
console.log('Mobile viewport and handle behavior: PASS');
