import type { FileType } from '@/helper/fileTypeHandler'
import { ImagePreview } from './ImagePreview'

interface PreviewContentProps {
  type: FileType
  filePath?: string
  active: boolean
  visible?: boolean
}

export function PreviewContent({ type, filePath, active, visible = active }: PreviewContentProps) {
  if (!visible) return null

  switch (type) {
    case 'image':
      return (
        <div className='relative min-h-0 w-full flex-1 overflow-hidden'>
          <ImagePreview filePath={filePath} />
        </div>
      )
    default:
      return null
  }
}
