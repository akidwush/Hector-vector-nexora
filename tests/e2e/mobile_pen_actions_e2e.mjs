#!/usr/bin/env node
// Focused real-browser regressions for mobile gesture cancellation, Pen continuation,
// and explicit Node point actions. Run with the app server already listening:
//   NODE_PATH=/path/to/node_modules node tests/e2e/mobile_pen_actions_e2e.mjs http://localhost:2002
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:2002';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

let checks = 0;
const check = (value, message, detail = '') => {
  checks++;
  assert.ok(value, detail ? `${message}: ${detail}` : message);
  console.log(`  PASS ${message}`);
};

const context = await browser.newContext({
  viewport: { width: 390, height: 800 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

const mount = async (svg) => {
  await page.evaluate((source) => window.mountStageFromText(source, 'mobile-regression.svg'), svg);
  await page.waitForFunction(() => window.editor?.stage && !window.editor._pen && !window.editor._curv);
  await page.evaluate(() => {
    measureFit(viewports.output);
    viewports.output.scale = viewports.output.fitScale || 1;
    viewports.output.x = 0; viewports.output.y = 0;
    applyViewportState(viewports.output); editor.onViewportChanged();
  });
  await page.waitForTimeout(80);
};
const point = async (x, y) => page.evaluate(({ x, y }) => {
  const p = new DOMPoint(x, y).matrixTransform(editor.stageCTM());
  return { x: p.x, y: p.y };
}, { x, y });
const tapDoc = async (x, y) => {
  const p = await point(x, y);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(30);
};

// Synthetic multi-pointer input is required because Playwright's touchscreen API exposes
// only one contact. It still runs in Chromium against the real DOM/event pipeline.
const pinch = async (firstDocX, firstDocY, nearFirst = false, preMove = false) => page.evaluate(({ firstDocX, firstDocY, nearFirst, preMove }) => {
  const frame = viewports.output.el;
  const first = new DOMPoint(firstDocX, firstDocY).matrixTransform(editor.stageCTM());
  const rc = frame.getBoundingClientRect();
  const second = { x: Math.min(rc.right - 20, first.x + 70), y: Math.min(rc.bottom - 20, first.y + 10) };
  const fire = (target, type, id, x, y) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: 'touch',
    isPrimary: id === 101, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
  const history0 = editor.history.length, scale0 = viewports.output.scale;
  const firstTarget = document.elementFromPoint(first.x, first.y) || editor.stage;
  fire(firstTarget, 'pointerdown', 101, first.x, first.y);
  if (preMove) fire(firstTarget, 'pointermove', 101, first.x + 16, first.y + 11);
  fire(frame, 'pointerdown', 102, second.x, second.y);
  for (let i = 1; i <= 6; i++) {
    fire(frame, 'pointermove', 101, first.x - i * 12, first.y - i * 2);
    fire(frame, 'pointermove', 102, second.x + i * 15, second.y + i * 4);
  }
  const scale1 = viewports.output.scale;
  fire(frame, 'pointerup', 101, first.x - 72, first.y - 12);
  fire(frame, 'pointerup', 102, second.x + 90, second.y + 24);
  return { history0, history1: editor.history.length, scale0, scale1,
    gestureCleared: !editor._touchGesture, nearFirst };
}, { firstDocX, firstDocY, nearFirst, preMove });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.editor !== 'undefined' && typeof window.mountStageFromText === 'function');

  const blank = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"></svg>';

  console.log('\nPinch cancellation');
  await mount(blank);
  await page.evaluate(() => editor.setTool('pen'));
  const emptyPinch = await pinch(180, 180);
  const emptyState = await page.evaluate(() => ({ pen: !!editor._pen, curv: !!editor._curv,
    paths: editor.stage.querySelectorAll('path:not([data-hv-id])').length, history: editor.history.length }));
  check(emptyPinch.scale1 > emptyPinch.scale0, 'Pen pinch still zooms');
  check(emptyPinch.gestureCleared, 'gesture flag clears after release');
  check(!emptyState.pen && emptyState.paths === 0 && emptyState.history === 0,
    'Pen pinch with no draft leaves no path, anchor, or history', JSON.stringify(emptyState));

  await mount(blank);
  await page.evaluate(() => editor.setTool('pen'));
  await tapDoc(80, 90); await tapDoc(160, 80); await tapDoc(190, 160);
  const draftBefore = await page.evaluate(() => ({
    pts: editor._pen.pts.map((p) => [p.x, p.y]), d: editor._pen.node.getAttribute('d'),
    history: editor.history.length, node: editor._pen.node,
  }));
  const draftPinch = await pinch(260, 210);
  const draftAfter = await page.evaluate(() => ({
    active: !!editor._pen, pts: editor._pen?.pts.map((p) => [p.x, p.y]),
    d: editor._pen?.node.getAttribute('d'), closed: editor._pen?.closed, history: editor.history.length,
  }));
  check(draftPinch.scale1 > draftPinch.scale0, 'pinch while Pen draft is active still zooms');
  check(draftAfter.active && JSON.stringify(draftAfter.pts) === JSON.stringify(draftBefore.pts)
      && draftAfter.d === draftBefore.d && !draftAfter.closed && draftAfter.history === draftBefore.history,
    'active Pen draft keeps the same three coordinates, remains open, and adds no history', JSON.stringify(draftAfter));

  const closeGuard = await pinch(80, 90, true);
  const afterCloseGuard = await page.evaluate(() => ({ active: !!editor._pen, count: editor._pen?.pts.length,
    closed: editor._pen?.closed, history: editor.history.length }));
  check(closeGuard.scale1 > closeGuard.scale0 && afterCloseGuard.active && afterCloseGuard.count === 3
      && !afterCloseGuard.closed && afterCloseGuard.history === draftBefore.history,
    'first contact near the first anchor cannot close the draft during pinch', JSON.stringify(afterCloseGuard));

  await page.keyboard.press('Escape');
  await mount(blank);
  await page.evaluate(() => editor.setTool('curvature'));
  const curvPinch = await pinch(170, 170);
  const curvState = await page.evaluate(() => ({ active: !!editor._curv,
    anonymous: editor.stage.querySelectorAll('path:not([data-hv-id])').length, history: editor.history.length }));
  check(curvPinch.scale1 > curvPinch.scale0 && !curvState.active && curvState.anonymous === 0 && curvState.history === 0,
    'Curvature pinch leaves no point, empty path, or history', JSON.stringify(curvState));

  await mount(blank);
  await page.evaluate(() => editor.setTool('rect'));
  const shapePinch = await pinch(140, 140);
  const shapeState = await page.evaluate(() => ({ ids: editor.stage.querySelectorAll('[data-hv-id]').length,
    rects: editor.stage.querySelectorAll('rect:not(.hv-artboard)').length, history: editor.history.length }));
  check(shapePinch.scale1 > shapePinch.scale0 && shapeState.ids === 0 && shapeState.rects === 0 && shapeState.history === 0,
    'shape-tool pinch leaves no tiny shape or history', JSON.stringify(shapeState));

  const movable = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<rect data-hv-id="move" x="100" y="100" width="80" height="60" fill="#369"/></svg>';
  await mount(movable);
  await page.evaluate(() => editor.setTool('select'));
  const moveBefore = await page.evaluate(() => editor.nodeById('move').outerHTML);
  const movePinch = await pinch(130, 120, false, true);
  const moveAfter = await page.evaluate(() => ({ html: editor.nodeById('move').outerHTML, history: editor.history.length }));
  check(movePinch.scale1 > movePinch.scale0 && moveAfter.html === moveBefore && moveAfter.history === 0,
    'Select-tool pinch cannot move an object or create history', JSON.stringify(moveAfter));

  const nodePath = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<path data-hv-id="nodes" d="M 70 100 L 170 100 L 260 180" fill="none" stroke="#111" stroke-width="8"/></svg>';
  await mount(nodePath);
  await page.evaluate(() => { editor.selection = new Set(['nodes']); editor.setTool('node'); editor._renderSelection(); });
  const nodeBefore = await page.evaluate(() => editor.nodeById('nodes').getAttribute('d'));
  const nodePinch = await pinch(125, 100, false, true);
  const nodeAfter = await page.evaluate(() => ({ d: editor.nodeById('nodes').getAttribute('d'), history: editor.history.length }));
  check(nodePinch.scale1 > nodePinch.scale0 && nodeAfter.d === nodeBefore && nodeAfter.history === 0,
    'Node-tool pinch cannot reshape a segment or create history', JSON.stringify(nodeAfter));

  console.log('\nPen continuation without hover');
  const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<circle data-hv-id="before" cx="20" cy="20" r="5" fill="#111"/>'
    + '<path data-hv-id="open" d="M 70 100 L 170 100 L 220 170" fill="none" stroke="#7755aa" stroke-width="5"/>'
    + '<circle data-hv-id="after" cx="380" cy="380" r="5" fill="#222"/></svg>';

  for (const endpoint of [[220, 170, false], [70, 100, true]]) {
    await mount(open);
    await page.evaluate(() => editor.setTool('pen'));
    const before = await page.evaluate(() => ({ d: editor.nodeById('open').getAttribute('d'),
      stroke: editor.nodeById('open').getAttribute('stroke'), order: [...editor.stage.querySelectorAll('[data-hv-id]')].map((n) => n.getAttribute('data-hv-id')),
      history: editor.history.length }));
    await tapDoc(endpoint[0], endpoint[1]); // deliberately no pointermove first
    const continued = await page.evaluate(() => ({ active: !!editor._pen,
      same: editor._pen?.node === editor.nodeById('open'), count: editor._pen?.pts.length,
      xs: editor._pen?.pts.map((p) => p.x), id: editor._pen?.node.getAttribute('data-hv-id') }));
    check(continued.active && continued.same && continued.count === 3 && continued.id === 'open',
      `touch continues the ${endpoint[2] ? 'starting' : 'ending'} endpoint with no duplicate`, JSON.stringify(continued));
    check(!endpoint[2] ? continued.xs[0] === 70 : continued.xs[0] === 220,
      `endpoint orientation is ${endpoint[2] ? 'reversed' : 'preserved'}`, JSON.stringify(continued.xs));
    await tapDoc(280, 220);
    await page.keyboard.press('Enter');
    const finished = await page.evaluate(() => ({ active: !!editor._pen,
      id: editor.nodeById('open')?.getAttribute('data-hv-id'), stroke: editor.nodeById('open')?.getAttribute('stroke'),
      order: [...editor.stage.querySelectorAll('[data-hv-id]')].map((n) => n.getAttribute('data-hv-id')),
      history: editor.history.length, d: editor.nodeById('open')?.getAttribute('d') }));
    check(!finished.active && finished.id === 'open' && finished.stroke === before.stroke
        && JSON.stringify(finished.order) === JSON.stringify(before.order) && finished.history === before.history + 1,
      'finish preserves ID/style/layer order and creates one history action', JSON.stringify(finished));
    await page.evaluate(() => editor.undo());
    check(await page.evaluate((d) => editor.nodeById('open').getAttribute('d') === d, before.d),
      'one Undo restores pre-continuation geometry');
  }

  const invalidCases = [
    '<path data-hv-id="bad" d="M 60 80 L 180 80 Z" fill="none" stroke="#111"/>',
    '<path data-hv-id="bad" d="M 60 80 L 180 80 M 220 180 L 300 180" fill="none" stroke="#111"/>',
    '<path data-hv-id="bad" d="M 60 80 Q 120 20 180 80" fill="none" stroke="#111"/>',
  ];
  for (const pathMarkup of invalidCases) {
    await mount(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${pathMarkup}</svg>`);
    await page.evaluate(() => editor.setTool('pen'));
    const before = await page.evaluate(() => editor.nodeById('bad').getAttribute('d'));
    await tapDoc(60, 80);
    const invalid = await page.evaluate(() => ({ original: editor.nodeById('bad').getAttribute('d'),
      continuingOriginal: editor._pen?.node === editor.nodeById('bad') }));
    check(!invalid.continuingOriginal && invalid.original === before,
      'closed, compound, or non-editable path is never continued or rewritten', JSON.stringify(invalid));
    await page.keyboard.press('Escape');
  }

  console.log('\nExplicit mobile point actions');
  const corners = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<path data-hv-id="corners" d="M 60 80 L 150 60 L 240 120 L 300 210" fill="none" stroke="#222" stroke-width="4"/></svg>';
  await mount(corners);
  await page.evaluate(() => { editor.selection = new Set(['corners']); editor.setTool('node'); editor._renderSelection(); });
  await page.waitForSelector('.hv-node-anchor');
  const anchors = await page.locator('.hv-node-anchor').all();
  const anchorBox = await anchors[1].boundingBox();
  await page.touchscreen.tap(anchorBox.x + anchorBox.width / 2, anchorBox.y + anchorBox.height / 2);
  await page.waitForTimeout(100);
  const deleteUi = await page.evaluate(() => {
    const button = document.querySelector('#node-delete-point'), bar = button.closest('.stage-toolbar');
    const r = button.getBoundingClientRect();
    return { visible: button.offsetParent !== null && !button.hidden, disabled: button.disabled,
      label: button.getAttribute('aria-label'), w: r.width, h: r.height,
      barH: bar.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth,
      handleLinkHidden: document.querySelector('#node-handle-link').hidden };
  });
  check(deleteUi.visible && !deleteUi.disabled && deleteUi.label === 'Delete point'
      && deleteUi.w >= 44 && deleteUi.h >= 44 && deleteUi.handleLinkHidden,
    'corner point without Bezier handles exposes a 44x44 Delete point action', JSON.stringify(deleteUi));
  const beforeDelete = await page.evaluate(() => ({ count: hv.pathToAnchors(editor.nodeById('corners')).anchors.length,
    history: editor.history.length }));
  await page.locator('#node-delete-point').click();
  const afterDelete = await page.evaluate(() => ({ count: hv.pathToAnchors(editor.nodeById('corners')).anchors.length,
    history: editor.history.length, selected: editor._nodeSel.size }));
  check(afterDelete.count === beforeDelete.count - 1 && afterDelete.history === beforeDelete.history + 1 && afterDelete.selected === 0,
    'Delete point removes exactly one anchor, clears point selection, and creates one Undo step', JSON.stringify(afterDelete));
  await page.evaluate(() => editor.undo());
  check(await page.evaluate((count) => hv.pathToAnchors(editor.nodeById('corners')).anchors.length === count, beforeDelete.count),
    'Undo restores the deleted point');

  const compound = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<path data-hv-id="compound" d="M 40 50 L 100 50 L 150 80 M 220 200 L 280 200 L 330 240" fill="none" stroke="#222"/></svg>';
  await mount(compound);
  const compoundBefore = await page.evaluate(() => {
    editor.selection = new Set(['compound']); editor.setTool('node'); editor._nodeSel = new Set(['compound#1']); editor.mountNodeHandles();
    const pa = hv.pathToAnchors(editor.nodeById('compound'));
    return { count: pa.anchors.length, subs: pa.subs.length, d: editor.nodeById('compound').getAttribute('d') };
  });
  await page.locator('#node-delete-point').click();
  const compoundAfter = await page.evaluate(() => {
    const pa = hv.pathToAnchors(editor.nodeById('compound'));
    return { count: pa.anchors.length, subs: pa.subs.length };
  });
  check(compoundAfter.count === compoundBefore.count - 1 && compoundAfter.subs === 2,
    'deleting a point keeps the other compound subpath intact', JSON.stringify(compoundAfter));
  await page.evaluate(() => editor.undo());
  check(await page.evaluate((d) => editor.nodeById('compound').getAttribute('d') === d, compoundBefore.d),
    'Undo restores compound-path geometry');

  const pair = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<path data-hv-id="p1" d="M 40 80 L 110 80 L 170 120" fill="none" stroke="#111"/>'
    + '<path data-hv-id="p2" d="M 220 150 L 280 210 L 340 210" fill="none" stroke="#333"/></svg>';
  await mount(pair);
  const joinEndpoint = await page.evaluate(() => {
    editor.selection = new Set(['p1', 'p2']); editor.setTool('node');
    editor._nodeSel = new Set(['p1#2', 'p2#0']); editor.mountNodeHandles();
    const b = document.querySelector('#node-join-points'), d = document.querySelector('#node-delete-point');
    return { joinDisabled: b.disabled, joinLabel: b.getAttribute('aria-label'), deleteLabel: d.getAttribute('aria-label') };
  });
  check(!joinEndpoint.joinDisabled && joinEndpoint.joinLabel === 'Join paths' && joinEndpoint.deleteLabel === 'Delete 2 points',
    'two valid endpoints enable Join and multi-select labels Delete 2 points', JSON.stringify(joinEndpoint));
  await page.evaluate(() => { editor._nodeSel = new Set(['p1#1', 'p2#1']); editor.mountNodeHandles(); });
  check(await page.locator('#node-join-points').isDisabled(), 'two interior points keep Join disabled');
  await page.evaluate(() => { editor._nodeSel = new Set(['p1#2', 'p2#0']); editor.mountNodeHandles(); });
  const joinHistory0 = await page.evaluate(() => editor.history.length);
  await page.locator('#node-join-points').click();
  const joined = await page.evaluate(() => ({ p1: !!editor.nodeById('p1'), p2: !!editor.nodeById('p2'),
    history: editor.history.length, count: hv.pathToAnchors(editor.nodeById('p1')).anchors.length }));
  check(joined.p1 && !joined.p2 && joined.count === 6 && joined.history === joinHistory0 + 1,
    'Join reuses the existing join engine and creates one history action', JSON.stringify(joined));
  await page.evaluate(() => editor.undo());
  check(await page.evaluate(() => !!editor.nodeById('p1') && !!editor.nodeById('p2')), 'Undo restores both joined paths');

  await mount('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
    + '<path data-hv-id="close" d="M 80 90 L 180 70 L 250 170" fill="none" stroke="#111"/></svg>');
  const closeReady = await page.evaluate(() => {
    editor.selection = new Set(['close']); editor.setTool('node'); editor._nodeSel = new Set(['close#0', 'close#2']); editor.mountNodeHandles();
    const b = document.querySelector('#node-join-points'); return { disabled: b.disabled, label: b.getAttribute('aria-label') };
  });
  check(!closeReady.disabled && closeReady.label === 'Close path', 'two endpoints on one open path enable Close path');
  await page.locator('#node-join-points').click();
  check(await page.evaluate(() => hv.pathToAnchors(editor.nodeById('close')).closed), 'Close path uses the existing join engine');
  await page.evaluate(() => editor.undo());
  check(await page.evaluate(() => !hv.pathToAnchors(editor.nodeById('close')).closed), 'Undo reopens the closed path');

  console.log('\nResponsive mobile widths');
  for (const width of [360, 390, 412, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      editor.selection = new Set(['p1']); editor.setTool('node'); editor._nodeSel = new Set(['p1#0']); editor.mountNodeHandles();
    });
    const responsive = await page.evaluate(() => {
      const b = document.querySelector('#node-delete-point').getBoundingClientRect();
      const row = document.querySelector('#node-delete-point').closest('.stage-toolbar').getBoundingClientRect();
      const canvas = document.querySelector('.stage-body').getBoundingClientRect();
      return { w: b.width, h: b.height, overflow: document.documentElement.scrollWidth - innerWidth,
        rowH: row.height, canvasH: canvas.height };
    });
    check(responsive.w >= 44 && responsive.h >= 44 && responsive.overflow <= 1
        && responsive.rowH < 90 && responsive.canvasH > 120,
      `${width}px keeps 44px actions, no page overflow, and a usable canvas`, JSON.stringify(responsive));
  }

  await mount(blank);
  await page.evaluate(() => editor.setTool('pen'));
  const curveStart = await point(100, 130), curveEnd = await point(150, 180);
  await page.evaluate(({ curveStart, curveEnd }) => {
    const fire = (type, x, y) => editor.stage.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 303, pointerType: 'touch', isPrimary: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
    }));
    fire('pointerdown', curveStart.x, curveStart.y);
    fire('pointermove', curveEnd.x, curveEnd.y);
    fire('pointerup', curveEnd.x, curveEnd.y);
  }, { curveStart, curveEnd });
  check(await page.evaluate(() => !!editor._pen?.pts[0]?.out), 'single-finger Pen drag still creates a curve handle');

  check(pageErrors.length === 0, 'browser reported no uncaught errors', pageErrors.join('\n'));
  console.log(`\nMobile Pen/gesture/point browser E2E: ${checks} checks PASS`);
} finally {
  await context.close();
  await browser.close();
}
