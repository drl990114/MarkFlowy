import { EVENT } from '@/constants'
import { CacheManager } from '@/helper'
import { listen } from '@tauri-apps/api/event'
import { createGlobalStore } from 'hox'
import { useEffect, useState } from 'react'

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
