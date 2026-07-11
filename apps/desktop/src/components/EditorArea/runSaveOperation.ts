interface SaveOperationCallbacks {
  onFinally?: () => void
  onSuccess?: () => void
}

/**
 * Waits for the whole save operation before firing completion callbacks.
 * The operation returns true only when the file is durably saved.
 */
export async function runSaveOperation(
  operation: () => Promise<boolean>,
  callbacks: SaveOperationCallbacks,
): Promise<boolean> {
  let succeeded = false

  try {
    succeeded = await operation()
  } finally {
    if (succeeded) {
      try {
        callbacks.onSuccess?.()
      } finally {
        callbacks.onFinally?.()
      }
    } else {
      callbacks.onFinally?.()
    }
  }

  return succeeded
}
