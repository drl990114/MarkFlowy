import { useEffect, useMemo, useState } from 'react'
import type { createWysiwygDelegate, createSourceCodeDelegate } from 'rme'

// 全局缓存RME模块，避免重复加载
let rmeModuleCache: any = null
let rmeModulePromise: Promise<any> | null = null
// RME模块接口定义
export interface RmeModule {
  ThemeProvider: any
  Editor: any
  WysiwygThemeWrapper: any
  EditorViewType: {
    WYSIWYG: string
    SOURCE_CODE: string
  }
  createWysiwygDelegate: typeof createWysiwygDelegate
  createSourceCodeDelegate: typeof createSourceCodeDelegate
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
  rmeModulePromise = import('rme')
    .then((mod) => {
      rmeModuleCache = mod
      return mod
    })
    .catch((err) => {
      rmeModulePromise = null
      throw err
    })

  return rmeModulePromise
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
  return useMemo(
    () => ({
      ThemeProvider: rmeModule?.ThemeProvider,
      loading,
      error,
      reload: () => loadRmeModule(),
    }),
    [rmeModule?.ThemeProvider, loading, error],
  )
}

// Hook: 获取RME Editor相关功能
export const useRmeEditor = () => {
  const { rmeModule, loading, error } = useRme()
  return useMemo(
    () => ({
      Editor: rmeModule?.Editor,
      EditorViewType: rmeModule?.EditorViewType,
      createWysiwygDelegate: rmeModule?.createWysiwygDelegate,
      createSourceCodeDelegate: rmeModule?.createSourceCodeDelegate,
      loading,
      error,
    }),
    [
      rmeModule?.Editor,
      rmeModule?.EditorViewType,
      rmeModule?.createWysiwygDelegate,
      rmeModule?.createSourceCodeDelegate,
      loading,
      error,
    ],
  )
}

// Hook: 获取RME WysiwygThemeWrapper
export const useRmeWrapper = () => {
  const { rmeModule, loading, error } = useRme()
  return useMemo(
    () => ({
      WysiwygThemeWrapper: rmeModule?.WysiwygThemeWrapper,
      loading,
      error,
    }),
    [rmeModule?.WysiwygThemeWrapper, loading, error],
  )
}
