// restty public API - high-level integration first.

export { RESTTY_PLUGIN_API_VERSION, Restty, ResttyPaneHandle, createRestty } from "./app/restty";
export type {
  ResttyOptions,
  ResttyPaneApi,
  ResttyPluginApiRange,
  ResttyPlugin,
  ResttyPluginCleanup,
  ResttyPluginContext,
  ResttyPluginDisposable,
  ResttyPluginEvents,
  ResttyPluginInfo,
  ResttyPluginRequires,
  ResttyInputInterceptor,
  ResttyInputInterceptorPayload,
  ResttyInterceptorOptions,
  ResttyOutputInterceptor,
  ResttyOutputInterceptorPayload,
} from "./app/restty";

export {
  getBuiltinTheme,
  getBuiltinThemeSource,
  isBuiltinThemeName,
  listBuiltinThemeNames,
  parseGhosttyTheme,
} from "./theme";
export type { GhosttyTheme, ResttyBuiltinThemeName } from "./theme";

export type {
  ResttyFontSource,
  ResttyUrlFontSource,
  ResttyBufferFontSource,
  ResttyLocalFontSource,
  ResttyFontPreset,
} from "./app/types";
