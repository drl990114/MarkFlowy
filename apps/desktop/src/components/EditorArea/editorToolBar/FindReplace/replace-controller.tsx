import { Button } from '@/components/ui/button'
import type { FC } from 'react'
import { useTranslation } from '@/i18n'

export const ReplaceController: FC<{
  replace: () => void
  replaceAll: () => void
}> = ({ replace, replaceAll }) => {
  const { t } = useTranslation()

  return (
    <div role='group' className='flex max-w-full flex-wrap justify-end gap-1'>
      <Button type='button' variant='outline' size='sm' onClick={replace}>
        {t('find_replace.replace')}
      </Button>
      <Button type='button' variant='outline' size='sm' onClick={replaceAll}>
        {t('find_replace.replace_all')}
      </Button>
    </div>
  )
}
