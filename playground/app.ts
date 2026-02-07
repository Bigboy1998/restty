import {
  createResttyApp,
  createResttyAppSession,
  listBuiltinThemeNames,
  getBuiltinTheme,
  parseGhosttyTheme,
  type GhosttyTheme,
} from "../src/index.ts";
import { createDemoController } from "./lib/demos.ts";
import { parseCodepointInput } from "./lib/codepoint.ts";

const paneRoot = document.getElementById("paneRoot") as HTMLElement | null;
if (!paneRoot) {
  throw new Error("missing #paneRoot element");
}

const backendEl = document.getElementById("backend");
const fpsEl = document.getElementById("fps");
const dprEl = document.getElementById("dpr");
const sizeEl = document.getElementById("size");
const gridEl = document.getElementById("grid");
const cellEl = document.getElementById("cell");
const termSizeEl = document.getElementById("termSize");
const cursorPosEl = document.getElementById("cursorPos");
const inputDebugEl = document.getElementById("inputDebug");
const dbgEl = document.getElementById("dbg");
const ptyStatusEl = document.getElementById("ptyStatus");
const mouseStatusEl = document.getElementById("mouseStatus");
const logEl = document.getElementById("log");
const logDumpEl = document.getElementById("logDump") as HTMLTextAreaElement | null;
const atlasInfoEl = document.getElementById("atlasInfo");
const atlasCanvas = document.getElementById("atlasCanvas") as HTMLCanvasElement | null;

const btnInit = document.getElementById("btnInit");
const btnPause = document.getElementById("btnPause");
const btnClear = document.getElementById("btnClear");
const rendererSelect = document.getElementById("rendererSelect") as HTMLSelectElement | null;
const demoSelect = document.getElementById("demoSelect") as HTMLSelectElement | null;
const btnRunDemo = document.getElementById("btnRunDemo");
const ptyUrlInput = document.getElementById("ptyUrl") as HTMLInputElement | null;
const ptyBtn = document.getElementById("btnPty");
const themeSelect = document.getElementById("themeSelect") as HTMLSelectElement | null;
const themeFileInput = document.getElementById("themeFile") as HTMLInputElement | null;
const fontSizeInput = document.getElementById("fontSize") as HTMLInputElement | null;
const atlasCpInput = document.getElementById("atlasCp") as HTMLInputElement | null;
const atlasBtn = document.getElementById("btnAtlas");
const btnCopyLog = document.getElementById("btnCopyLog");
const btnClearLog = document.getElementById("btnClearLog");
const mouseModeEl = document.getElementById("mouseMode") as HTMLSelectElement | null;
const settingsFab = document.getElementById("settingsFab") as HTMLButtonElement | null;
const settingsDialog = document.getElementById("settingsDialog") as HTMLDialogElement | null;
const settingsClose = document.getElementById("settingsClose") as HTMLButtonElement | null;

const DEFAULT_THEME_NAME = "Aizen Dark";
const LOG_LIMIT = 200;
const logBuffer: string[] = [];

function appendLog(line: string) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const entry = `${timestamp} ${line}`;
  logBuffer.push(entry);
  if (logBuffer.length > LOG_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_LIMIT);
  }
  if (logEl) logEl.textContent = line;
  if (logDumpEl) {
    logDumpEl.value = logBuffer.join("\n");
    logDumpEl.scrollTop = logDumpEl.scrollHeight;
  }
}

function isSettingsDialogOpen() {
  return Boolean(settingsDialog?.open);
}

function restoreTerminalFocus() {
  const pane = getFocusedPane() ?? getActivePane() ?? getFirstPane();
  if (!pane) return;
  pane.canvas.focus({ preventScroll: true });
}

function openSettingsDialog() {
  hidePaneContextMenu();
  if (!settingsDialog || settingsDialog.open) return;
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
    return;
  }
  settingsDialog.setAttribute("open", "");
}

function closeSettingsDialog() {
  if (!settingsDialog || !settingsDialog.open) return;
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
  restoreTerminalFocus();
}

type RendererChoice = "auto" | "webgpu" | "webgl2";
type SplitDirection = "vertical" | "horizontal";
type ContextMenuItem = {
  label: string;
  shortcut?: string;
  enabled?: boolean;
  danger?: boolean;
  action: () => void | Promise<void>;
};

type PaneUiState = {
  backend: string;
  fps: string;
  dpr: string;
  size: string;
  grid: string;
  cell: string;
  termSize: string;
  cursor: string;
  inputDebug: string;
  debug: string;
  ptyStatus: string;
  mouseStatus: string;
};

type PaneThemeState = {
  selectValue: string;
  sourceLabel: string;
  theme: GhosttyTheme | null;
};

type Pane = {
  id: number;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  imeInput: HTMLTextAreaElement;
  termDebugEl: HTMLPreElement;
  app: ReturnType<typeof createResttyApp>;
  demos: ReturnType<typeof createDemoController>;
  paused: boolean;
  renderer: RendererChoice;
  fontSize: number;
  mouseMode: string;
  theme: PaneThemeState;
  ui: PaneUiState;
};

type SplitResizeState = {
  pointerId: number;
  axis: "x" | "y";
  divider: HTMLDivElement;
  first: HTMLElement;
  second: HTMLElement;
  startCoord: number;
  startFirst: number;
  total: number;
};

const sharedSession = createResttyAppSession();
const panes = new Map<number, Pane>();
let nextPaneId = 1;
let activePaneId: number | null = null;
let focusedPaneId: number | null = null;
let resizeRaf = 0;
let splitResizeState: SplitResizeState | null = null;

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDefaultPaneUi(): PaneUiState {
  return {
    backend: "-",
    fps: "0",
    dpr: "1",
    size: "0x0",
    grid: "0x0",
    cell: "0x0",
    termSize: "0x0",
    cursor: "0,0",
    inputDebug: "-",
    debug: "-",
    ptyStatus: "disconnected",
    mouseStatus: "-",
  };
}

function setText(el: HTMLElement | null, value: string) {
  if (el) el.textContent = value;
}

function getActivePane(): Pane | null {
  if (activePaneId === null) return null;
  return panes.get(activePaneId) ?? null;
}

function getFirstPane(): Pane | null {
  for (const pane of panes.values()) return pane;
  return null;
}

function findPaneByElement(element: Element | null): Pane | null {
  if (!(element instanceof HTMLElement)) return null;
  const host = element.closest(".pane");
  if (!host) return null;
  const id = Number(host.dataset.paneId ?? "");
  if (!Number.isFinite(id)) return null;
  return panes.get(id) ?? null;
}

function getSplitBranches(split: HTMLElement): HTMLElement[] {
  const branches: HTMLElement[] = [];
  for (const child of Array.from(split.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains("pane-divider")) continue;
    branches.push(child);
  }
  return branches;
}

function getFocusedPane(): Pane | null {
  if (focusedPaneId !== null) {
    const pane = panes.get(focusedPaneId);
    if (pane) return pane;
  }
  if (typeof document === "undefined") return null;
  return findPaneByElement(document.activeElement);
}

function getSplitTargetPane(): Pane | null {
  return getFocusedPane() ?? getActivePane();
}

function syncPauseButton(pane: Pane) {
  if (btnPause) btnPause.textContent = pane.paused ? "Resume" : "Pause";
}

function syncPtyButton(pane: Pane) {
  if (!ptyBtn) return;
  ptyBtn.textContent = pane.app.isPtyConnected() ? "Disconnect PTY" : "Connect PTY";
}

function renderActivePaneStatus(pane: Pane) {
  setText(backendEl, pane.ui.backend);
  setText(fpsEl, pane.ui.fps);
  setText(dprEl, pane.ui.dpr);
  setText(sizeEl, pane.ui.size);
  setText(gridEl, pane.ui.grid);
  setText(cellEl, pane.ui.cell);
  setText(termSizeEl, pane.ui.termSize);
  setText(cursorPosEl, pane.ui.cursor);
  setText(inputDebugEl, pane.ui.inputDebug);
  setText(dbgEl, pane.ui.debug);
  setText(ptyStatusEl, pane.ui.ptyStatus);
  setText(mouseStatusEl, pane.ui.mouseStatus);
  syncPtyButton(pane);
}

function renderActivePaneControls(pane: Pane) {
  syncPauseButton(pane);
  if (rendererSelect) rendererSelect.value = pane.renderer;
  if (fontSizeInput) fontSizeInput.value = `${pane.fontSize}`;
  pane.mouseMode = pane.app.getMouseStatus().mode;
  if (mouseModeEl) {
    const hasOption = Array.from(mouseModeEl.options).some((option) => option.value === pane.mouseMode);
    mouseModeEl.value = hasOption ? pane.mouseMode : "auto";
  }
  if (themeSelect) themeSelect.value = pane.theme.selectValue;
}

function setActivePane(id: number, focusCanvas = false) {
  const pane = panes.get(id);
  if (!pane) return;
  activePaneId = id;
  for (const current of panes.values()) {
    current.container.classList.toggle("is-active", current.id === id);
  }
  renderActivePaneStatus(pane);
  renderActivePaneControls(pane);
  if (focusCanvas) {
    pane.canvas.focus({ preventScroll: true });
  }
}

function markPaneFocused(id: number, focusCanvas = false) {
  focusedPaneId = id;
  setActivePane(id, focusCanvas);
}

function mutatePane(id: number, update: (pane: Pane) => void) {
  const pane = panes.get(id);
  if (!pane) return;
  update(pane);
  if (pane.id === activePaneId) {
    renderActivePaneStatus(pane);
  }
}

function setPanePaused(pane: Pane, value: boolean) {
  pane.paused = Boolean(value);
  pane.app.setPaused(pane.paused);
  if (pane.id === activePaneId) syncPauseButton(pane);
}

function queueResizeAllPanes() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    for (const pane of panes.values()) {
      pane.app.updateSize(true);
    }
  });
}

function applyThemeToPane(
  pane: Pane,
  theme: GhosttyTheme,
  sourceLabel: string,
  selectValue = "",
): boolean {
  try {
    pane.app.applyTheme(theme, sourceLabel);
    pane.theme = {
      selectValue,
      sourceLabel,
      theme,
    };
    if (pane.id === activePaneId && themeSelect) {
      themeSelect.value = selectValue;
    }
    return true;
  } catch (err: any) {
    appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
    return false;
  }
}

function applyBuiltinThemeToPane(pane: Pane, name: string, sourceLabel = name): boolean {
  const theme = getBuiltinTheme(name);
  if (!theme) {
    appendLog(`[ui] theme load failed: unknown theme: ${name}`);
    return false;
  }
  return applyThemeToPane(pane, theme, sourceLabel, name);
}

function resetThemeForPane(pane: Pane) {
  pane.app.resetTheme();
  pane.theme = {
    selectValue: "",
    sourceLabel: "",
    theme: null,
  };
  if (pane.id === activePaneId && themeSelect) {
    themeSelect.value = "";
  }
}

function populateThemeSelect(names: string[]) {
  if (!themeSelect) return;
  const existing = new Set<string>();
  for (const opt of themeSelect.options) {
    if (opt.value) existing.add(opt.value);
  }
  for (const name of names) {
    if (existing.has(name)) continue;
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    themeSelect.appendChild(option);
  }
}

const builtinThemeNames = listBuiltinThemeNames();
populateThemeSelect(builtinThemeNames);
appendLog(`[ui] themes loaded (${builtinThemeNames.length})`);
const defaultThemeName = builtinThemeNames.includes(DEFAULT_THEME_NAME) ? DEFAULT_THEME_NAME : "";

function createPane(cloneFrom?: Pane): Pane {
  const id = nextPaneId;
  nextPaneId += 1;

  const container = document.createElement("div");
  container.className = "pane";
  container.dataset.paneId = `${id}`;

  const canvas = document.createElement("canvas");
  canvas.className = "pane-canvas";
  canvas.tabIndex = 0;

  const imeInput = document.createElement("textarea");
  imeInput.className = "pane-ime-input";
  imeInput.autocapitalize = "off";
  imeInput.autocomplete = "off";
  imeInput.autocorrect = "off";
  imeInput.spellcheck = false;
  imeInput.setAttribute("aria-hidden", "true");

  const termDebugEl = document.createElement("pre");
  termDebugEl.className = "pane-term-debug";
  termDebugEl.setAttribute("aria-live", "polite");

  container.append(canvas, imeInput, termDebugEl);

  const pane: Pane = {
    id,
    container,
    canvas,
    imeInput,
    termDebugEl,
    app: null as unknown as ReturnType<typeof createResttyApp>,
    demos: null as unknown as ReturnType<typeof createDemoController>,
    paused: false,
    renderer: cloneFrom?.renderer ?? (isRendererChoice(rendererSelect?.value) ? rendererSelect.value : "auto"),
    fontSize: cloneFrom?.fontSize ?? parseFontSize(fontSizeInput?.value, Number.isFinite(initialFontSize) ? initialFontSize : 18),
    mouseMode: cloneFrom?.mouseMode ?? (mouseModeEl?.value || "on"),
    theme: cloneFrom
      ? {
          selectValue: cloneFrom.theme.selectValue,
          sourceLabel: cloneFrom.theme.sourceLabel,
          theme: cloneFrom.theme.theme,
        }
      : {
          selectValue: defaultThemeName,
          sourceLabel: defaultThemeName ? "default theme" : "",
          theme: null,
        },
    ui: createDefaultPaneUi(),
  };

  panes.set(id, pane);

  const app = createResttyApp({
    canvas,
    imeInput,
    session: sharedSession,
    elements: {
      termDebugEl,
      atlasInfoEl,
      atlasCanvas,
    },
    debugExpose: true,
    renderer: pane.renderer,
    fontSize: pane.fontSize,
    callbacks: {
      onLog: (line) => appendLog(`[pane ${id}] ${line}`),
      onBackend: (backend) => {
        mutatePane(id, (target) => {
          target.ui.backend = backend;
        });
      },
      onFps: (fps) => {
        mutatePane(id, (target) => {
          target.ui.fps = `${Math.round(fps)}`;
        });
      },
      onDpr: (dpr) => {
        mutatePane(id, (target) => {
          target.ui.dpr = Number.isFinite(dpr) ? dpr.toFixed(2) : "-";
        });
      },
      onCanvasSize: (width, height) => {
        mutatePane(id, (target) => {
          target.ui.size = `${width}x${height}`;
        });
      },
      onGridSize: (cols, rows) => {
        mutatePane(id, (target) => {
          target.ui.grid = `${cols}x${rows}`;
        });
      },
      onCellSize: (cellW, cellH) => {
        mutatePane(id, (target) => {
          target.ui.cell = `${cellW.toFixed(1)}x${cellH.toFixed(1)}`;
        });
      },
      onTermSize: (cols, rows) => {
        mutatePane(id, (target) => {
          target.ui.termSize = `${cols}x${rows}`;
        });
      },
      onCursor: (col, row) => {
        mutatePane(id, (target) => {
          target.ui.cursor = `${col},${row}`;
        });
      },
      onDebug: (text) => {
        mutatePane(id, (target) => {
          target.ui.debug = text;
        });
      },
      onInputDebug: (text) => {
        mutatePane(id, (target) => {
          target.ui.inputDebug = text;
        });
      },
      onPtyStatus: (status) => {
        mutatePane(id, (target) => {
          target.ui.ptyStatus = status;
        });
        const target = panes.get(id);
        if (target && target.id === activePaneId) {
          syncPtyButton(target);
        }
      },
      onMouseStatus: (status) => {
        mutatePane(id, (target) => {
          target.ui.mouseStatus = status;
        });
      },
    },
  });

  pane.app = app;
  pane.demos = createDemoController(app);
  pane.mouseMode = pane.app.getMouseStatus().mode;
  pane.ui.ptyStatus = pane.app.isPtyConnected() ? "connected" : "disconnected";

  if (pane.theme.selectValue) {
    applyBuiltinThemeToPane(pane, pane.theme.selectValue, pane.theme.sourceLabel || pane.theme.selectValue);
  } else if (pane.theme.theme) {
    applyThemeToPane(pane, pane.theme.theme, pane.theme.sourceLabel || "pane theme", pane.theme.selectValue);
  }

  pane.app.setMouseMode(pane.mouseMode);
  void pane.app.init();

  container.addEventListener("pointerdown", () => {
    markPaneFocused(id, false);
  });

  container.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    markPaneFocused(id, false);
    showPaneContextMenu(pane, event.clientX, event.clientY);
  });

  canvas.addEventListener("focus", () => {
    markPaneFocused(id, false);
  });

  imeInput.addEventListener("focus", () => {
    markPaneFocused(id, false);
  });

  return pane;
}

function endSplitResize() {
  if (!splitResizeState) return;
  splitResizeState.divider.classList.remove("is-dragging");
  document.body.classList.remove("is-resizing-split");
  splitResizeState = null;
}

function handleSplitResizePointerMove(event: PointerEvent) {
  const state = splitResizeState;
  if (!state || event.pointerId !== state.pointerId) return;
  event.preventDefault();

  const coord = state.axis === "x" ? event.clientX : event.clientY;
  const delta = coord - state.startCoord;
  const minimum = 96;
  const maxFirst = Math.max(minimum, state.total - minimum);
  const nextFirst = Math.min(maxFirst, Math.max(minimum, state.startFirst + delta));
  const nextSecond = Math.max(minimum, state.total - nextFirst);

  const firstPercent = (nextFirst / (nextFirst + nextSecond)) * 100;
  const secondPercent = 100 - firstPercent;
  state.first.style.flex = `0 0 ${firstPercent.toFixed(5)}%`;
  state.second.style.flex = `0 0 ${secondPercent.toFixed(5)}%`;
  queueResizeAllPanes();
}

function handleSplitResizePointerEnd(event: PointerEvent) {
  if (!splitResizeState || event.pointerId !== splitResizeState.pointerId) return;
  const { divider } = splitResizeState;
  try {
    divider.releasePointerCapture(splitResizeState.pointerId);
  } catch {}
  divider.removeEventListener("pointermove", handleSplitResizePointerMove);
  divider.removeEventListener("pointerup", handleSplitResizePointerEnd);
  divider.removeEventListener("pointercancel", handleSplitResizePointerEnd);
  endSplitResize();
}

function createSplitDivider(direction: SplitDirection): HTMLDivElement {
  const divider = document.createElement("div");
  divider.className = `pane-divider ${direction === "vertical" ? "is-vertical" : "is-horizontal"}`;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-orientation", direction === "vertical" ? "vertical" : "horizontal");

  divider.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const first = divider.previousElementSibling as HTMLElement | null;
    const second = divider.nextElementSibling as HTMLElement | null;
    const split = divider.parentElement as HTMLElement | null;
    if (!first || !second || !split) return;

    const splitRect = split.getBoundingClientRect();
    const firstRect = first.getBoundingClientRect();
    const axis: "x" | "y" = direction === "vertical" ? "x" : "y";
    const total = axis === "x" ? splitRect.width : splitRect.height;
    if (total <= 0) return;

    endSplitResize();
    event.preventDefault();
    event.stopPropagation();

    splitResizeState = {
      pointerId: event.pointerId,
      axis,
      divider,
      first,
      second,
      startCoord: axis === "x" ? event.clientX : event.clientY,
      startFirst: axis === "x" ? firstRect.width : firstRect.height,
      total,
    };

    divider.classList.add("is-dragging");
    document.body.classList.add("is-resizing-split");
    divider.setPointerCapture(event.pointerId);
    divider.addEventListener("pointermove", handleSplitResizePointerMove);
    divider.addEventListener("pointerup", handleSplitResizePointerEnd);
    divider.addEventListener("pointercancel", handleSplitResizePointerEnd);
  });

  return divider;
}

function splitPane(target: Pane, direction: SplitDirection) {
  const parent = target.container.parentElement;
  if (!parent) return;

  const split = document.createElement("div");
  split.className = `pane-split ${direction === "vertical" ? "is-vertical" : "is-horizontal"}`;
  const inheritedFlex = target.container.style.flex;
  if (inheritedFlex) {
    split.style.flex = inheritedFlex;
  }

  parent.replaceChild(split, target.container);
  target.container.style.flex = "0 0 50%";
  split.appendChild(target.container);
  split.appendChild(createSplitDivider(direction));

  const newPane = createPane(target);
  newPane.container.style.flex = "0 0 50%";
  split.appendChild(newPane.container);

  markPaneFocused(newPane.id, true);
  queueResizeAllPanes();
  appendLog(`[ui] split ${direction} pane ${target.id} -> pane ${newPane.id}`);
}

function splitActivePane(direction: SplitDirection) {
  const target = getSplitTargetPane();
  if (!target) return;
  splitPane(target, direction);
}

function collapseSplitAncestors(start: HTMLElement | null) {
  let current = start;
  while (current && current.classList.contains("pane-split")) {
    const branches = getSplitBranches(current);
    if (branches.length > 1) return;
    const onlyChild = branches[0];
    const parent = current.parentElement;
    if (!parent || !onlyChild) return;
    const inheritedFlex = current.style.flex;
    if (inheritedFlex) {
      onlyChild.style.flex = inheritedFlex;
    }
    parent.replaceChild(onlyChild, current);
    current = parent;
  }
}

function closePane(id: number) {
  if (panes.size <= 1) return false;
  const pane = panes.get(id);
  if (!pane) return false;

  pane.demos.stop();
  pane.app.destroy();
  panes.delete(id);
  if (activePaneId === id) activePaneId = null;
  if (focusedPaneId === id) focusedPaneId = null;

  const parent = pane.container.parentElement as HTMLElement | null;
  pane.container.remove();
  collapseSplitAncestors(parent);

  const fallback = getActivePane() ?? getFirstPane();
  if (fallback) {
    markPaneFocused(fallback.id, true);
  }
  queueResizeAllPanes();
  appendLog(`[ui] closed pane ${id}`);
  return true;
}

const contextMenuEl = document.createElement("div");
contextMenuEl.className = "pane-context-menu";
contextMenuEl.hidden = true;
document.body.appendChild(contextMenuEl);

function hidePaneContextMenu() {
  contextMenuEl.hidden = true;
  contextMenuEl.innerHTML = "";
}

function addContextMenuSeparator() {
  const hr = document.createElement("div");
  hr.className = "pane-context-menu-separator";
  contextMenuEl.appendChild(hr);
}

function renderPaneContextMenu(items: Array<ContextMenuItem | "separator">) {
  contextMenuEl.innerHTML = "";
  for (const item of items) {
    if (item === "separator") {
      addContextMenuSeparator();
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pane-context-menu-item";
    if (item.danger) button.classList.add("is-danger");
    if (item.enabled === false) button.disabled = true;

    const label = document.createElement("span");
    label.className = "pane-context-menu-label";
    label.textContent = item.label;
    button.appendChild(label);

    if (item.shortcut) {
      const shortcut = document.createElement("span");
      shortcut.className = "pane-context-menu-shortcut";
      shortcut.textContent = item.shortcut;
      button.appendChild(shortcut);
    }

    button.addEventListener("click", () => {
      hidePaneContextMenu();
      void item.action();
    });
    contextMenuEl.appendChild(button);
  }
}

function showPaneContextMenu(pane: Pane, clientX: number, clientY: number) {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const mod = isMac ? "Cmd" : "Ctrl";
  const items: Array<ContextMenuItem | "separator"> = [
    {
      label: "Copy",
      shortcut: `${mod}+C`,
      action: async () => {
        await pane.app.copySelectionToClipboard();
      },
    },
    {
      label: "Paste",
      shortcut: `${mod}+V`,
      action: async () => {
        await pane.app.pasteFromClipboard();
      },
    },
    "separator",
    {
      label: "Split Right",
      shortcut: `${mod}+D`,
      action: () => splitPane(pane, "vertical"),
    },
    {
      label: "Split Down",
      shortcut: `${mod}+Shift+D`,
      action: () => splitPane(pane, "horizontal"),
    },
    {
      label: "Close Pane",
      danger: true,
      enabled: panes.size > 1,
      action: () => {
        closePane(pane.id);
      },
    },
    "separator",
    {
      label: "Clear Screen",
      action: () => pane.app.clearScreen(),
    },
    {
      label: pane.app.isPtyConnected() ? "Disconnect PTY" : "Connect PTY",
      action: () => {
        if (pane.app.isPtyConnected()) {
          pane.app.disconnectPty();
          return;
        }
        const url = ptyUrlInput?.value?.trim() ?? "";
        if (url) pane.app.connectPty(url);
      },
    },
    {
      label: pane.paused ? "Resume Renderer" : "Pause Renderer",
      action: () => setPanePaused(pane, !pane.paused),
    },
  ];

  renderPaneContextMenu(items);
  contextMenuEl.hidden = false;

  const margin = 8;
  const rect = contextMenuEl.getBoundingClientRect();
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
  const left = Math.min(Math.max(clientX, margin), maxX);
  const top = Math.min(Math.max(clientY, margin), maxY);
  contextMenuEl.style.left = `${left}px`;
  contextMenuEl.style.top = `${top}px`;
}

window.addEventListener("pointerdown", (event) => {
  if (contextMenuEl.hidden) return;
  if (event.target instanceof Node && contextMenuEl.contains(event.target)) return;
  hidePaneContextMenu();
});

window.addEventListener("blur", () => {
  hidePaneContextMenu();
});

settingsFab?.addEventListener("click", () => {
  openSettingsDialog();
});

settingsClose?.addEventListener("click", () => {
  closeSettingsDialog();
});

settingsDialog?.addEventListener("click", (event) => {
  if (event.target !== settingsDialog) return;
  closeSettingsDialog();
});

settingsDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSettingsDialog();
});

window.addEventListener("keydown", (event) => {
  if (isSettingsDialogOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettingsDialog();
    }
    return;
  }

  if (!contextMenuEl.hidden && event.key === "Escape") {
    hidePaneContextMenu();
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
    const isPaneImeTarget = target.classList.contains("pane-ime-input");
    if (!isPaneImeTarget) return;
  }

  const pane = getSplitTargetPane();
  if (!pane) return;

  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const hasCommandModifier = isMac ? event.metaKey : event.ctrlKey;
  if (!hasCommandModifier || event.altKey || event.code !== "KeyD" || event.repeat) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  splitActivePane(event.shiftKey ? "horizontal" : "vertical");
}, { capture: true });

window.addEventListener("resize", () => {
  queueResizeAllPanes();
});

btnInit?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  setPanePaused(pane, false);
  pane.demos.stop();
  void pane.app.init();
});

btnPause?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  setPanePaused(pane, !pane.paused);
});

btnClear?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  pane.demos.stop();
  pane.app.clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  pane.demos.run(demoSelect?.value ?? "basic");
});

ptyBtn?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  if (pane.app.isPtyConnected()) {
    pane.app.disconnectPty();
  } else {
    const url = ptyUrlInput?.value?.trim() ?? "";
    if (url) pane.app.connectPty(url);
  }
});

rendererSelect?.addEventListener("change", () => {
  const pane = getActivePane();
  if (!pane) return;
  const value = rendererSelect.value;
  if (!isRendererChoice(value)) return;
  pane.renderer = value;
  pane.app.setRenderer(value);
});

if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    const pane = getActivePane();
    const file = themeFileInput.files?.[0];
    if (!pane || !file) return;
    file
      .text()
      .then((text) => {
        const theme: GhosttyTheme = parseGhosttyTheme(text);
        if (applyThemeToPane(pane, theme, file.name || "theme file", "") && themeSelect) {
          themeSelect.value = "";
        }
      })
      .catch((err: any) => {
        console.error("theme load failed", err);
        appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
      })
      .finally(() => {
        themeFileInput.value = "";
      });
  });
}

if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    const pane = getActivePane();
    if (!pane) return;
    const name = themeSelect.value;
    if (!name) {
      resetThemeForPane(pane);
      return;
    }
    applyBuiltinThemeToPane(pane, name);
  });
}

if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    const pane = getActivePane();
    if (!pane) return;
    const value = mouseModeEl.value;
    pane.app.setMouseMode(value);
    pane.mouseMode = pane.app.getMouseStatus().mode;
    if (pane.id === activePaneId) {
      mouseModeEl.value = pane.mouseMode;
    }
  });
}

if (fontSizeInput) {
  const applyFontSize = () => {
    const pane = getActivePane();
    if (!pane) return;
    const value = Number(fontSizeInput.value);
    if (!Number.isFinite(value)) return;
    pane.fontSize = value;
    pane.app.setFontSize(value);
  };

  fontSizeInput.addEventListener("change", applyFontSize);
  fontSizeInput.addEventListener("input", applyFontSize);
}

if (btnCopyLog) {
  btnCopyLog.addEventListener("click", async () => {
    const text = logDumpEl ? logDumpEl.value : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      appendLog("[ui] logs copied");
    } catch (err: any) {
      appendLog(`[ui] copy failed: ${err?.message ?? err}`);
    }
  });
}

if (btnClearLog) {
  btnClearLog.addEventListener("click", () => {
    logBuffer.length = 0;
    if (logDumpEl) logDumpEl.value = "";
    appendLog("[ui] logs cleared");
  });
}

if (atlasBtn) {
  atlasBtn.addEventListener("click", () => {
    const pane = getActivePane();
    if (!pane) return;
    const raw = atlasCpInput?.value ?? "";
    const cp = parseCodepointInput(raw);
    if (cp === null) {
      if (atlasInfoEl) atlasInfoEl.textContent = "invalid codepoint";
      return;
    }
    pane.app.dumpAtlasForCodepoint(cp);
  });
}

if (atlasCpInput) {
  atlasCpInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const pane = getActivePane();
    if (!pane) return;
    const raw = atlasCpInput.value;
    const cp = parseCodepointInput(raw);
    if (cp === null) {
      if (atlasInfoEl) atlasInfoEl.textContent = "invalid codepoint";
      return;
    }
    pane.app.dumpAtlasForCodepoint(cp);
  });
}

const firstPane = createPane();
paneRoot.appendChild(firstPane.container);
markPaneFocused(firstPane.id, true);
queueResizeAllPanes();
