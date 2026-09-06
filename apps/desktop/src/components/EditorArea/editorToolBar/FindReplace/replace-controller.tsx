import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import type { FC } from 'react'
import { useTranslation } from '@/i18n'

export const ReplaceController: FC<{
  replace: () => void
  replaceAll: () => void
}> = ({ replace, replaceAll }) => {
  const { t } = useTranslation()

  return (
    <ButtonGroup.Root>
      <Button className='h-6' type='button' variant='outline' size='sm' onClick={replace}>
        {t('find_replace.replace')}
      </Button>
      <Button className='h-6' type='button' variant='outline' size='sm' onClick={replaceAll}>
        {t('find_replace.replace_all')}
      </Button>
    </ButtonGroup.Root>
  )
}
