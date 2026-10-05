import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { useTranslation } from '@/i18n'

export default function EmptyState() {
  const { t } = useTranslation()

  return (
    <Empty role='status'>
      <EmptyHeader>
        <EmptyTitle>{t('common.none')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
