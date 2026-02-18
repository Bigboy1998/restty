import { decodeBase64Text, encodeBase64Bytes } from "../utils/base64";

type KittyTerminator = {
  index: number;
  len: 1 | 2;
};

/** State for streaming Kitty file-based media rewriting (tracks remainder across chunks). */
export type KittyMediaRewriteState = {
  remainder?: string;
};

/** Callback to read file contents for Kitty file-based media payloads. */
export type KittyMediaReadFile = (path: string) => Uint8Array;

function findKittyTerminator(data: string, from: number): KittyTerminator | null {
  const bel = data.indexOf("\x07", from);
  const st = data.indexOf("\x1b\\", from);
  if (bel === -1 && st === -1) return null;
  if (bel !== -1 && (st === -1 || bel < st)) return { index: bel, len: 1 };
  return { index: st, len: 2 };
}

function isValidKittyControlValue(value: string): boolean {
  if (!value) return false;
  if (value.length === 1) return true;
  return /^-?\d+$/.test(value);
}

function sanitizeKittyControl(control: string): string {
  if (!control) return "";
  const parts = control.split(",");
  const sanitized: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!isValidKittyControlValue(value)) continue;
    const next = `${key}=${value}`;
    sanitized.push(next);
  }

  return sanitized.join(",");
}

function isLikelyKittyResponse(control: string): boolean {
  if (!control) return false;
  const parts = control.split(",");
  if (!parts.length) return false;
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) return false;
    const key = part.slice(0, eq);
    if (key !== "i" && key !== "I" && key !== "p") return false;
  }
  return true;
}

function rewriteOneKittyCommand(
  body: string,
  _state: KittyMediaRewriteState,
  readFile: KittyMediaReadFile,
): string | null {
  const sep = body.indexOf(";");
  if (sep < 0) return sanitizeKittyControl(body);

  const control = sanitizeKittyControl(body.slice(0, sep));
  const payload = body.slice(sep + 1);

  // Kitty response packets (ESC_G...;OK/ERR ESC\) can be echoed by PTYs.
  // They are terminal->app traffic and should never be parsed as commands.
  if (isLikelyKittyResponse(control)) return null;
  if (!payload) return `${control};`;

  const parts = control.split(",");
  let medium: string | null = null;
  let hasMedium = false;
  let hasMore = false;
  for (const part of parts) {
    if (part.startsWith("t=")) {
      hasMedium = true;
      medium = part.slice(2);
    } else if (part.startsWith("m=")) {
      hasMore = true;
    }
  }

  // Only local file or temp file media need host filesystem access.
  if (medium !== "f" && medium !== "t") {
    return control ? `${control};${payload}` : `;${payload}`;
  }

  const path = decodeBase64Text(payload);
  if (!path || path.includes("\0")) {
    return control ? `${control};${payload}` : `;${payload}`;
  }

  let bytes: Uint8Array;
  try {
    bytes = readFile(path);
  } catch {
    return control ? `${control};${payload}` : `;${payload}`;
  }

  const nextParts = parts.map((part) => {
    if (part.startsWith("t=")) return "t=d";
    if (part.startsWith("m=")) return "m=0";
    return part;
  });
  if (!hasMedium) nextParts.push("t=d");
  if (hasMore) {
    // Already normalized by the map above.
  }

  try {
    return `${nextParts.join(",")};${encodeBase64Bytes(bytes)}`;
  } catch {
    return control ? `${control};${payload}` : `;${payload}`;
  }
}

/** Rewrite Kitty file-based media sequences (f=...) to direct base64 payloads (t=d). */
export function rewriteKittyFileMediaToDirect(
  chunk: string,
  state: KittyMediaRewriteState,
  readFile: KittyMediaReadFile,
): string {
  const input = (state.remainder ?? "") + chunk;
  let out = "";
  let i = 0;

  while (i < input.length) {
    const start = input.indexOf("\x1b_G", i);
    if (start < 0) {
      out += input.slice(i);
      state.remainder = "";
      return out;
    }

    out += input.slice(i, start);
    const terminator = findKittyTerminator(input, start + 3);
    if (!terminator) {
      state.remainder = input.slice(start);
      return out;
    }

    const body = input.slice(start + 3, terminator.index);
    const rewritten = rewriteOneKittyCommand(body, state, readFile);
    if (rewritten !== null) {
      out += "\x1b_G";
      out += rewritten;
      out += terminator.len === 2 ? "\x1b\\" : "\x07";
    }

    i = terminator.index + terminator.len;
  }

  state.remainder = "";
  return out;
}
