import type { PwaDirectoryHandle, PwaFileHandle } from "./document-host";

const databaseName = "markleft-pwa";
const storeName = "recent-documents";
const recentKey = "recent:v1";
const maxRecentDocuments = 8;

export interface RecentPwaDocument {
  handle: PwaFileHandle;
  directory?: PwaDirectoryHandle;
  name: string;
  lastOpenedAt: number;
}

export async function rememberRecentDocument(
  handle: PwaFileHandle,
  directory?: PwaDirectoryHandle,
): Promise<void> {
  try {
    const current = await loadRecentDocuments();
    const next = [
      { handle, name: handle.name, lastOpenedAt: Date.now(), ...(directory ? { directory } : {}) },
      ...current.filter((item) => item.name !== handle.name),
    ].slice(0, maxRecentDocuments);
    await putRecentDocuments(next);
  } catch {
    // A browser can reject structured-cloning a file handle; opening still works.
  }
}

export async function loadRecentDocuments(): Promise<RecentPwaDocument[]> {
  try {
    const db = await openDatabase();
    if (!db) return [];
    const documents = await request<RecentPwaDocument[] | undefined>(db, "readonly", (store) =>
      store.get(recentKey) as IDBRequest<RecentPwaDocument[] | undefined>,
    );
    db.close();
    return Array.isArray(documents) ? documents : [];
  } catch {
    return [];
  }
}

async function putRecentDocuments(documents: RecentPwaDocument[]): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await request(db, "readwrite", (store) => store.put(documents, recentKey));
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
