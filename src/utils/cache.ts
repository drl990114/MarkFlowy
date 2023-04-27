import { exists, readTextFile, writeFile } from '@tauri-apps/api/fs'
import { BaseDirectory } from '@tauri-apps/api/path'

const CACHE_FILE_NAME = 'linebyline.conf.json'
class CacheManager {
  settingData: Record<string, any> = {}

  constructor() {
    exists(CACHE_FILE_NAME, { dir: BaseDirectory.AppCache }).then((res) => {
      if (!res)
        this.save()
    })
  }

  readCache = async () => {
    const cache = await readTextFile(CACHE_FILE_NAME, { dir: BaseDirectory.AppCache })
    this.settingData = JSON.parse(cache)
  }

  writeCache = (key: string, value: any) => {
    this.settingData[key] = value
    this.save()
  }

  save = () => {
    writeFile(CACHE_FILE_NAME, JSON.stringify(this.settingData), { dir: BaseDirectory.AppCache })
  }
}

const CacheManagerInstance = new CacheManager()
export default CacheManagerInstance
