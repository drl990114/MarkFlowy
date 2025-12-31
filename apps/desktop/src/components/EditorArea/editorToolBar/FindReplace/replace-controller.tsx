import { Radio } from 'antd'
import type { FC } from 'react'

export const ReplaceController: FC<{
  replace: () => void
  replaceAll: () => void
}> = ({ replace, replaceAll }) => {
  return (
    <Radio.Group size='small' style={{ display: 'flex' }}>
      <Radio.Button checked value='replace' onClick={replace}>
        Replace
      </Radio.Button>
      <Radio.Button checked value='replaceAll' onClick={replaceAll}>
        All
      </Radio.Button>
    </Radio.Group>
  )
}
