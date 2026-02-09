# Plugin Authoring

This guide covers authoring native `restty` plugins.

## Plugin contract

```ts
import type {
  ResttyPlugin,
  ResttyPluginContext,
  RESTTY_PLUGIN_API_VERSION,
} from "restty";

export const examplePlugin: ResttyPlugin = {
  id: "acme/example",
  version: "1.0.0",
  apiVersion: RESTTY_PLUGIN_API_VERSION,
  requires: {
    pluginApi: { min: RESTTY_PLUGIN_API_VERSION, max: RESTTY_PLUGIN_API_VERSION },
  },
  activate(ctx: ResttyPluginContext) {
    const paneCreated = ctx.on("pane:created", ({ paneId }) => {
      console.log("pane created", paneId);
    });

    const inputFilter = ctx.addInputInterceptor(({ text }) => text);
    const outputFilter = ctx.addOutputInterceptor(({ text }) => text);

    return () => {
      paneCreated.dispose();
      inputFilter.dispose();
      outputFilter.dispose();
    };
  },
};
```

## Metadata and compatibility

- `id`: required stable identifier (`namespace/name` recommended).
- `version`: plugin version string for diagnostics.
- `apiVersion`: exact plugin API version expected by the plugin.
- `requires.pluginApi`: exact value or `{ min, max }` range.

If compatibility checks fail, `restty.use(plugin)` throws and the failure appears in `restty.pluginInfo(...)`.

## Runtime API

- `await restty.use(plugin)`: activate plugin once.
- `restty.unuse(pluginId)`: deactivate plugin and run cleanup.
- `restty.plugins()`: active plugin IDs.
- `restty.pluginInfo(pluginId?)`: diagnostics snapshot (active state, errors, listener/interceptor counts).

## Interceptors

- `addInputInterceptor`: intercepts program/key input before terminal write.
- `addOutputInterceptor`: intercepts PTY output before render queue.
- Return behavior:
- `string`: replace payload text.
- `null`: drop payload.
- `void`: pass through.

Ordering:

- Lower `priority` runs first.
- Same `priority` uses registration order.

## Safety expectations

- Interceptors and event listeners are isolated; thrown errors are logged and processing continues.
- Cleanup must be idempotent.
- Keep hooks fast; these run on hot paths.

## Recommended practices

- Keep plugin state local to `activate`.
- Always hold disposers and release them in cleanup.
- Avoid mutating global state or DOM directly unless necessary.
- Use deterministic IDs and semantic versions.
