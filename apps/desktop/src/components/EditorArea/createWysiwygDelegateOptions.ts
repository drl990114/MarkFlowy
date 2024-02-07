import { sleep } from "@/helper"
import { useEditorStore } from "@/stores"
import type { CreateWysiwygDelegateOptions } from "rme"
import { convertFileSrc } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { fetch } from '@tauri-apps/plugin-http'

export const createWysiwygDelegateOptions = (filePath?: string): CreateWysiwygDelegateOptions => ({
  handleViewImgSrcUrl: async (url) => {
    // Ensure asynchronous, returning directly will cause an infinite loop. about:https://github.com/drl990114/MarkFlowy/issues/340
    await sleep(1)

    if (!url) return url

    if ((url.startsWith('http') || url.startsWith('https')) && !url.includes(location.origin)) {
      try {
        const response = await fetch(url, {
          method: 'GET',
        })

        const blob = await response.blob()
        const objectURL = URL.createObjectURL(blob)

        return objectURL
      } catch (error) {
        return url
      }
    }

    const dirPath = filePath || useEditorStore.getState().folderData?.[0]?.path
    if (dirPath) {
      const newUrl = await join(dirPath, url)
      return convertFileSrc(newUrl)
    }

    return convertFileSrc(url)
  },
})
