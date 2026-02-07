import { expect, test } from "bun:test";
import { decodePtyBinary } from "../src/pty/pty";

function decodeWithStreaming(bytes: Uint8Array, splitAt: number): string {
  const decoder = new TextDecoder();
  const a = bytes.subarray(0, splitAt);
  const b = bytes.subarray(splitAt);
  const first = decodePtyBinary(decoder, a, true);
  const second = decodePtyBinary(decoder, b, true);
  const tail = decoder.decode();
  return first + second + tail;
}

test("PTY UTF-8 decoder preserves split multibyte sequences", () => {
  const legacy = String.fromCodePoint(0x1fb82, 0x1fb88, 0x1fb82);
  const text = `box ${legacy} emoji 😀 cjk 漢字`;
  const bytes = new TextEncoder().encode(text);

  for (let splitAt = 1; splitAt < bytes.length; splitAt += 1) {
    const decoded = decodeWithStreaming(bytes, splitAt);
    expect(decoded).toBe(text);
  }
});

test("non-streaming UTF-8 decoding corrupts split multibyte chunks", () => {
  const text = `X ${String.fromCodePoint(0x1fb82)} Y`;
  const bytes = new TextEncoder().encode(text);
  const splitAt = 3;
  const decoder = new TextDecoder();
  const a = bytes.subarray(0, splitAt);
  const b = bytes.subarray(splitAt);
  const corrupted = decoder.decode(a) + decoder.decode(b);
  expect(corrupted).not.toBe(text);
  expect(corrupted.includes("\uFFFD")).toBe(true);
});

