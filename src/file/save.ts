import { serializeFile } from "./serialize";

export interface WritableFileHandle {
  name?: string;
  queryPermission?(descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  getFile?(): Promise<{
    lastModified?: number;
    text(): Promise<string>;
  }>;
  createWritable(): Promise<{
    write(value: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

export interface WritableDirectoryHandle {
  name?: string;
  queryPermission?(descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  getDirectoryHandle(name: string): Promise<WritableDirectoryHandle>;
  getFileHandle(name: string): Promise<WritableFileHandle>;
}

export interface SavePickerOptions {
  suggestedName?: string;
}

export interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options?: SavePickerOptions) => Promise<WritableFileHandle>;
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<WritableDirectoryHandle>;
}

export function suggestedFileNameFromLocation(location: Location): string {
  if (location.protocol !== "file:") return "example.md.html";

  const lastSegment = location.pathname.split("/").filter(Boolean).at(-1);
  if (!lastSegment) return "example.md.html";

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

export async function writeFile(handle: WritableFileHandle, contents: string): Promise<void> {
  console.info("[local-md:file]", "writeFile start", {
    handleName: handle.name ?? "(unnamed)",
    contentsLength: contents.length,
  });
  if (!(await ensureWritablePermission(handle))) {
    console.info("[local-md:file]", "writeFile permission denied", { handleName: handle.name ?? "(unnamed)" });
    throw new Error("Write permission was not granted.");
  }
  console.info("[local-md:file]", "writeFile permission granted", { handleName: handle.name ?? "(unnamed)" });
  const writable = await handle.createWritable();
  console.info("[local-md:file]", "writeFile writable created", { handleName: handle.name ?? "(unnamed)" });
  await writable.write(contents);
  console.info("[local-md:file]", "writeFile write resolved", { handleName: handle.name ?? "(unnamed)" });
  await writable.close();
  console.info("[local-md:file]", "writeFile close resolved", { handleName: handle.name ?? "(unnamed)" });
}

export async function canWriteWithoutPrompt(handle: WritableFileHandle): Promise<boolean> {
  if (!handle.queryPermission) return true;
  const state = await handle.queryPermission({ mode: "readwrite" });
  console.info("[local-md:file]", "canWriteWithoutPrompt", { handleName: handle.name ?? "(unnamed)", state });
  return state === "granted";
}

async function ensureWritablePermission(handle: WritableFileHandle): Promise<boolean> {
  if (await canWriteWithoutPrompt(handle)) return true;
  if (!handle.requestPermission) return false;
  const state = await handle.requestPermission({ mode: "readwrite" });
  console.info("[local-md:file]", "request write permission", { handleName: handle.name ?? "(unnamed)", state });
  return state === "granted";
}

export async function pickSaveTarget(
  win: SavePickerWindow,
  options: SavePickerOptions = {},
): Promise<WritableFileHandle | null> {
  if (!win.showSaveFilePicker) return null;
  try {
    console.info("[local-md:file]", "showSaveFilePicker start", options);
    const handle = await win.showSaveFilePicker(options);
    console.info("[local-md:file]", "showSaveFilePicker resolved", { handleName: handle.name ?? "(unnamed)" });
    return handle;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.info("[local-md:file]", "showSaveFilePicker cancelled");
      return null;
    }
    console.info("[local-md:file]", "showSaveFilePicker failed", {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    throw error;
  }
}

export async function pickDirectoryTarget(win: SavePickerWindow): Promise<WritableDirectoryHandle | null> {
  if (!win.showDirectoryPicker) return null;
  try {
    console.info("[local-md:file]", "showDirectoryPicker start");
    const handle = await win.showDirectoryPicker({ mode: "readwrite" });
    console.info("[local-md:file]", "showDirectoryPicker resolved", { folderName: handle.name ?? "(unnamed)" });
    return handle;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.info("[local-md:file]", "showDirectoryPicker cancelled");
      return null;
    }
    console.info("[local-md:file]", "showDirectoryPicker failed", {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    throw error;
  }
}

export function downloadFallback(
  markdown: string,
  doc: Document,
  suggestedName = suggestedFileNameFromLocation(doc.location),
): void {
  const blob = new Blob([serializeFile(markdown)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
}
