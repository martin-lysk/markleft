import {
  downloadFallback,
  pickSaveTarget,
  writeFile,
  type SavePickerWindow,
  type WritableFileHandle,
} from "../../file/save";

export type BrowserSaveResult = "saved" | "awaiting-folder" | "unavailable";

export interface BrowserSaveActionInput {
  win: SavePickerWindow;
  document: Document;
  markdown: string;
  contents: string;
  suggestedName: string;
  forcePick: boolean;
  getHandle(): WritableFileHandle | null;
  resolveHandle(): Promise<WritableFileHandle | null>;
  onPickedHandle(handle: WritableFileHandle): void;
  onWritten(handle: WritableFileHandle, contents: string): Promise<void> | void;
}

export function hasBrowserDirectoryPicker(win: SavePickerWindow): boolean {
  return typeof win.showDirectoryPicker === "function";
}

/**
 * Persist a browser-backed document without exposing picker and fallback
 * branches to the editor UI. Folder-based lookup stays injectable because it
 * is specific to the bookmarklet's current-file recovery behavior.
 */
export async function saveWithBrowserHost(
  input: BrowserSaveActionInput,
): Promise<BrowserSaveResult> {
  let handle = input.getHandle();

  if (input.forcePick || !handle) {
    if (input.forcePick) {
      handle = await pickSaveTarget(input.win, { suggestedName: input.suggestedName });
      if (handle) input.onPickedHandle(handle);
    } else {
      handle = await input.resolveHandle();
      if (!handle && !hasBrowserDirectoryPicker(input.win)) {
        handle = await pickSaveTarget(input.win, { suggestedName: input.suggestedName });
        if (handle) input.onPickedHandle(handle);
      }
    }
  }

  if (!handle && !input.forcePick && hasBrowserDirectoryPicker(input.win)) {
    return "awaiting-folder";
  }

  if (handle) {
    await writeFile(handle, input.contents);
    await input.onWritten(handle, input.contents);
    return "saved";
  }

  if (!input.win.showSaveFilePicker) {
    downloadFallback(input.markdown, input.document, input.suggestedName);
    return "saved";
  }

  return "unavailable";
}
