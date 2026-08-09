const DATABASE_NAME = 'markflowy-demo-workspace'
const DATABASE_VERSION = 1
const FILE_STORE_NAME = 'files'

interface DemoWorkspaceFileRecord {
  id: string
  content: string
  version: string
}

const createStorageError = (message: string, cause?: DOMException | null) =>
  new Error(cause?.message || message)

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let settled = false

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(FILE_STORE_NAME)) {
        database.createObjectStore(FILE_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onerror = () => {
      settled = true
      reject(createStorageError('Failed to open the demo workspace database.', request.error))
    }
    request.onblocked = () => {
      settled = true
      reject(new Error('The demo workspace database is blocked by another browser tab.'))
    }
    request.onsuccess = () => {
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      resolve(request.result)
    }
  })

export async function loadDemoWorkspaceFile(
  fileId: string,
): Promise<DemoWorkspaceFileRecord | null> {
  const database = await openDatabase()

  try {
    const request = database
      .transaction(FILE_STORE_NAME, 'readonly')
      .objectStore(FILE_STORE_NAME)
      .get(fileId)

    return await new Promise<DemoWorkspaceFileRecord | null>((resolve, reject) => {
      request.onerror = () => {
        reject(createStorageError('Failed to read the demo workspace file.', request.error))
      }
      request.onsuccess = () => {
        resolve((request.result as DemoWorkspaceFileRecord | undefined) ?? null)
      }
    })
  } finally {
    database.close()
  }
}

export async function saveDemoWorkspaceFile(fileId: string, content: string): Promise<string> {
  const database = await openDatabase()
  const version = String(Date.now())

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(FILE_STORE_NAME, 'readwrite')

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => {
        reject(createStorageError('Failed to save the demo workspace file.', transaction.error))
      }
      transaction.onabort = () => {
        reject(createStorageError('Saving the demo workspace file was aborted.', transaction.error))
      }

      transaction.objectStore(FILE_STORE_NAME).put({ id: fileId, content, version })
    })
  } finally {
    database.close()
  }

  return version
}
