import { convertFileSrc } from '@tauri-apps/api/core'
import { FC, useEffect, useState } from 'react'
import { Image } from 'zens'

interface ImagePreviewProps {
  filePath?: string
}

export const ImagePreview: FC<ImagePreviewProps> = (props) => {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (props.filePath) {
      const src = convertFileSrc(props.filePath)
      setSrc(src)
    }
  }, [props.filePath])

  if (!src) return null

  return <Image src={src} />
}
