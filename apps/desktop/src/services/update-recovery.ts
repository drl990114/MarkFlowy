import { FileResultCode, type FileSysResult } from '@markflowy/interface'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { LazyStore } from '@tauri-apps/plugin-store'
import type { Update } from '@tauri-apps/plugin-updater'

export interface UpdateAttempt {
  fromVersion: string
  targetVersion: string
  startedAt: number
}

const STORE_PATH = '.markflowy_updater.dat'
const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: false })
const ATTEMPT_KEY = 'pending_install'

export const recordUpdateAttempt = async (update: Pick<Update, 'currentVersion' | 'version'>) => {
  const attempt: UpdateAttempt = {
    fromVersion: update.currentVersion,
    targetVersion: update.version,
    startedAt: Date.now(),
  }
  await store.set(ATTEMPT_KEY, attempt)
  // Windows exits inside install(), so this must reach disk before handing off.
  await store.save()
}

export const clearUpdateAttempt = async () => {
  const previous = await store.get<unknown>(ATTEMPT_KEY)
  await store.delete(ATTEMPT_KEY)
  try {
    await store.save()
  } catch (error) {
    // Store mutations update native memory even when saving to disk fails.
    if (previous !== undefined) await store.set(ATTEMPT_KEY, previous)
    throw error
  }
}

export const getInterruptedUpdate = async (): Promise<UpdateAttempt | null> => {
  try {
    // Initial Store loading swallows IO/JSON errors; reload surfaces them.
    // Keep the default merge behavior to retain markers from failed saves.
    await store.reload()
  } catch (error) {
    const filePath = await join(await appDataDir(), STORE_PATH)
    const result = await invoke<FileSysResult>('get_file_content', { filePath })
    // Only a genuinely missing file is safe. exists() also hides IO errors.
    if (result.code !== FileResultCode.NotFound) throw error
  }
  const attempt = await store.get<unknown>(ATTEMPT_KEY)
  if (attempt === undefined) return null
  if (
    !attempt ||
    typeof attempt !== 'object' ||
    !('fromVersion' in attempt) ||
    typeof attempt.fromVersion !== 'string' ||
    !attempt.fromVersion ||
    !('targetVersion' in attempt) ||
    typeof attempt.targetVersion !== 'string' ||
    !attempt.targetVersion ||
    !('startedAt' in attempt) ||
    typeof attempt.startedAt !== 'number' ||
    !Number.isFinite(attempt.startedAt)
  ) {
    // An unreadable recovery record must not permit another automatic install.
    throw new Error('Invalid update recovery record')
  }

  const currentVersion = await getVersion()
  if (currentVersion !== attempt.fromVersion) {
    // The update completed, or a manual installation superseded this attempt.
    await clearUpdateAttempt()
    return null
  }
  return attempt as UpdateAttempt
}
