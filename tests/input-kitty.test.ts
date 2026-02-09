import { expect, test } from "bun:test";
import { encodeKeyEvent } from "../src/input/keymap";

const KITTY_FLAG_DISAMBIGUATE = 1 << 0;
const KITTY_FLAG_REPORT_EVENTS = 1 << 1;
const KITTY_FLAG_REPORT_ALTERNATE = 1 << 2;
const KITTY_FLAG_REPORT_ALL = 1 << 3;

type KeyEventOverrides = Partial<KeyboardEvent> & {
  key: string;
  code?: string;
};

function keyEvent(overrides: KeyEventOverrides): KeyboardEvent {
  const base = {
    key: overrides.key,
    code: overrides.code ?? "",
    type: overrides.type ?? "keydown",
    repeat: overrides.repeat ?? false,
    isComposing: overrides.isComposing ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    metaKey: overrides.metaKey ?? false,
    getModifierState: (_mod: string) => false,
  };
  return { ...base, ...overrides } as KeyboardEvent;
}

test("kitty keeps printable key as text unless report_all is set", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "a", code: "KeyA" }),
    undefined,
    KITTY_FLAG_DISAMBIGUATE,
  );
  expect(seq).toBe("a");
});

test("kitty encodes ctrl letter as CSI-u", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "a", code: "KeyA", ctrlKey: true }),
    undefined,
    KITTY_FLAG_DISAMBIGUATE,
  );
  expect(seq).toBe("\x1b[97;5u");
});

test("kitty encodes function keys using kitty form", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "F5" }),
    undefined,
    KITTY_FLAG_DISAMBIGUATE,
  );
  expect(seq).toBe("\x1b[15~");
});

test("kitty emits release event for non-text keys when report_events is enabled", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "F5", type: "keyup" }),
    undefined,
    KITTY_FLAG_REPORT_EVENTS,
  );
  expect(seq).toBe("\x1b[15;1:3~");
});

test("kitty does not emit Enter release unless report_all is enabled", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "Enter", type: "keyup" }),
    undefined,
    KITTY_FLAG_REPORT_EVENTS,
  );
  expect(seq).toBe("");
});

test("kitty emits Enter release when report_all is enabled", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "Enter", type: "keyup" }),
    undefined,
    KITTY_FLAG_REPORT_EVENTS | KITTY_FLAG_REPORT_ALL,
  );
  expect(seq).toBe("\x1b[13;1:3u");
});

test("kitty report_all encodes text keydown and keyup", () => {
  const down = encodeKeyEvent(
    keyEvent({ key: "a", code: "KeyA" }),
    undefined,
    KITTY_FLAG_REPORT_ALL | KITTY_FLAG_REPORT_EVENTS,
  );
  const up = encodeKeyEvent(
    keyEvent({ key: "a", code: "KeyA", type: "keyup" }),
    undefined,
    KITTY_FLAG_REPORT_ALL | KITTY_FLAG_REPORT_EVENTS,
  );

  expect(down).toBe("\x1b[97;1:1u");
  expect(up).toBe("\x1b[97;1:3u");
});

test("kitty encodes meta as super modifier", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "a", code: "KeyA", metaKey: true }),
    undefined,
    KITTY_FLAG_REPORT_ALL,
  );
  expect(seq).toBe("\x1b[97;9u");
});

test("kitty report_alternate includes shifted alternate codepoint", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "+", code: "Equal", shiftKey: true }),
    undefined,
    KITTY_FLAG_REPORT_ALL | KITTY_FLAG_REPORT_ALTERNATE,
  );
  expect(seq).toBe("\x1b[61:43;2u");
});

test("kitty suppresses lock keys unless report_all is enabled", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "CapsLock" }),
    undefined,
    KITTY_FLAG_DISAMBIGUATE,
  );
  expect(seq).toBe("");
});

test("kitty report_all keeps lock keys available", () => {
  const seq = encodeKeyEvent(
    keyEvent({ key: "CapsLock" }),
    undefined,
    KITTY_FLAG_REPORT_ALL,
  );
  expect(seq).toBe("\x1b[57358u");
});
