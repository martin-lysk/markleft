import type { PwaDirectoryHandle, PwaFileHandle } from "./document-host";

const databaseName = "markleft-pwa-projects";
const storeName = "project-roots";
const rootsKey = "roots:v1";
const maxRoots = 12;
const maxEntriesPerScan = 5000;

export interface PwaProjectLocation {
  root: PwaDirectoryHandle;
  /** The Markdown file path relative to `root`, including the filename. */
  documentPath: string[];
  lastVerifiedAt: number;
}

interface StoredProjectRoot {
  root: PwaDirectoryHandle;
  locations: Array<{
    handle: PwaFileHandle;
    documentPath: string[];
    lastVerifiedAt: number;
  }>;
}

/**
 * Finds the widest previously granted directory that provably contains an
 * opened Markdown handle. Stored paths are only a fast hint: every result is
 * verified with `isSameEntry` before it is used.
 */
export async function restoreProjectLocation(handle: PwaFileHandle): Promise<PwaProjectLocation | null> {
  const roots = await loadProjectRoots();
  const matches: PwaProjectLocation[] = [];

  for (const stored of roots) {
    if (!(await hasReadPermission(stored.root))) continue;
    const indexedLocation = await findIndexedLocation(stored.locations, handle);
    const indexedMatch = indexedLocation
      ? await resolveIndexedLocation(stored.root, indexedLocation.documentPath, handle)
      : null;
    // A saved path may be stale after a move or rename. The already-granted
    // folder remains useful, so fall back to an identity-verified rescan.
    const match = indexedMatch ?? (await findDocumentInRoot(stored.root, handle));
    if (!match) continue;
    matches.push({ root: stored.root, documentPath: match, lastVerifiedAt: Date.now() });
  }

  const widest = chooseWidestProjectLocation(matches);
  if (widest) await rememberProjectLocation(handle, widest);
  return widest;
}

/** Verify and persist a newly selected folder that contains the open document. */
export async function verifyProjectLocation(
  handle: PwaFileHandle,
  root: PwaDirectoryHandle,
): Promise<PwaProjectLocation | null> {
  if (!(await hasReadPermission(root, true))) return null;
  const documentPath = await findDocumentInRoot(root, handle);
  if (!documentPath) return null;
  const location = { root, documentPath, lastVerifiedAt: Date.now() };
  await rememberProjectLocation(handle, location);
  return location;
}

export async function rememberProjectLocation(
  handle: PwaFileHandle,
  location: PwaProjectLocation,
): Promise<void> {
  try {
    const roots = await loadProjectRoots();
    let stored = await findRoot(roots, location.root);
    if (!stored) {
      stored = { root: location.root, locations: [] };
      roots.unshift(stored);
    }
    const nextLocations = [];
    for (const existing of stored.locations) {
      if (await sameEntry(existing.handle, handle)) continue;
      nextLocations.push(existing);
    }
    stored.locations = [
      { handle, documentPath: location.documentPath, lastVerifiedAt: location.lastVerifiedAt },
      ...nextLocations,
    ].slice(0, 32);
    const ordered = [stored, ...roots.filter((candidate) => candidate !== stored)].slice(0, maxRoots);
    await saveProjectRoots(ordered);
  } catch {
    // Handle persistence is optional; the selected folder remains usable now.
  }
}

/** Resolve a Markdown image path inside a verified project root. */
export function resolveProjectRelativePath(documentPath: readonly string[], value: string): string[] | null {
  const rawPath = value.split(/[?#]/, 1)[0]?.replace(/\\/g, "/") ?? "";
  if (!rawPath || rawPath.startsWith("/") || rawPath.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(rawPath)) {
    return null;
  }

  const resolved = [...documentPath.slice(0, -1)];
  for (const segment of rawPath.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (resolved.length === 0) return null;
      resolved.pop();
      continue;
    }
    try {
      const decoded = decodeURIComponent(segment);
      if (!decoded || decoded === "." || decoded === ".." || decoded.includes("/")) return null;
      resolved.push(decoded);
    } catch {
      return null;
    }
  }
  return resolved.length > 0 ? resolved : null;
}

export function assetUrlSuffix(value: string): string {
  // A fragment identifies a location inside an SVG and remains meaningful on a
  // blob URL. Query strings are transport/cache semantics and do not apply to
  // a file read from the local project tree.
  return value.match(/#.*$/)?.[0] ?? "";
}

export async function findDocumentInRoot(
  root: PwaDirectoryHandle,
  target: PwaFileHandle,
  limit = maxEntriesPerScan,
): Promise<string[] | null> {
  const queue: Array<{ directory: PwaDirectoryHandle; path: string[] }> = [{ directory: root, path: [] }];
  let seen = 0;

  while (queue.length > 0 && seen < limit) {
    const current = queue.shift();
    if (!current) break;
    for await (const entry of directoryEntries(current.directory)) {
      seen += 1;
      if (seen > limit) return null;
      if (entry.kind === "directory") {
        queue.push({ directory: entry as PwaDirectoryHandle, path: [...current.path, entry.name] });
        continue;
      }
      if (entry.kind !== "file" || entry.name !== target.name) continue;
      try {
        const candidate = await current.directory.getFileHandle(entry.name);
        if (await sameEntry(candidate, target)) return [...current.path, entry.name];
      } catch {
        // The entry disappeared or its permission changed while scanning.
      }
    }
  }
  return null;
}

export function chooseWidestProjectLocation(locations: readonly PwaProjectLocation[]): PwaProjectLocation | null {
  return [...locations].sort(
    (left, right) =>
      right.documentPath.length - left.documentPath.length || right.lastVerifiedAt - left.lastVerifiedAt,
  )[0] ?? null;
}

async function findIndexedLocation(
  locations: StoredProjectRoot["locations"],
  handle: PwaFileHandle,
): Promise<StoredProjectRoot["locations"][number] | null> {
  for (const location of locations) {
    if (await sameEntry(location.handle, handle)) return location;
  }
  return null;
}

async function resolveIndexedLocation(
  root: PwaDirectoryHandle,
  documentPath: readonly string[],
  target: PwaFileHandle,
): Promise<string[] | null> {
  const candidate = await fileAtPath(root, documentPath);
  return candidate && (await sameEntry(candidate, target)) ? [...documentPath] : null;
}

async function fileAtPath(root: PwaDirectoryHandle, path: readonly string[]): Promise<PwaFileHandle | null> {
  try {
    let directory = root;
    for (const segment of path.slice(0, -1)) directory = await directory.getDirectoryHandle(segment);
    const fileName = path.at(-1);
    return fileName ? await directory.getFileHandle(fileName) : null;
  } catch {
    return null;
  }
}

async function findRoot(roots: StoredProjectRoot[], root: PwaDirectoryHandle): Promise<StoredProjectRoot | null> {
  for (const candidate of roots) {
    if (await sameEntry(candidate.root, root)) return candidate;
  }
  return null;
}

async function hasReadPermission(root: PwaDirectoryHandle, request = false): Promise<boolean> {
  try {
    const permission = await root.queryPermission?.({ mode: "read" });
    if (permission === "granted" || !root.queryPermission) return true;
    return request && root.requestPermission
      ? (await root.requestPermission({ mode: "read" })) === "granted"
      : false;
  } catch {
    return false;
  }
}

async function sameEntry(left: { isSameEntry?: (other: unknown) => Promise<boolean> }, right: unknown): Promise<boolean> {
  try {
    return (await left.isSameEntry?.(right)) ?? false;
  } catch {
    return false;
  }
}

async function* directoryEntries(directory: PwaDirectoryHandle): AsyncIterable<PwaDirectoryHandle | PwaFileHandle> {
  const iterable = directory as PwaDirectoryHandle & { values?: () => AsyncIterable<PwaDirectoryHandle | PwaFileHandle> };
  if (!iterable.values) return;
  yield* iterable.values();
}

async function loadProjectRoots(): Promise<StoredProjectRoot[]> {
  try {
    const db = await openDatabase();
    if (!db) return [];
    const roots = await request<StoredProjectRoot[] | undefined>(db, "readonly", (store) =>
      store.get(rootsKey) as IDBRequest<StoredProjectRoot[] | undefined>,
    );
    db.close();
    return Array.isArray(roots) ? roots : [];
  } catch {
    return [];
  }
}

async function saveProjectRoots(roots: StoredProjectRoot[]): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await request(db, "readwrite", (store) => store.put(roots, rootsKey));
  db.close();
}

async function openDatabase(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return null;
  return await new Promise((resolve) => {
    const open = window.indexedDB.open(databaseName, 1);
    open.addEventListener("upgradeneeded", () => {
      if (!open.result.objectStoreNames.contains(storeName)) open.result.createObjectStore(storeName);
    });
    open.addEventListener("success", () => resolve(open.result));
    open.addEventListener("error", () => resolve(null));
    open.addEventListener("blocked", () => resolve(null));
  });
}

async function request<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return await new Promise((resolve) => {
    const transaction = db.transaction(storeName, mode);
    const result = action(transaction.objectStore(storeName));
    result.addEventListener("success", () => resolve(result.result));
    result.addEventListener("error", () => resolve(undefined));
    transaction.addEventListener("abort", () => resolve(undefined));
  });
}
