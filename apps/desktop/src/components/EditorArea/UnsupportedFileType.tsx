import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { openUrl } from '@tauri-apps/plugin-opener'
import { FileQuestionIcon } from 'lucide-react'

interface UnsupportedFileTypeProps {
  fileName?: string
}

export function UnsupportedFileType({ fileName }: UnsupportedFileTypeProps) {
  return (
    <div data-slot='unsupported-file' className='flex h-full min-h-0 items-center justify-center overflow-auto bg-surface-app p-6'>
      <div className='flex max-w-80 flex-col items-center gap-2 text-center' role='status'>
        <FileQuestionIcon aria-hidden='true' className='mb-1 size-6 text-content-muted' strokeWidth={1.5} />
        <p className='m-0 text-ui-control font-medium text-content-primary'>
          {t('file.unsupportedFileType')}
        </p>
        {fileName ? (
          <p className='m-0 max-w-full truncate text-ui-caption text-content-secondary' title={fileName}>
            {fileName}
          </p>
        ) : null}
        <p className='m-0 text-ui-caption text-content-muted'>
          {t('file.unsupportedFileTypeDesc')}
        </p>
        <Button
          size='sm'
          variant='link'
          onClick={() => void openUrl('https://github.com/drl990114/MarkFlowy/issues/new/choose')}
        >
          {t('file.unsupportedFileTypeLink')}
        </Button>
      </div>
    </div>
  )
}
