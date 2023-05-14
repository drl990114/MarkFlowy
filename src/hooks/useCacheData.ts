import { EVENT } from '@constants'
import { listen } from '@tauri-apps/api/event'
import { CacheManager } from '@utils'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'
import { CacheData } from '../utils/cacheManager/default.cache'

const useCacheData = () => {
  const [cache, setCache] = useState(CacheManager.cacheData)

  useEffect(() => {
    const handleCacheDataChange = ({ payload }: any) => {
      setCache({ ...payload })
    }

    listen(EVENT.cache_data_change, handleCacheDataChange)
  }, [])

  return [cache]
}

const [useGlobalCacheData] = createGlobalStore(useCacheData)
export default useGlobalCacheData
