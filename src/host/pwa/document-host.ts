import type { MarkleftDocumentHost, MarkleftDocumentSnapshot } from "../document-host";
import { BrowserFileWatch } from "../browser/file-watch";

export interface PwaFile {
  lastModified: number;
  size: number;
  text(): Promise<string>;
}

export interface PwaFileHandle {
  name: string;
  getFile(): Promise<PwaFile>;
  queryPermission?(descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<{
    write(value: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

export interface PwaDirectoryHandle {
  name: string;
  getDirectoryHandle(name: string): Promise<PwaDirectoryHandle>;
  getFileHandle(name: string): Promise<PwaFileHandle>;
}

export class PwaDocumentConflictError extends Error {
  constructor() {
    super("The Markdown file changed on disk before Markleft could save it.");
    this.name = "PwaDocumentConflictError";
  }
}

/**
 * Chrome File System Access adapter for the host-neutral Markleft editor.
 *
 * It deliberately has no browser-picker knowledge: the PWA shell owns the
 * user gesture that chooses a file, and this class owns its safe read/write
 * lifecycle once chosen.
 */
export class PwaDocumentHost implements MarkleftDocumentHost {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities = {
    canWatch: true,
    canResolveAssets: true,
    canInvokeAgent: false,
  };

  private lastKnownRevision: string | undefined;
  private fileWatch: BrowserFileWatch | null = null;
  private assetUrls = new Map<string, string>();

  constructor(
    private readonly handle: PwaFileHandle,
    private readonly directory?: PwaDirectoryHandle,
  ) {
    this.id = `pwa-file:${handle.name}`;
    this.displayName = handle.name;
  }

  async read(): Promise<MarkleftDocumentSnapshot> {
    const snapshot = await snapshotForHandle(this.handle);
    this.lastKnownRevision = snapshot.revision;
    return snapshot;
  }

  async write(markdown: string, options: { expectedRevision?: string } = {}): Promise<MarkleftDocumentSnapshot> {
    const current = await snapshotForHandle(this.handle);
    const expectedRevision = options.expectedRevision ?? this.lastKnownRevision;
    if (expectedRevision && current.revision !== expectedRevision) {
      throw new PwaDocumentConflictError();
    }

    await ensureWritePermission(this.handle);
    const writable = await this.handle.createWritable();
    await writable.write(markdown);
    await writable.close();

    const saved = await snapshotForHandle(this.handle);
    this.lastKnownRevision = saved.revision;
    return saved;
  }

  watch(listener: (snapshot: MarkleftDocumentSnapshot) => void): () => void {
    this.fileWatch?.stop();
    const watch = new BrowserFileWatch(
      window,
      () => {
        void snapshotForHandle(this.handle)
          .then(listener)
          .catch(() => undefined);
      },
      3000,
    );
    this.fileWatch = watch;
    void watch.start(this.handle);
    return () => {
      if (this.fileWatch !== watch) return;
      watch.stop();
      this.fileWatch = null;
    };
  }

  async resolveAsset(relativePath: string): Promise<string | null> {
    if (!this.directory) return null;
    const normalized = normalizeRelativeAssetPath(relativePath);
    if (!normalized) return null;
    const remembered = this.assetUrls.get(normalized);
    if (remembered) return remembered;

    try {
      const segments = normalized.split("/");
      const fileName = segments.pop();
      if (!fileName) return null;
      let folder = this.directory;
      for (const segment of segments) folder = await folder.getDirectoryHandle(segment);
      const file = await (await folder.getFileHandle(fileName)).getFile();
      const url = URL.createObjectURL(file as unknown as Blob);
      this.assetUrls.set(normalized, url);
      return url;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.fileWatch?.stop();
    this.fileWatch = null;
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url);
    this.assetUrls.clear();
  }
}

export async function snapshotForHandle(handle: PwaFileHandle): Promise<MarkleftDocumentSnapshot> {
  const file = await handle.getFile();
  const markdown = await file.text();
  return {
    markdown,
    revision: revisionFor(markdown, file.lastModified, file.size),
  };
}

export function revisionFor(markdown: string, lastModified: number, size: number): string {
  let hash = 5381;
  for (let index = 0; index < markdown.length; index += 1) {
    hash = (hash * 33) ^ markdown.charCodeAt(index);
  }
  return `${lastModified}:${size}:${(hash >>> 0).toString(36)}`;
}

export function normalizeRelativeAssetPath(value: string): string | null {
  const path = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return segments.join("/");
}

async function ensureWritePermission(handle: PwaFileHandle): Promise<void> {
  const descriptor = { mode: "readwrite" as const };
  const current = await handle.queryPermission?.(descriptor);
  if (current === "granted" || !handle.requestPermission) return;
  const requested = await handle.requestPermission(descriptor);
  if (requested !== "granted") throw new Error("Write permission was not granted.");
}
