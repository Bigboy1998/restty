import type { InputHandler, MouseMode } from "../input";
import type { GhosttyTheme } from "../theme";
import {
  createResttyAppPaneManager,
  type CreateResttyAppPaneManagerOptions,
  type ResttyManagedAppPane,
  type ResttyManagedPaneStyleOptions,
  type ResttyPaneAppOptionsInput,
} from "./pane-app-manager";
import type { ResttyPaneManager, ResttyPaneSplitDirection } from "./panes";
import type { ResttyFontSource } from "./types";

/**
 * Top-level configuration for creating a Restty instance.
 */
export type ResttyOptions = Omit<CreateResttyAppPaneManagerOptions, "appOptions"> & {
  /** Per-pane app options, static or factory. */
  appOptions?: CreateResttyAppPaneManagerOptions["appOptions"];
  /** Font sources applied to every pane. */
  fontSources?: ResttyPaneAppOptionsInput["fontSources"];
  /** Whether to create the first pane automatically (default true). */
  createInitialPane?: boolean | { focus?: boolean };
};

/** Event payloads emitted by the Restty plugin host. */
export type ResttyPluginEvents = {
  "plugin:activated": { pluginId: string };
  "plugin:deactivated": { pluginId: string };
  "pane:created": { paneId: number };
  "pane:closed": { paneId: number };
  "pane:split": {
    sourcePaneId: number;
    createdPaneId: number;
    direction: ResttyPaneSplitDirection;
  };
  "pane:active-changed": { paneId: number | null };
  "layout:changed": {};
  "pane:resized": { paneId: number; cols: number; rows: number };
  "pane:focused": { paneId: number };
  "pane:blurred": { paneId: number };
};

/** A disposable resource returned by plugin APIs. */
export type ResttyPluginDisposable = {
  dispose: () => void;
};

/** Optional cleanup return supported by plugin activation. */
export type ResttyPluginCleanup = void | (() => void) | ResttyPluginDisposable;

/** Payload passed to input interceptors before terminal/program input is written. */
export type ResttyInputInterceptorPayload = {
  paneId: number;
  text: string;
  source: string;
};

/** Payload passed to output interceptors before PTY data is rendered. */
export type ResttyOutputInterceptorPayload = {
  paneId: number;
  text: string;
  source: string;
};

/** Input interceptor contract. */
export type ResttyInputInterceptor = (
  payload: ResttyInputInterceptorPayload,
) => string | null | void;

/** Output interceptor contract. */
export type ResttyOutputInterceptor = (
  payload: ResttyOutputInterceptorPayload,
) => string | null | void;

/** Shared options for interceptor ordering. */
export type ResttyInterceptorOptions = {
  priority?: number;
};

/** Context object provided to each plugin on activation. */
export type ResttyPluginContext = {
  restty: Restty;
  panes: () => ResttyPaneHandle[];
  pane: (id: number) => ResttyPaneHandle | null;
  activePane: () => ResttyPaneHandle | null;
  focusedPane: () => ResttyPaneHandle | null;
  on: <E extends keyof ResttyPluginEvents>(
    event: E,
    listener: (payload: ResttyPluginEvents[E]) => void,
  ) => ResttyPluginDisposable;
  addInputInterceptor: (
    interceptor: ResttyInputInterceptor,
    options?: ResttyInterceptorOptions,
  ) => ResttyPluginDisposable;
  addOutputInterceptor: (
    interceptor: ResttyOutputInterceptor,
    options?: ResttyInterceptorOptions,
  ) => ResttyPluginDisposable;
};

/** Plugin contract for extending Restty behavior. */
export type ResttyPlugin = {
  id: string;
  activate: (context: ResttyPluginContext) => ResttyPluginCleanup | Promise<ResttyPluginCleanup>;
};

type ResttyPluginRuntime = {
  plugin: ResttyPlugin;
  cleanup: (() => void) | null;
  disposers: Array<() => void>;
};

type ResttyRegisteredInterceptor<T extends (payload: unknown) => string | null | void> = {
  id: number;
  pluginId: string;
  priority: number;
  order: number;
  interceptor: T;
};

/**
 * Public API surface exposed by each pane handle.
 */
export type ResttyPaneApi = {
  id: number;
  setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
  setPaused: (value: boolean) => void;
  togglePause: () => void;
  setFontSize: (value: number) => void;
  applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
  resetTheme: () => void;
  sendInput: (text: string, source?: string) => void;
  sendKeyInput: (text: string, source?: string) => void;
  clearScreen: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  isPtyConnected: () => boolean;
  setMouseMode: (value: MouseMode) => void;
  getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
  copySelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: () => Promise<boolean>;
  dumpAtlasForCodepoint: (cp: number) => void;
  resize: (cols: number, rows: number) => void;
  focus: () => void;
  blur: () => void;
  updateSize: (force?: boolean) => void;
  getBackend: () => string;
  getRawPane: () => ResttyManagedAppPane;
};

/**
 * Thin wrapper around a managed pane that delegates calls to the
 * underlying app. Resolves the pane lazily so it stays valid across
 * layout changes.
 */
export class ResttyPaneHandle implements ResttyPaneApi {
  private readonly resolvePane: () => ResttyManagedAppPane;

  constructor(resolvePane: () => ResttyManagedAppPane) {
    this.resolvePane = resolvePane;
  }

  get id(): number {
    return this.resolvePane().id;
  }

  setRenderer(value: "auto" | "webgpu" | "webgl2"): void {
    this.resolvePane().app.setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.resolvePane().app.setPaused(value);
  }

  togglePause(): void {
    this.resolvePane().app.togglePause();
  }

  setFontSize(value: number): void {
    this.resolvePane().app.setFontSize(value);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.resolvePane().app.applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.resolvePane().app.resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.resolvePane().app.sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.resolvePane().app.sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.resolvePane().app.clearScreen();
  }

  connectPty(url = ""): void {
    this.resolvePane().app.connectPty(url);
  }

  disconnectPty(): void {
    this.resolvePane().app.disconnectPty();
  }

  isPtyConnected(): boolean {
    return this.resolvePane().app.isPtyConnected();
  }

  setMouseMode(value: MouseMode): void {
    this.resolvePane().app.setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.resolvePane().app.getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.resolvePane().app.copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.resolvePane().app.pasteFromClipboard();
  }

  dumpAtlasForCodepoint(cp: number): void {
    this.resolvePane().app.dumpAtlasForCodepoint(cp);
  }

  resize(cols: number, rows: number): void {
    this.resolvePane().app.resize(cols, rows);
  }

  focus(): void {
    this.resolvePane().app.focus();
  }

  blur(): void {
    this.resolvePane().app.blur();
  }

  updateSize(force?: boolean): void {
    this.resolvePane().app.updateSize(force);
  }

  getBackend(): string {
    return this.resolvePane().app.getBackend();
  }

  getRawPane(): ResttyManagedAppPane {
    return this.resolvePane();
  }
}

/**
 * Main entry point for the restty terminal widget. Manages a set of
 * split panes, each running its own terminal app, and exposes
 * convenience methods that operate on the active pane.
 */
export class Restty {
  readonly paneManager: ResttyPaneManager<ResttyManagedAppPane>;
  private fontSources: ResttyFontSource[] | undefined;
  private readonly pluginListeners = new Map<
    keyof ResttyPluginEvents,
    Set<(payload: unknown) => void>
  >();
  private readonly pluginRuntimes = new Map<string, ResttyPluginRuntime>();
  private readonly inputInterceptors: Array<ResttyRegisteredInterceptor<ResttyInputInterceptor>> =
    [];
  private readonly outputInterceptors: Array<ResttyRegisteredInterceptor<ResttyOutputInterceptor>> =
    [];
  private nextInterceptorId = 1;
  private nextInterceptorOrder = 1;

  constructor(options: ResttyOptions) {
    const {
      createInitialPane = true,
      appOptions,
      fontSources,
      onPaneCreated,
      onPaneClosed,
      onPaneSplit,
      onActivePaneChange,
      onLayoutChanged,
      ...paneManagerOptions
    } = options;
    this.fontSources = fontSources ? [...fontSources] : undefined;
    const mergedAppOptions: CreateResttyAppPaneManagerOptions["appOptions"] = (context) => {
      const resolved = typeof appOptions === "function" ? appOptions(context) : (appOptions ?? {});
      const resolvedBeforeInput = resolved.beforeInput;
      const resolvedBeforeRenderOutput = resolved.beforeRenderOutput;

      return {
        ...resolved,
        ...(this.fontSources ? { fontSources: this.fontSources } : {}),
        beforeInput: ({ text, source }) => {
          const maybeUserText = resolvedBeforeInput?.({ text, source });
          if (maybeUserText === null) return null;
          const current = maybeUserText === undefined ? text : maybeUserText;
          return this.applyInputInterceptors(context.id, current, source);
        },
        beforeRenderOutput: ({ text, source }) => {
          const maybeUserText = resolvedBeforeRenderOutput?.({ text, source });
          if (maybeUserText === null) return null;
          const current = maybeUserText === undefined ? text : maybeUserText;
          return this.applyOutputInterceptors(context.id, current, source);
        },
      };
    };

    this.paneManager = createResttyAppPaneManager({
      ...paneManagerOptions,
      appOptions: mergedAppOptions,
      onPaneCreated: (pane) => {
        this.emitPluginEvent("pane:created", { paneId: pane.id });
        onPaneCreated?.(pane);
      },
      onPaneClosed: (pane) => {
        this.emitPluginEvent("pane:closed", { paneId: pane.id });
        onPaneClosed?.(pane);
      },
      onPaneSplit: (sourcePane, createdPane, direction) => {
        this.emitPluginEvent("pane:split", {
          sourcePaneId: sourcePane.id,
          createdPaneId: createdPane.id,
          direction,
        });
        onPaneSplit?.(sourcePane, createdPane, direction);
      },
      onActivePaneChange: (pane) => {
        this.emitPluginEvent("pane:active-changed", { paneId: pane?.id ?? null });
        onActivePaneChange?.(pane);
      },
      onLayoutChanged: () => {
        this.emitPluginEvent("layout:changed", {});
        onLayoutChanged?.();
      },
    });

    if (createInitialPane) {
      const focus =
        typeof createInitialPane === "object" ? (createInitialPane.focus ?? true) : true;
      this.paneManager.createInitialPane({ focus });
    }
  }

  getPanes(): ResttyManagedAppPane[] {
    return this.paneManager.getPanes();
  }

  getPaneById(id: number): ResttyManagedAppPane | null {
    return this.paneManager.getPaneById(id);
  }

  getActivePane(): ResttyManagedAppPane | null {
    return this.paneManager.getActivePane();
  }

  getFocusedPane(): ResttyManagedAppPane | null {
    return this.paneManager.getFocusedPane();
  }

  panes(): ResttyPaneHandle[] {
    return this.getPanes().map((pane) => this.makePaneHandle(pane.id));
  }

  pane(id: number): ResttyPaneHandle | null {
    if (!this.getPaneById(id)) return null;
    return this.makePaneHandle(id);
  }

  activePane(): ResttyPaneHandle | null {
    const pane = this.getActivePane();
    if (!pane) return null;
    return this.makePaneHandle(pane.id);
  }

  focusedPane(): ResttyPaneHandle | null {
    const pane = this.getFocusedPane();
    if (!pane) return null;
    return this.makePaneHandle(pane.id);
  }

  forEachPane(visitor: (pane: ResttyPaneHandle) => void): void {
    const panes = this.getPanes();
    for (let i = 0; i < panes.length; i += 1) {
      visitor(this.makePaneHandle(panes[i].id));
    }
  }

  async setFontSources(sources: ResttyFontSource[]): Promise<void> {
    this.fontSources = sources.length ? [...sources] : undefined;
    const panes = this.getPanes();
    const updates: Array<Promise<void>> = new Array(panes.length);
    for (let i = 0; i < panes.length; i += 1) {
      updates[i] = panes[i].app.setFontSources(this.fontSources ?? []);
    }
    await Promise.all(updates);
  }

  createInitialPane(options?: { focus?: boolean }): ResttyManagedAppPane {
    return this.paneManager.createInitialPane(options);
  }

  splitActivePane(direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null {
    return this.paneManager.splitActivePane(direction);
  }

  splitPane(id: number, direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null {
    return this.paneManager.splitPane(id, direction);
  }

  closePane(id: number): boolean {
    return this.paneManager.closePane(id);
  }

  getPaneStyleOptions(): Readonly<Required<ResttyManagedPaneStyleOptions>> {
    return this.paneManager.getStyleOptions();
  }

  setPaneStyleOptions(options: ResttyManagedPaneStyleOptions): void {
    this.paneManager.setStyleOptions(options);
  }

  setActivePane(id: number, options?: { focus?: boolean }): void {
    this.paneManager.setActivePane(id, options);
  }

  markPaneFocused(id: number, options?: { focus?: boolean }): void {
    this.paneManager.markPaneFocused(id, options);
  }

  requestLayoutSync(): void {
    this.paneManager.requestLayoutSync();
  }

  hideContextMenu(): void {
    this.paneManager.hideContextMenu();
  }

  async use(plugin: ResttyPlugin): Promise<void> {
    if (!plugin || typeof plugin !== "object") {
      throw new Error("Restty plugin must be an object");
    }
    const pluginId = plugin.id?.trim?.() ?? "";
    if (!pluginId) {
      throw new Error("Restty plugin id is required");
    }
    if (typeof plugin.activate !== "function") {
      throw new Error(`Restty plugin ${pluginId} must define activate(context)`);
    }
    if (this.pluginRuntimes.has(pluginId)) return;

    const runtime: ResttyPluginRuntime = {
      plugin: { ...plugin, id: pluginId },
      cleanup: null,
      disposers: [],
    };
    this.pluginRuntimes.set(pluginId, runtime);
    try {
      const cleanup = await runtime.plugin.activate(this.createPluginContext(runtime));
      runtime.cleanup = this.normalizePluginCleanup(cleanup);
      this.emitPluginEvent("plugin:activated", { pluginId });
    } catch (error) {
      this.teardownPluginRuntime(runtime);
      this.pluginRuntimes.delete(pluginId);
      throw error;
    }
  }

  unuse(pluginId: string): boolean {
    const key = pluginId?.trim?.() ?? "";
    if (!key) return false;
    const runtime = this.pluginRuntimes.get(key);
    if (!runtime) return false;
    this.pluginRuntimes.delete(key);
    this.teardownPluginRuntime(runtime);
    this.emitPluginEvent("plugin:deactivated", { pluginId: key });
    return true;
  }

  plugins(): string[] {
    return Array.from(this.pluginRuntimes.keys());
  }

  destroy(): void {
    const pluginIds = this.plugins();
    for (let i = 0; i < pluginIds.length; i += 1) {
      this.unuse(pluginIds[i]);
    }
    this.paneManager.destroy();
  }

  connectPty(url = ""): void {
    this.requireActivePaneHandle().connectPty(url);
  }

  disconnectPty(): void {
    this.requireActivePaneHandle().disconnectPty();
  }

  isPtyConnected(): boolean {
    return this.requireActivePaneHandle().isPtyConnected();
  }

  setRenderer(value: "auto" | "webgpu" | "webgl2"): void {
    this.requireActivePaneHandle().setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.requireActivePaneHandle().setPaused(value);
  }

  togglePause(): void {
    this.requireActivePaneHandle().togglePause();
  }

  setFontSize(value: number): void {
    this.requireActivePaneHandle().setFontSize(value);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.requireActivePaneHandle().applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.requireActivePaneHandle().resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.requireActivePaneHandle().sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.requireActivePaneHandle().sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.requireActivePaneHandle().clearScreen();
  }

  setMouseMode(value: MouseMode): void {
    this.requireActivePaneHandle().setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.requireActivePaneHandle().getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.requireActivePaneHandle().copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.requireActivePaneHandle().pasteFromClipboard();
  }

  dumpAtlasForCodepoint(cp: number): void {
    this.requireActivePaneHandle().dumpAtlasForCodepoint(cp);
  }

  resize(cols: number, rows: number): void {
    const pane = this.requireActivePaneHandle();
    pane.resize(cols, rows);
    this.emitPluginEvent("pane:resized", { paneId: pane.id, cols, rows });
  }

  focus(): void {
    const pane = this.requireActivePaneHandle();
    pane.focus();
    this.emitPluginEvent("pane:focused", { paneId: pane.id });
  }

  blur(): void {
    const pane = this.requireActivePaneHandle();
    pane.blur();
    this.emitPluginEvent("pane:blurred", { paneId: pane.id });
  }

  updateSize(force?: boolean): void {
    this.requireActivePaneHandle().updateSize(force);
  }

  getBackend(): string {
    return this.requireActivePaneHandle().getBackend();
  }

  private makePaneHandle(id: number): ResttyPaneHandle {
    return new ResttyPaneHandle(() => this.requirePaneById(id));
  }

  private requirePaneById(id: number): ResttyManagedAppPane {
    const pane = this.getPaneById(id);
    if (!pane) throw new Error(`Restty pane ${id} does not exist`);
    return pane;
  }

  private requireActivePaneHandle(): ResttyPaneHandle {
    const pane = this.getActivePane();
    if (!pane) {
      throw new Error("Restty has no active pane. Create or focus a pane first.");
    }
    return this.makePaneHandle(pane.id);
  }

  private createPluginContext(runtime: ResttyPluginRuntime): ResttyPluginContext {
    return {
      restty: this,
      panes: () => this.panes(),
      pane: (id: number) => this.pane(id),
      activePane: () => this.activePane(),
      focusedPane: () => this.focusedPane(),
      on: <E extends keyof ResttyPluginEvents>(
        event: E,
        listener: (payload: ResttyPluginEvents[E]) => void,
      ) => {
        const dispose = this.onPluginEvent(event, listener);
        runtime.disposers.push(dispose);
        return { dispose };
      },
      addInputInterceptor: (interceptor, options) => {
        const dispose = this.addInputInterceptor(runtime.plugin.id, interceptor, options);
        runtime.disposers.push(dispose);
        return { dispose };
      },
      addOutputInterceptor: (interceptor, options) => {
        const dispose = this.addOutputInterceptor(runtime.plugin.id, interceptor, options);
        runtime.disposers.push(dispose);
        return { dispose };
      },
    };
  }

  private addInputInterceptor(
    pluginId: string,
    interceptor: ResttyInputInterceptor,
    options?: ResttyInterceptorOptions,
  ): () => void {
    return this.registerInterceptor(this.inputInterceptors, pluginId, interceptor, options);
  }

  private addOutputInterceptor(
    pluginId: string,
    interceptor: ResttyOutputInterceptor,
    options?: ResttyInterceptorOptions,
  ): () => void {
    return this.registerInterceptor(this.outputInterceptors, pluginId, interceptor, options);
  }

  private registerInterceptor<T extends (payload: unknown) => string | null | void>(
    bucket: Array<ResttyRegisteredInterceptor<T>>,
    pluginId: string,
    interceptor: T,
    options?: ResttyInterceptorOptions,
  ): () => void {
    const entry: ResttyRegisteredInterceptor<T> = {
      id: this.nextInterceptorId++,
      pluginId,
      priority: Number.isFinite(options?.priority) ? Number(options?.priority) : 0,
      order: this.nextInterceptorOrder++,
      interceptor,
    };
    bucket.push(entry);
    bucket.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.order - b.order;
    });
    return () => {
      const index = bucket.findIndex((current) => current.id === entry.id);
      if (index >= 0) {
        bucket.splice(index, 1);
      }
    };
  }

  private applyInputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.applyInterceptors(this.inputInterceptors, "input", { paneId, text, source });
  }

  private applyOutputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.applyInterceptors(this.outputInterceptors, "output", { paneId, text, source });
  }

  private applyInterceptors<TPayload extends { text: string }>(
    bucket: Array<ResttyRegisteredInterceptor<(payload: TPayload) => string | null | void>>,
    kind: "input" | "output",
    payload: TPayload,
  ): string | null {
    let currentText = payload.text;
    for (let i = 0; i < bucket.length; i += 1) {
      const entry = bucket[i];
      try {
        const result = entry.interceptor({ ...payload, text: currentText });
        if (result === null) return null;
        if (typeof result === "string") currentText = result;
      } catch (error) {
        console.error(`[restty plugin] ${kind} interceptor error (${entry.pluginId}):`, error);
      }
    }
    return currentText;
  }

  private onPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    listener: (payload: ResttyPluginEvents[E]) => void,
  ): () => void {
    let listeners = this.pluginListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.pluginListeners.set(event, listeners);
    }
    const wrapped = listener as (payload: unknown) => void;
    listeners.add(wrapped);
    return () => {
      const current = this.pluginListeners.get(event);
      if (!current) return;
      current.delete(wrapped);
      if (current.size === 0) {
        this.pluginListeners.delete(event);
      }
    };
  }

  private emitPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ): void {
    const listeners = this.pluginListeners.get(event);
    if (!listeners || listeners.size === 0) return;
    const snapshot = Array.from(listeners);
    for (let i = 0; i < snapshot.length; i += 1) {
      try {
        snapshot[i](payload);
      } catch (error) {
        console.error(`[restty plugin] listener error (${String(event)}):`, error);
      }
    }
  }

  private teardownPluginRuntime(runtime: ResttyPluginRuntime): void {
    for (let i = 0; i < runtime.disposers.length; i += 1) {
      try {
        runtime.disposers[i]();
      } catch {
        // ignore plugin dispose errors
      }
    }
    runtime.disposers.length = 0;
    const cleanup = runtime.cleanup;
    runtime.cleanup = null;
    if (!cleanup) return;
    try {
      cleanup();
    } catch (error) {
      console.error(`[restty plugin] cleanup error (${runtime.plugin.id}):`, error);
    }
  }

  private normalizePluginCleanup(cleanup: ResttyPluginCleanup): (() => void) | null {
    if (!cleanup) return null;
    if (typeof cleanup === "function") return cleanup;
    if (typeof cleanup === "object" && typeof cleanup.dispose === "function") {
      return () => cleanup.dispose();
    }
    return null;
  }
}

/** Create a new Restty instance with the given options. */
export function createRestty(options: ResttyOptions): Restty {
  return new Restty(options);
}
