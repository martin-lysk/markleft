import type { PwaFileHandle } from "./document-host";

interface DroppedFileSystemHandle {
  kind: "file" | "directory";
  name: string;
}

interface DroppedItem {
  kind: string;
  getAsFileSystemHandle?(): Promise<DroppedFileSystemHandle | null>;
}

export function isMarkdownFileName(name: string): boolean {
  return /\.(?:md|markdown|mdx)$/i.test(name);
}

/** Return the first Markdown file handle from a Chrome drag-and-drop payload. */
export async function firstDroppedMarkdownHandle(
  items: Iterable<DroppedItem>,
): Promise<PwaFileHandle | null> {
  for (const item of items) {
    if (item.kind !== "file" || !item.getAsFileSystemHandle) continue;
    const handle = await item.getAsFileSystemHandle();
    if (handle?.kind === "file" && isMarkdownFileName(handle.name)) {
      return handle as unknown as PwaFileHandle;
    }
  }
  return null;
}
