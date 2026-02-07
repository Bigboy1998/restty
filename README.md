# wterm

Browser terminal rendering experiments powered by a WASM terminal core, GPU rendering (WebGPU/WebGL2), and TypeScript text shaping.

## What this repo contains

- `src/`: wterm library code (renderer, input, PTY bridge, WASM runtime, app integration).
- `tests/`: Bun test suite.
- `playground/`: browser playground and local PTY server.
- `wasm/`: Zig source for the terminal WASM module.
- `reference/ghostty`: upstream Ghostty reference (git submodule).
- `reference/text-shaper`: upstream text-shaper reference (git submodule).
- `architecture/`: design docs and implementation notes.

## Prerequisites

- Bun `>=1.2.0`
- Git with submodule support
- Optional: Zig (only if rebuilding the WASM core from source)

## Quick start

```bash
git submodule update --init --recursive
bun install
bun run build:assets
bun run playground
```

Playground URL: `http://localhost:5173`

To run the PTY websocket server:

```bash
bun run pty
```

## Tests

```bash
bun run test
```

## Notes

- `tests/webgpu-glyph.test.ts` may bootstrap extra `wgpu-polyfill` assets via `scripts/setup-wgpu-polyfill.ts`.
- Some assets under `playground/public/` are intentionally committed for local/demo runs.
