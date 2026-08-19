import { describe, expect, it } from "vitest";
import { installPwaOpenShortcut } from "../src/host/pwa/open-shortcut";

class FakeWindow {
  listener: ((event: KeyboardEvent) => void) | undefined;

  addEventListener(_type: "keydown", listener: (event: KeyboardEvent) => void): void {
    this.listener = listener;
  }

  removeEventListener(): void {
    this.listener = undefined;
  }
}

function shortcut(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: false,
    preventDefault: vi.fn(),
    ...modifiers,
  } as unknown as KeyboardEvent;
}

describe("PWA open shortcut", () => {
  it("routes Cmd+O and Ctrl+O through Markleft's file picker", () => {
    const win = new FakeWindow();
    const open = vi.fn();
    installPwaOpenShortcut(win, open);
    const command = shortcut("o", { metaKey: true });
    const control = shortcut("O", { ctrlKey: true });

    win.listener?.(command);
    win.listener?.(control);

    expect(open).toHaveBeenCalledTimes(2);
    expect(command.preventDefault).toHaveBeenCalledOnce();
    expect(control.preventDefault).toHaveBeenCalledOnce();
  });

  it("does not intercept unrelated or repeating shortcuts", () => {
    const win = new FakeWindow();
    const open = vi.fn();
    installPwaOpenShortcut(win, open);

    win.listener?.(shortcut("o"));
    win.listener?.(shortcut("o", { metaKey: true, repeat: true }));
    win.listener?.(shortcut("o", { metaKey: true, altKey: true }));

    expect(open).not.toHaveBeenCalled();
  });
});
