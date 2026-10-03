import type { FileType } from '@/helper/fileTypeHandler'
import { ImagePreview } from './ImagePreview'
import { lazy } from 'react'
import { PreviewBoundary } from './PreviewBoundary'

const PdfPreview = lazy(() => import('./PdfPreview'))

interface PreviewContentProps {
  fileId: string
  groupId?: string
  type: FileType
  filePath?: string
  active: boolean
  visible?: boolean
}

export function PreviewContent({
  type,
  fileId,
  groupId,
  filePath,
  active,
  visible = active,
}: PreviewContentProps) {
  if (type === 'pdf')
    return (
      <PreviewBoundary>
        <PdfPreview
          fileId={fileId}
          groupId={groupId}
          filePath={filePath}
          active={active}
          visible={visible}
        />
      </PreviewBoundary>
    )
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
