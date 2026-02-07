# Public API (Draft)

## Core
- `createTerminal({ cols, rows, scrollback }) -> Terminal`
- `terminal.write(data: Uint8Array)`
- `terminal.resize({ cols, rows, pxWidth, pxHeight })`
- `terminal.scroll({ delta | top | bottom })`
- `terminal.destroy()`

## Rendering
- `terminal.render(frameInfo)`
  - `frameInfo` provides target canvas and device (WebGPU/WebGL2).
- `terminal.setRenderer('webgpu' | 'webgl2')`

## Fonts
- `terminal.setFont({ source, name?, data? })`
- `terminal.setFontSize(px)`
- `terminal.setFontFeatures({ liga, calt, kern, ... })`
- `terminal.listLocalFonts()` (Chromium only; user gesture required)

## Input
- `terminal.encodeKey(event: KeyboardEvent) -> Uint8Array`
- `terminal.onInput(cb)` (used by host to send bytes to PTY)
- `terminal.sendText(text)` (IME / paste)

## Output (Responses)
- `terminal.onOutput(cb)` (device status replies, etc.)

## Selection / Clipboard
- `terminal.getSelection()`
- `terminal.setSelection(start, end)`
- `terminal.copySelection()` (delegates to JS clipboard)
- `terminal.paste(text)`

## Events
- `onResize`, `onScroll`, `onTitle`, `onBell`, `onHyperlink`
