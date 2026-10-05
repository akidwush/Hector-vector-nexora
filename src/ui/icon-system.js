// Hector Vector UI icon system.
//
// The editor used assorted Unicode glyphs (✥, ◳, ⤢, ⧉⁺, …) as toolbar icons.
// Those glyphs render differently across Android/iOS/Windows fonts and make the UI
// look synthetic/inconsistent. This module replaces the stable toolbar glyphs with
// one 24×24, 2px-stroke outline language. The geometry follows the same principles
// used by established editor icon systems (notably Lucide): simple outlines,
// round caps/joins, no emoji/font dependency, currentColor for theme compatibility.
//
// It intentionally has no package/runtime dependency and no build step: Hector
// Vector's frontend is dependency-free ES modules, so these tiny paths stay local.

const NS = "http://www.w3.org/2000/svg";

const ICONS = {
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
  unlink: '<path d="M9 15 7 17a4 4 0 0 1-5.7-5.7l2-2M15 9l2-2a4 4 0 0 1 5.7 5.7l-2 2M4 4l16 16"/>',
  pointer: '<path d="M5 3.5 18.5 12l-6.1 1.6L9.6 20 5 3.5Z"/><path d="m12.4 13.6 4 4"/>',
  nodes: '<path d="M4 17c3-8 7-10 16-10"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="7" r="2"/><circle cx="12" cy="10" r="2"/><path d="M6 17h4M14 10h4"/>',
  pen: '<path d="m12 3 5 5-7.5 11.5-5 1 1-5L17 4"/><path d="m9 15 3 3M4.5 20.5 8 17"/>',
  curve: '<path d="M3 17c3-10 8-10 10-5s5 4 8-5"/><circle cx="3" cy="17" r="1.5"/><circle cx="21" cy="7" r="1.5"/>',
  rectangle: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  circle: '<circle cx="12" cy="12" r="7.5"/>',
  line: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>',
  type: '<path d="M5 5h14M12 5v14M8.5 19h7"/>',
  artboard: '<path d="M7 3H4a1 1 0 0 0-1 1v3M17 3h3a1 1 0 0 1 1 1v3M7 21H4a1 1 0 0 1-1-1v-3M17 21h3a1 1 0 0 0 1-1v-3"/><rect x="7" y="7" width="10" height="10"/>',
  width: '<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4"/><path d="M10 7c1 2 3 8 4 10"/>',
  envelope: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 5v14M16 5v14M4 10h16M4 14h16"/><path d="m8 10 4-2 4 2M8 14l4 2 4-2"/>',
  mesh: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="2"/>',
  shapeBuilder: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 9v6M9 12h6"/>',
  scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="m8.3 8.2 10.2 6.3M8.3 15.8 18.5 9.5"/>',
  knife: '<path d="M5 18 17.5 5.5 20 8 8 20H5v-2Z"/><path d="m14 9 2 2"/>',
  eraser: '<path d="m8 18-4-4 9-9a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-7 7H8Z"/><path d="m10 8 6 6M11 18h9"/>',
  union: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 7.2c2 1 3 2.6 3 4.8s-1 3.8-3 4.8c-2-1-3-2.6-3-4.8s1-3.8 3-4.8Z" fill="currentColor" stroke="none" opacity=".22"/>',
  subtract: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M14 12h5"/>',
  intersect: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 7.2c2 1 3 2.6 3 4.8s-1 3.8-3 4.8"/>',
  blend: '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5" opacity=".6"/><path d="M10 8.2c2 1 3 2.2 3 3.8s-1 2.8-3 3.8"/>',
  cut: '<path d="M5 5 19 19M19 5 5 19"/><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  paste: '<path d="M9 5h6M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7H9V4.5Z"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 12h6M9 16h4"/>',
  front: '<rect x="8" y="5" width="10" height="10"/><rect x="5" y="8" width="10" height="10"/><path d="M19 5v-2M19 3l-2 2M19 3l2 2"/>',
  forward: '<rect x="8" y="5" width="10" height="10"/><rect x="5" y="8" width="10" height="10"/><path d="M20 12V6M17.5 8.5 20 6l2.5 2.5"/>',
  backward: '<rect x="8" y="5" width="10" height="10"/><rect x="5" y="8" width="10" height="10"/><path d="M4 12v6M1.5 15.5 4 18l2.5-2.5"/>',
  back: '<rect x="8" y="5" width="10" height="10"/><rect x="5" y="8" width="10" height="10"/><path d="M4 19v2M4 21l-2-2M4 21l2-2"/>',
  group: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/><path d="M3 12h18" opacity=".55"/>',
  ungroup: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/><path d="m9 12 6 0" stroke-dasharray="2 2"/>',
  clip: '<path d="M7 3v14a4 4 0 0 0 4 4h10M3 7h14a4 4 0 0 1 4 4v10"/>',
  duplicate: '<rect x="8" y="8" width="10" height="10" rx="1"/><rect x="5" y="5" width="10" height="10" rx="1"/><path d="M18 4v5M15.5 6.5H20.5"/>',
  pencil: '<path d="m4 20 4.2-1 10.5-10.5a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.8 6.8 2.4 2.4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7.5 10.5h6"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7.5 10.5h6M10.5 7.5v6"/>',
  fit: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
  selectAll: '<path d="M7 3H4a1 1 0 0 0-1 1v3M17 3h3a1 1 0 0 1 1 1v3M7 21H4a1 1 0 0 1-1-1v-3M17 21h3a1 1 0 0 0 1-1v-3"/><rect x="7" y="7" width="10" height="10"/>',
  ruler: '<path d="m5 20 15-15-3-3L2 17l3 3Z"/><path d="m13 6 2 2M10 9l2 2M7 12l2 2"/>',
  guides: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="4"/><path d="M12 7V5M12 19v-2M7 12H5M19 12h-2"/>',
  scale: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="m4 4 6 6M20 20l-6-6"/>',
  rotate: '<path d="M20 7V3l-3 3a8 8 0 1 0 2.3 8"/><path d="M17 3h3v4"/>',
  rotateCcw: '<path d="M4 7V3l3 3a8 8 0 1 1-2.3 8"/><path d="M7 3H4v4"/>',
  flipH: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M10 5 4 9v6l6 4V5ZM14 5l6 4v6l-6 4V5Z"/>',
  flipV: '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="m5 10 4-6h6l4 6H5ZM5 14l4 6h6l4-6H5Z"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a7 7 0 0 1 7 7"/>',
  redo: '<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a7 7 0 0 0-7 7"/>',
  cleanup: '<path d="m4 20 6-6M10 14l4-9 6 6-9 4"/><path d="M14 4l6 6M4 20h7"/>',
  merge: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 8v8M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  circleX: '<circle cx="12" cy="12" r="8"/><path d="m9 9 6 6M15 9l-6 6"/>',
  clear: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.5 2.5 0 0 1 4.8 1c0 2-2.6 2.2-2.6 4M12 18h.01"/>',
  panels: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M8 10h13"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
};

function makeSvg(name) {
  const body = ICONS[name];
  if (!body) return null;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("hv-ui-icon");
  svg.innerHTML = body;
  for (const node of svg.querySelectorAll("path,rect,circle,line,polyline,polygon")) {
    if (!node.hasAttribute("fill")) node.setAttribute("fill", "none");
    if (!node.hasAttribute("stroke")) node.setAttribute("stroke", "currentColor");
    if (!node.hasAttribute("stroke-width")) node.setAttribute("stroke-width", "1.8");
    if (!node.hasAttribute("stroke-linecap")) node.setAttribute("stroke-linecap", "round");
    if (!node.hasAttribute("stroke-linejoin")) node.setAttribute("stroke-linejoin", "round");
  }
  return svg;
}

const STATIC = [
  ['.toolstrip [data-tool="select"]', 'pointer'],
  ['.toolstrip [data-tool="node"]', 'nodes'],
  ['.toolstrip [data-tool="pen"]', 'pen'],
  ['.toolstrip [data-tool="curvature"]', 'curve'],
  ['.toolstrip [data-tool="rect"]', 'rectangle'],
  ['.toolstrip [data-tool="ellipse"]', 'circle'],
  ['.toolstrip [data-tool="line"]', 'line'],
  ['.toolstrip [data-tool="text"]', 'type'],
  ['.toolstrip [data-tool="artboard"]', 'artboard'],
  ['.actionbar [data-tool="width"]', 'width'],
  ['.actionbar [data-tool="envelope"]', 'envelope'],
  ['.actionbar [data-tool="mesh"]', 'mesh'],
  ['.actionbar [data-tool="shapebuilder"]', 'shapeBuilder'],
  ['.actionbar [data-tool="scissors"]', 'scissors'],
  ['.actionbar [data-tool="knife"]', 'knife'],
  ['.actionbar [data-tool="eraser"]', 'eraser'],
  ['.actionbar [data-tool="blend"]', 'blend'],
  ['#act-union', 'union'], ['#act-subtract', 'subtract'], ['#act-intersect', 'intersect'],
  ['#act-cut', 'cut'], ['#act-copy', 'copy'], ['#act-paste', 'paste'],
  ['#layer-front', 'front'], ['#layer-forward', 'forward'], ['#layer-backward', 'backward'], ['#layer-back', 'back'],
  ['#layer-group', 'group'], ['#layer-ungroup', 'ungroup'], ['#act-clip', 'clip'], ['#act-duplicate', 'duplicate'],
  ['#layer-rename', 'pencil'], ['#layer-delete', 'trash'],
  ['[data-action="zoom-out"]', 'zoomOut'], ['[data-action="fit"]', 'fit'], ['[data-action="zoom-in"]', 'zoomIn'],
  ['#vp-selectall', 'selectAll'], ['#vp-rulers', 'ruler'], ['#vp-guides', 'guides'],
  ['#act-scale', 'scale'], ['#act-rotate', 'rotate'], ['#act-rotate-cw', 'rotate'], ['#act-rotate-ccw', 'rotateCcw'],
  ['#act-flip-h', 'flipH'], ['#act-flip-v', 'flipV'],
  ['#undo-button', 'undo'], ['#redo-button', 'redo'],
  ['#layer-cleanup', 'cleanup'], ['#layer-merge', 'merge'],
  ['#symbols-add', 'plus'], ['#library-add', 'plus'], ['#processor-run', 'play'],
  ['#jobs-cancel-all', 'circleX'], ['#jobs-clear', 'clear'],
  ['#palette-button', 'search'], ['#shortcut-button', 'help'], ['#rail-toggle', 'panels'],
  ['#swatch-swap', 'swap'], ['#mobile-panels', 'panels'],
];

function labelFrom(el) {
  if (el.getAttribute("aria-label")) return;
  const title = (el.getAttribute("title") || "").trim();
  if (!title) return;
  const label = title.split(" — ")[0].split(" (")[0].trim();
  if (label) el.setAttribute("aria-label", label);
}

function decorate(el, name) {
  if (!el || !ICONS[name]) return;
  if (el.dataset.hvIcon === name && el.querySelector(":scope > .hv-ui-icon")) return;
  labelFrom(el);
  el.dataset.hvIcon = name;
  el.replaceChildren(makeSvg(name));
}

export function setUiIcon(el, name) { decorate(el, name); }

function decorateDynamic(root = document) {
  root.querySelectorAll?.('button.menu-rowbtn[title="Rename"], button.insp-iconbtn[title="Remove effect"]').forEach((b) => decorate(b, b.title === "Rename" ? "pencil" : "trash"));
  root.querySelectorAll?.('button.menu-rowbtn[title="Delete"], button.danger-button').forEach((b) => decorate(b, "trash"));
  root.querySelectorAll?.('button.fp-close.panel-x').forEach((b) => decorate(b, "panels"));
}

export function installIconSystem() {
  for (const [sel, name] of STATIC) document.querySelectorAll(sel).forEach((el) => decorate(el, name));
  decorateDynamic(document);
  document.documentElement.classList.add("hv-icon-system");
  const observer = new MutationObserver((records) => {
    for (const rec of records) for (const node of rec.addedNodes) if (node.nodeType === 1) decorateDynamic(node);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
