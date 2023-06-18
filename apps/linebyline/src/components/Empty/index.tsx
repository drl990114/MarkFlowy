import { memo } from 'react'
import { useTranslation } from 'react-i18next'

function Empty() {
  const { t } = useTranslation()

  return (
    <div className="fjic h-full w-full text-6xl text-labelFontColor">
      {t('none')}
    </div>
  )
}

export default memo(Empty)
