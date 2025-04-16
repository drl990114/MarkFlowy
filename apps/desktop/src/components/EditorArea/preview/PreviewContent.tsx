import styled from 'styled-components'
import { FileType } from '@/helper/fileTypeHandler'
import { ImagePreview } from './ImagePreview'

const PreviewContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
`

interface PreviewContentProps {
  type: FileType
  filePath?: string
  active: boolean
}

export function PreviewContent({ type, filePath, active }: PreviewContentProps) {
  if (!active) return null

  const renderContent = () => {
    switch (type) {
      case 'image':
        return <ImagePreview filePath={filePath} />
      default:
        return null
    }
  }

  return <PreviewContainer>{renderContent()}</PreviewContainer>
}
