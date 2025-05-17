import { convertFileSrc } from '@tauri-apps/api/core'
import { FC, useEffect, useState } from 'react'
import styled from 'styled-components'
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

  return <StyledImagePreview src={src} />
}

const StyledImagePreview = styled(Image)`
  max-width: calc(100% - 20px);
  max-height: calc(100% - 20px);
  object-fit: contain;
`
