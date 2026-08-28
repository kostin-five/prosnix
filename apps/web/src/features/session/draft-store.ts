export interface SessionDraft {
  operationId: string;
  method: "POST" | "PUT";
  path: string;
  body: unknown;
  expectedVersion?: number;
  createdAt: string;
}

const DATABASE = "adaptive-wake-coach";
const STORE = "session-drafts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "operationId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть локальное хранилище"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Ошибка локального черновика"));
    });
  } finally {
    database.close();
  }
}

export async function saveSessionDraft(draft: SessionDraft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft));
}

export async function removeSessionDraft(operationId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(operationId));
}

export async function listSessionDrafts(): Promise<SessionDraft[]> {
  return withStore("readonly", (store) => store.getAll());
}
