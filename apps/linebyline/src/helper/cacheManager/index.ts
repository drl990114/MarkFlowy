import { emit } from '@tauri-apps/api/event'
import { exists, readTextFile, writeFile } from '@tauri-apps/api/fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import defaultCache from './default.cache'
import { EVENT } from '@/constants'

const CACHE_FILE_NAME = 'linebyline.cache.json'

class CacheManager {
  cacheData: Record<string, any> = defaultCache

  init = async () => {
    await Promise.all([this.readCache()])
  }

  readData: (opt: ReadDataParams) => Record<string, any> = async ({
    fileName,
    dataKey,
    onSuccess,
    onSaved,
  }) => {
    const isExists = await exists(fileName, { dir: BaseDirectory.AppCache })

    if (!isExists) {
      await this.writeData({
        fileName,
        data: this[dataKey],
        onSuccess: onSaved,
      })
      return this[dataKey]
    }

    const data = await readTextFile(fileName, { dir: BaseDirectory.AppCache })
    this[dataKey] = JSON.parse(data)

    if (onSuccess)
      onSuccess(this[dataKey])

    return data
  }

  writeData: (opt: SaveDataParams) => Record<string, any> = async ({
    fileName,
    data,
    onSuccess,
  }) => {
    writeFile(fileName, JSON.stringify(data), {
      dir: BaseDirectory.AppCache,
    }).then(() => {
      if (onSuccess)
        onSuccess(data)
    })
  }

  readCache = async () => {
    const cache = await this.readData({
      fileName: CACHE_FILE_NAME,
      dataKey: 'cacheData',
      onSuccess: (data) => {
        emit(EVENT.cache_data_change, data)
      },
    })

    return cache
  }

  writeCache = (key: string, value: any) => {
    if (key === 'openFolderHistory') {
      if (this.cacheData.openFolderHistory.length > 10)
        this.cacheData.openFolderHistory.pop()

      const index = this.cacheData.openFolderHistory.findIndex(
        (his: { path: string }) => his.path === value.path,
      )
      if (index >= 0)
        this.cacheData.openFolderHistory.splice(index, 1)

      this.cacheData.openFolderHistory.unshift(value)
    }
    else {
      this.cacheData[key] = value
    }
    this.saveCache()
  }

  saveCache = () => {
    this.writeData({
      fileName: CACHE_FILE_NAME,
      data: this.cacheData,
      onSuccess: (data) => {
        emit(EVENT.cache_data_change, data)
      },
    })
  }
}

interface ModDataParams {
  fileName: typeof CACHE_FILE_NAME
  onSuccess?: (data: Record<string, any>) => void
}

interface ReadDataParams extends ModDataParams {
  dataKey: 'cacheData'
  onSaved?: () => void // if file not exist, it was triggered
}

interface SaveDataParams extends ModDataParams {
  data: Record<string, any>
}

const CacheManagerInstance = new CacheManager()
export default CacheManagerInstance
