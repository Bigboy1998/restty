import { readFileSync } from "node:fs";
import { dlopen, FFIType, ptr, suffix } from "bun:ffi";
import {
  rewriteKittyFileMediaToDirect,
  type KittyMediaRewriteState,
} from "../src/pty/kitty-media";

const port = Number(Bun.env.PTY_PORT ?? 8787);
const defaultShell = Bun.env.SHELL ?? "fish";
const textDecoder = new TextDecoder();
const forceGhosttyProfile = Bun.env.RESTTY_PTY_FORCE_GHOSTTY === "1";
const rewriteKittyFileMedia = Bun.env.RESTTY_KITTY_REWRITE_FILE_MEDIA === "1";
const O_RDWR = 0x0002;
const TIOCSWINSZ = process.platform === "darwin" ? 0x80087467 : 0x5414;

const libc = (() => {
  const names =
    process.platform === "darwin"
      ? ["libc.dylib", "libSystem.B.dylib"]
      : ["libc.so.6", `libc.${suffix}`];
  for (const name of names) {
    try {
      return dlopen(name, {
        open: {
          args: [FFIType.cstring, FFIType.i32],
          returns: FFIType.i32,
        },
        ioctl: {
          args: [FFIType.i32, FFIType.u64, FFIType.ptr],
          returns: FFIType.i32,
        },
        close: {
          args: [FFIType.i32],
          returns: FFIType.i32,
        },
      });
    } catch {
      // try next libc candidate
    }
  }
  return null;
})();

type PtySocket = {
  url: URL;
  proc?: Bun.Subprocess;
  terminal?: Bun.Terminal;
  kittyState?: KittyMediaRewriteState;
  ttyPath?: string;
};

type ShellSpec = {
  cmd: string;
  args: string[];
  label: string;
};

type ClientControlMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number; widthPx?: number; heightPx?: number };

function parseClientControlMessage(text: string): ClientControlMessage | null {
  try {
    const parsed = JSON.parse(text) as {
      type?: unknown;
      data?: unknown;
      cols?: unknown;
      rows?: unknown;
      widthPx?: unknown;
      heightPx?: unknown;
    };
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.type === "input" && typeof parsed.data === "string") {
      return { type: "input", data: parsed.data };
    }
    if (
      parsed.type === "resize" &&
      typeof parsed.cols === "number" &&
      typeof parsed.rows === "number"
    ) {
      return {
        type: "resize",
        cols: parsed.cols,
        rows: parsed.rows,
        widthPx: typeof parsed.widthPx === "number" ? parsed.widthPx : undefined,
        heightPx: typeof parsed.heightPx === "number" ? parsed.heightPx : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function looksLikeJsonControlPayload(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{")) return false;
  return trimmed.includes("\"type\"");
}

function resolveTtyPath(pid: number): string | null {
  if (!Number.isFinite(pid) || pid <= 0) return null;
  const result = Bun.spawnSync(["ps", "-o", "tty=", "-p", String(pid)], {
    stdout: "pipe",
    stderr: "ignore",
  });
  if (result.exitCode !== 0) return null;
  const raw = textDecoder.decode(result.stdout).trim();
  if (!raw || raw === "?" || raw === "??") return null;
  if (raw.startsWith("/dev/")) return raw;
  return `/dev/${raw}`;
}

function applyPixelWinsize(
  ttyPath: string | undefined,
  cols: number,
  rows: number,
  widthPx: number,
  heightPx: number,
): void {
  if (!ttyPath || !libc) return;
  if (
    !Number.isFinite(cols) ||
    !Number.isFinite(rows) ||
    !Number.isFinite(widthPx) ||
    !Number.isFinite(heightPx)
  ) {
    return;
  }
  if (cols <= 0 || rows <= 0 || widthPx <= 0 || heightPx <= 0) return;

  const ttyPathZ = Buffer.from(`${ttyPath}\0`, "utf8");
  const fd = libc.symbols.open(ttyPathZ, O_RDWR);
  if (fd < 0) return;
  try {
    const winsize = new Uint8Array(8);
    const view = new DataView(winsize.buffer);
    view.setUint16(0, Math.min(0xffff, Math.round(rows)), true);
    view.setUint16(2, Math.min(0xffff, Math.round(cols)), true);
    view.setUint16(4, Math.min(0xffff, Math.round(widthPx)), true);
    view.setUint16(6, Math.min(0xffff, Math.round(heightPx)), true);
    libc.symbols.ioctl(fd, TIOCSWINSZ, ptr(winsize));
  } finally {
    libc.symbols.close(fd);
  }
}

function parseShellSpec(spec: string | null | undefined): ShellSpec | null {
  if (!spec) return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/g);
  return {
    cmd: parts[0] ?? trimmed,
    args: parts.slice(1),
    label: trimmed,
  };
}

function buildShellCandidates(shellParam: string | null): ShellSpec[] {
  const candidates: ShellSpec[] = [];
  const add = (spec: ShellSpec | null) => {
    if (!spec) return;
    if (candidates.some((c) => c.cmd === spec.cmd && c.args.join(" ") === spec.args.join(" "))) return;
    candidates.push(spec);
  };

  add(parseShellSpec(shellParam));
  add(parseShellSpec(Bun.env.SHELL));
  add(parseShellSpec(defaultShell));
  add({ cmd: "/opt/homebrew/bin/fish", args: [], label: "/opt/homebrew/bin/fish" });
  add({ cmd: "/usr/local/bin/fish", args: [], label: "/usr/local/bin/fish" });
  add({ cmd: "/bin/zsh", args: [], label: "/bin/zsh" });
  add({ cmd: "/bin/bash", args: [], label: "/bin/bash" });
  add({ cmd: "/bin/sh", args: [], label: "/bin/sh" });
  add({ cmd: "/usr/bin/zsh", args: [], label: "/usr/bin/zsh" });
  add({ cmd: "/usr/bin/bash", args: [], label: "/usr/bin/bash" });
  add({ cmd: "/usr/bin/env", args: ["zsh"], label: "env zsh" });
  add({ cmd: "/usr/bin/env", args: ["bash"], label: "env bash" });
  add({ cmd: "/usr/bin/env", args: ["sh"], label: "env sh" });
  return candidates;
}

function spawnWithFallbacks(
  candidates: ShellSpec[],
  cols: number,
  rows: number,
  cwd: string,
  env: Record<string, string | undefined>,
  kittyState: KittyMediaRewriteState,
  ws: ServerWebSocket<PtySocket>,
) {
  const errors: string[] = [];
  const decoder = new TextDecoder();
  const readKittyMediaFile = rewriteKittyFileMedia
    ? (path: string) => new Uint8Array(readFileSync(path))
    : () => {
        throw new Error("kitty file-media rewrite disabled");
      };
  const handleOutputText = (text: string) => {
    if (!text) return;
    const rewritten = rewriteKittyFileMediaToDirect(text, kittyState, readKittyMediaFile);
    if (rewritten.length > 0) ws.send(rewritten);
  };

  for (const candidate of candidates) {
    try {
      const proc = Bun.spawn([candidate.cmd, ...candidate.args], {
        cwd,
        env,
        terminal: {
          cols,
          rows,
          data(_term, data) {
            try {
              if (typeof data === "string") {
                handleOutputText(data);
                return;
              }

              if (data instanceof ArrayBuffer) {
                handleOutputText(decoder.decode(data, { stream: true }));
                return;
              }

              if (ArrayBuffer.isView(data)) {
                handleOutputText(decoder.decode(data as Uint8Array, { stream: true }));
                return;
              }
            } catch {}
          },
        },
      });
      if (!proc.terminal) {
        try {
          proc.kill();
        } catch {}
        throw new Error("PTY terminal unavailable");
      }
      return { terminal: proc.terminal, proc, shell: candidate.label, errors };
    } catch (err) {
      errors.push(`${candidate.label}: ${err?.message ?? err}`);
    }
  }
  return { terminal: null, proc: null, shell: "", errors };
}

const server = Bun.serve<PtySocket>({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/pty" && server.upgrade(req, { data: { url } })) {
      return;
    }
    return new Response("restty pty server");
  },
  websocket: {
    open(ws) {
      const url = ws.data.url;
      const cols = Number(url.searchParams.get("cols") ?? 80);
      const rows = Number(url.searchParams.get("rows") ?? 24);
      const shellParam = url.searchParams.get("shell") ?? defaultShell;
      const cwd = url.searchParams.get("cwd") ?? process.cwd();
      const kittyState: KittyMediaRewriteState = { remainder: "" };
      ws.data.kittyState = kittyState;
      const env: Record<string, string | undefined> = { ...process.env };
      if (forceGhosttyProfile) {
        env.TERM = env.TERM || "xterm-ghostty";
        env.COLORTERM = env.COLORTERM || "truecolor";
        env.NVIM_TUI_ENABLE_TRUE_COLOR = env.NVIM_TUI_ENABLE_TRUE_COLOR || "1";
        env.TERM_PROGRAM = "ghostty";
        env.TERM_PROGRAM_VERSION = env.TERM_PROGRAM_VERSION || "1.0";
        env.SNACKS_GHOSTTY = "1";
      }

      const candidates = buildShellCandidates(shellParam);
      const { terminal, proc, shell, errors } = spawnWithFallbacks(
        candidates,
        Number.isFinite(cols) ? cols : 80,
        Number.isFinite(rows) ? rows : 24,
        cwd,
        env,
        kittyState,
        ws,
      );

      if (!terminal || !proc) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Failed to spawn shell",
            errors,
          }),
        );
        ws.close();
        return;
      }

      ws.data.proc = proc;
      ws.data.terminal = terminal;
      ws.data.ttyPath = resolveTtyPath(proc.pid);
      try {
        ws.send(JSON.stringify({ type: "status", shell }));
      } catch {}

      proc.exited
        .then((code) => {
          try {
            ws.send(JSON.stringify({ type: "exit", code }));
          } catch {}
          try {
            ws.close();
          } catch {}
        })
        .catch(() => {
          try {
            ws.send(JSON.stringify({ type: "exit", code: 1 }));
          } catch {}
          try {
            ws.close();
          } catch {}
        });
    },
    message(ws, message) {
      const terminal = ws.data.terminal;
      if (!terminal) return;

      const handleControlText = (text: string): boolean => {
        const msg = parseClientControlMessage(text);
        if (!msg) return false;
        if (msg.type === "input") {
          terminal.write(msg.data);
          return true;
        }
        const cols = Number(msg.cols);
        const rows = Number(msg.rows);
        if (Number.isFinite(cols) && Number.isFinite(rows)) {
          terminal.resize(cols, rows);
          const widthPx = Number(msg.widthPx);
          const heightPx = Number(msg.heightPx);
          applyPixelWinsize(ws.data.ttyPath, cols, rows, widthPx, heightPx);
        }
        return true;
      };

      if (typeof message === "string") {
        if (handleControlText(message)) {
          return;
        }
        if (looksLikeJsonControlPayload(message)) return;
        terminal.write(message);
        return;
      }

      if (message instanceof ArrayBuffer) {
        const text = textDecoder.decode(message);
        if (handleControlText(text)) return;
        if (looksLikeJsonControlPayload(text)) return;
        terminal.write(text);
        return;
      }

      if (ArrayBuffer.isView(message)) {
        const text = textDecoder.decode(message as Uint8Array);
        if (handleControlText(text)) return;
        if (looksLikeJsonControlPayload(text)) return;
        terminal.write(text);
      }
    },
    close(ws) {
      const proc = ws.data.proc;
      const terminal = ws.data.terminal;
      if (proc) {
        try {
          proc.kill();
        } catch {}
      }
      if (terminal) {
        try {
          terminal.close();
        } catch {}
      }
    },
  },
});

console.log(`restty pty server running on ws://localhost:${server.port}/pty`);
