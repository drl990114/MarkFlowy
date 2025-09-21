import { useEditorStore } from '@/stores'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { fetch } from '@tauri-apps/plugin-http'

const convertHttpToBase64 = async (url: string): Promise<string> => {
  try {
    // Method 1: Try direct fetch first (works for same-origin or CORS-enabled images)
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
    })

    if (response.ok) {
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result)
          } else {
            reject(new Error('Failed to convert to base64'))
          }
        }
        reader.onerror = () => reject(new Error('FileReader error'))
        reader.readAsDataURL(blob)
      })

      console.log('Converted to base64 via fetch')
      return base64
    }
  } catch (fetchError) {
    console.log('Direct fetch failed, trying canvas method:', fetchError)
  }

  return url
}

export const convertImageToBase64 = async (src: string): Promise<string> => {
  // If already base64, return as is
  if (src.startsWith('data:')) {
    return src
  }

  try {
    if (src.startsWith('http') || src.startsWith('https')) {
      const base64 = await convertHttpToBase64(src)
      return base64
    }
  } catch (error) {
    return src
  }

  try {
    const fileSrc = await getImageUrlInTauri(src)
    const base64 = await new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          ctx.drawImage(img, 0, 0)

          // Convert to base64
          const dataURL = canvas.toDataURL('image/png')
          resolve(dataURL)
        } catch (canvasError) {
          reject(canvasError)
        }
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = fileSrc
    })

    console.log('Converted to base64 via canvas')
    return base64
  } catch (canvasError) {
    console.error('Canvas method failed:', canvasError)
  }

  console.log('All conversion methods failed, returning original src')
  return src
}

export const moveImageToFolder = async (
  imageSrc: string,
  targetFolderPath: string,
): Promise<string> => {
  console.log('moveImageToFolder', imageSrc, targetFolderPath)
  if (!targetFolderPath) {
    return imageSrc
  }

  if (imageSrc.startsWith('data:')) {
    // It's a base64 image, save it to the target folder
    const base64Data = imageSrc.split(',')[1]
    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))

    // Generate a unique filename
    const fileName = `image_${Date.now()}.png`
    const filePath = `${targetFolderPath}/${fileName}`
    console.log('Saving base64 image to:', filePath)
    await invoke('write_u8_array_to_file', { filePath, content: buffer })
    return filePath
  } else if (imageSrc.startsWith('http') || imageSrc.startsWith('https')) {
    // It's a URL, download and save it to the target folder
    try {
      const response = await fetch(imageSrc, { method: 'GET', mode: 'cors' })
      if (!response.ok) throw new Error('Network response was not ok')

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      const fileName = `image_${Date.now()}.png`
      const filePath = await join(targetFolderPath, fileName)
      console.log('Downloading image to:', buffer)
      await invoke('write_u8_array_to_file', { filePath, content: buffer })
      return filePath
    } catch (error) {
      console.error('Failed to download image:', error)
      throw error
    }
  } else {
    // 先判断是不是在目标文件夹中的文件
    const rootPath = useEditorStore.getState().folderData?.[0]?.path || ''
    const { src: localPath } = await getImageInfo(imageSrc, rootPath)
    console.log('Local image path:', localPath)

    // 判断这个localPath是不是在targetFolderPath里面
    if (localPath.startsWith(targetFolderPath)) {
      console.log('Image is already in the target folder:', localPath)
      return localPath
    }

    const targetPath = await join(
      targetFolderPath,
      `image_${Date.now()}.${localPath.split('.').pop()}`,
    )

    console.log('targetPath', targetPath)

    try {
      const res = await invoke('copy_file', { from: localPath, to: targetPath })
      if (res) {
        console.log('Image copied to:', targetPath)
        return targetPath
      }
    } catch (error) {
      console.error('Failed to copy image file:', error)
    }
    return targetPath
  }
}

export const URL_REG =
  /^http(s)?:\/\/([a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:[0-9]{1,5})?\/[\S]+/i

/**
 * Return image information and correct the relative image path if needed.
 *
 * @param {string} src Image url
 * @param {string} baseUrl Base path; used on desktop to fix the relative image path.
 */
export const getImageInfo = async (src: string, baseUrl: string) => {
  const EXT_REG = /\.(jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i
  // data:[<MIME-type>][;charset=<encoding>][;base64],<data>
  const DATA_URL_REG = /^data:image\/[\w+-]+(;[\w-]+=[\w-]+|;base64)*,[a-zA-Z0-9+/]+={0,2}$/

  const imageExtension = EXT_REG.test(src)
  const isUrl = URL_REG.test(src)

  // Treat an URL with valid extension as image
  if (imageExtension) {
    const isAbsoluteLocal = /^(?:\/|\\\\|[a-zA-Z]:\\).+/.test(src)
    if (isUrl || (!isAbsoluteLocal && !baseUrl)) {
      if (!isUrl && !baseUrl) {
        console.warn('"baseUrl" is not defined!')
      }

      return {
        isUnknownType: false,
        src: isAbsoluteLocal ? await join(baseUrl, src) : src,
      }
    } else {
      return {
        isUnknownType: false,
        src: src.startsWith('.') ? await join(baseUrl, src) : src,
      }
    }
    // else: Forbid the request due absolute or relative path in browser
  } else if (isUrl && !imageExtension) {
    // Assume it's a valid image and make a http request later
    return {
      isUnknownType: true,
      src,
    }
  }

  // Data url
  if (DATA_URL_REG.test(src)) {
    return {
      isUnknownType: false,
      src,
    }
  }

  // Url type is unknown
  return {
    isUnknownType: false,
    src: '',
  }
}

export const getImageUrlInTauri = async (url: string, filePath?: string) => {
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

  if (url.startsWith('data:')) {
    return url
  }

  const dirPath = filePath || useEditorStore.getState().folderData?.[0]?.path

  if (dirPath) {
    try {
      const relativeUrl = await join(dirPath, url)
      const isExists = await invoke('file_exists', { filePath: relativeUrl })
      if (isExists) {
        return convertFileSrc(relativeUrl)
      } else {
        return convertFileSrc(url)
      }
    } catch (error) {
      return url
    }
  }

  try {
    return convertFileSrc(url)
  } catch (error) {
    return url
  }
}
