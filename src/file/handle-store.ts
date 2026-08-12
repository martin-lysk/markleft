import { suggestedFileNameFromLocation, type WritableDirectoryHandle, type WritableFileHandle } from "./save";

const dbName = "local-md";
const storeName = "file-handles";
const dbVersion = 1;
const directoryHandlesKey = "directory-handles:v1";
const maxDirectoryHandles = 12;

export function handleStorageKey(location: Location): string {
  return location.protocol === "file:"
    ? `file:${location.pathname}`
    : `name:${suggestedFileNameFromLocation(location)}`;
}

export async function rememberFileHandle(
  win: Window,
  key: string,
  handle: WritableFileHandle,
): Promise<void> {
  try {
    const db = await openHandleDatabase(win);
    if (!db) return;
    await requestFromTransaction(db, "readwrite", (store) => store.put(handle, key));
    db.close();
  } catch {
    // Some browsers and test doubles cannot structured-clone file handles.
  }
}

export async function restoreFileHandle(
  win: Window,
  key: string,
): Promise<WritableFileHandle | null> {
  const db = await openHandleDatabase(win);
  if (!db) return null;
  const handle = await requestFromTransaction<WritableFileHandle | undefined>(
    db,
    "readonly",
    (store) => store.get(key) as IDBRequest<WritableFileHandle | undefined>,
  );
  db.close();
  return handle ?? null;
}

export async function rememberDirectoryHandle(win: Window, handle: WritableDirectoryHandle): Promise<void> {
  try {
    const handles = await restoreDirectoryHandles(win);
    const next = [handle, ...handles.filter((stored) => stored.name !== handle.name)].slice(0, maxDirectoryHandles);
    const db = await openHandleDatabase(win);
    if (!db) return;
    await requestFromTransaction(db, "readwrite", (store) => store.put(next, directoryHandlesKey));
    db.close();
  } catch {
    // Some browsers and test doubles cannot structured-clone directory handles.
  }
}

export async function restoreDirectoryHandles(win: Window): Promise<WritableDirectoryHandle[]> {
  try {
    const db = await openHandleDatabase(win);
    if (!db) return [];
    const handles = await requestFromTransaction<WritableDirectoryHandle[] | undefined>(
      db,
      "readonly",
      (store) => store.get(directoryHandlesKey) as IDBRequest<WritableDirectoryHandle[] | undefined>,
    );
    db.close();
    return Array.isArray(handles) ? handles : [];
  } catch {
    return [];
  }
}

async function openHandleDatabase(win: Window): Promise<IDBDatabase | null> {
  if (!("indexedDB" in win)) return null;

  return await new Promise((resolve) => {
    const request = win.indexedDB.open(dbName, dbVersion);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => resolve(null));
    request.addEventListener("blocked", () => resolve(null));
  });
}

async function requestFromTransaction<T = unknown>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return await new Promise((resolve) => {
    const transaction = db.transaction(storeName, mode);
    let request: IDBRequest<T>;
    try {
      request = action(transaction.objectStore(storeName));
    } catch {
      resolve(undefined);
      return;
    }

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => resolve(undefined));
    transaction.addEventListener("abort", () => resolve(undefined));
  });
}
