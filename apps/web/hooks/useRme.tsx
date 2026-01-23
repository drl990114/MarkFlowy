import { useEffect, useMemo, useState } from 'react'

// 全局缓存RME模块，避免重复加载
let rmeModuleCache: any = null
let rmeModulePromise: Promise<any> | null = null
let isPreloading = false
let preloadError: Error | null = null

export const preloadRme = (): Promise<void | RmeModule> => {
  // 如果已经加载完成，立即返回
  if (rmeModuleCache) {
    return Promise.resolve()
  }
  
  // 如果正在预加载，返回现有Promise
  if (rmeModulePromise) {
    return rmeModulePromise.then(() => {})
  }
  
  // 开始新的预加载
  isPreloading = true
  
  return Promise.resolve().then(() => {
    return loadRmeModule().catch(err => {
      preloadError = err
      console.warn('RME preloading failed, will try again when needed:', err)
    }).finally(() => {
      isPreloading = false
    })
  })
}

// RME模块接口定义
export interface RmeModule {
  ThemeProvider: any
  Editor: any
  WysiwygThemeWrapper: any
  EditorViewType: {
    WYSIWYG: string
    SOURCE_CODE: string
  }
  createWysiwygDelegate: typeof import('rme').createWysiwygDelegate
  createSourceCodeDelegate: typeof import('rme').createSourceCodeDelegate
}

// 统一的RME模块加载器
export const loadRmeModule = async (): Promise<RmeModule> => {
  // 如果已经缓存，直接返回
  if (rmeModuleCache) {
    return rmeModuleCache
  }

  // 如果正在加载，等待完成
  if (rmeModulePromise) {
    return rmeModulePromise
  }

  // 开始加载模块
  rmeModulePromise = import('rme').then((mod) => {
    rmeModuleCache = mod
    return mod
  })

  return rmeModulePromise
}

// 预加载RME模块（在浏览器环境）
if (typeof window !== 'undefined') {
  // 使用requestIdleCallback或setTimeout实现低优先级预加载
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      preloadRme()
    }, { timeout: 2000 })
  } else {
    // 降级方案
    setTimeout(() => {
      preloadRme()
    }, 0)
  }
}

// Hook: 获取RME模块
export const useRme = () => {
  const [rmeModule, setRmeModule] = useState<RmeModule | null>(rmeModuleCache)
  const [loading, setLoading] = useState(!rmeModuleCache)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // 已缓存，直接使用
    if (rmeModuleCache) {
      setRmeModule(rmeModuleCache)
      setLoading(false)
      setError(null)
      return
    }

    // 已有预加载错误，优先尝试再次加载
    if (preloadError) {
      setError(null)
      setLoading(true)
      preloadError = null
    }

    // 重新加载模块
    loadRmeModule()
      .then((mod) => {
        setRmeModule(mod)
        setLoading(false)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to load RME module:', err)
        setError(err)
        setLoading(false)
      })
  }, [])

  return useMemo(() => ({ rmeModule, loading, error }), [rmeModule, loading, error])
}

// Hook: 获取RME ThemeProvider
export const useRmeThemeProvider = () => {
  const { rmeModule, loading, error } = useRme()
  return useMemo(() => ({
    ThemeProvider: rmeModule?.ThemeProvider,
    loading,
    error,
    reload: () => loadRmeModule()
  }), [rmeModule?.ThemeProvider, loading, error])
}

// Hook: 获取RME Editor相关功能
export const useRmeEditor = () => {
  const { rmeModule, loading, error } = useRme()
  return useMemo(() => ({
    Editor: rmeModule?.Editor,
    EditorViewType: rmeModule?.EditorViewType,
    createWysiwygDelegate: rmeModule?.createWysiwygDelegate,
    createSourceCodeDelegate: rmeModule?.createSourceCodeDelegate,
    loading,
    error,
  }), [rmeModule?.Editor, rmeModule?.EditorViewType, rmeModule?.createWysiwygDelegate, rmeModule?.createSourceCodeDelegate, loading, error])
}

// Hook: 获取RME WysiwygThemeWrapper
export const useRmeWrapper = () => {
  const { rmeModule, loading, error } = useRme()
  return useMemo(() => ({
    WysiwygThemeWrapper: rmeModule?.WysiwygThemeWrapper,
    loading,
    error,
  }), [rmeModule?.WysiwygThemeWrapper, loading, error])
}
