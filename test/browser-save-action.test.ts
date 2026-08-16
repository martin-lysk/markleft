import { describe, expect, it, vi } from "vitest";
import type { SavePickerWindow, WritableFileHandle } from "../src/file/save";
import { saveWithBrowserHost } from "../src/host/browser/save-action";

function fileHandle(): WritableFileHandle {
  return {
    createWritable: vi.fn(() => Promise.resolve({ write: vi.fn(), close: vi.fn() })),
  };
}

describe("saveWithBrowserHost", () => {
  it("writes an existing handle and lets the host update its watch state", async () => {
    const handle = fileHandle();
    const onWritten = vi.fn();

    const result = await saveWithBrowserHost({
      win: {} as SavePickerWindow,
      document: {} as Document,
      markdown: "# Note",
      contents: "<html></html>",
      suggestedName: "note.md.html",
      forcePick: false,
      getHandle: () => handle,
      resolveHandle: vi.fn(),
      onPickedHandle: vi.fn(),
      onWritten,
    });

    expect(result).toBe("saved");
    expect(onWritten).toHaveBeenCalledWith(handle, "<html></html>");
  });

  it("uses a picked file when the user explicitly chooses Save as", async () => {
    const handle = fileHandle();
    const onPickedHandle = vi.fn();
    const result = await saveWithBrowserHost({
      win: { showSaveFilePicker: vi.fn(() => Promise.resolve(handle)) } as unknown as SavePickerWindow,
      document: {} as Document,
      markdown: "# Note",
      contents: "<html></html>",
      suggestedName: "note.md.html",
      forcePick: true,
      getHandle: () => null,
      resolveHandle: vi.fn(),
      onPickedHandle,
      onWritten: vi.fn(),
    });

    expect(result).toBe("saved");
    expect(onPickedHandle).toHaveBeenCalledWith(handle);
  });

  it("leaves the bookmarklet folder flow in control when a directory picker exists", async () => {
    const result = await saveWithBrowserHost({
      win: { showDirectoryPicker: vi.fn() } as unknown as SavePickerWindow,
      document: {} as Document,
      markdown: "# Note",
      contents: "<html></html>",
      suggestedName: "note.md.html",
      forcePick: false,
      getHandle: () => null,
      resolveHandle: vi.fn(() => Promise.resolve(null)),
      onPickedHandle: vi.fn(),
      onWritten: vi.fn(),
    });

    expect(result).toBe("awaiting-folder");
  });
});
