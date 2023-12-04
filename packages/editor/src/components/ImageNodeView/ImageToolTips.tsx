import { useState, type FC } from 'react'
import { Input, Space, Tooltip } from 'antd'
import type { NodeViewComponentProps } from '@remirror/react'

interface ImageToolTipsProps {
  node: NodeViewComponentProps['node']
  updateAttributes?: NodeViewComponentProps['updateAttributes']
}

export const ImageToolTips: FC<ImageToolTipsProps> = (props) => {
  const { node } = props
  const { src } = node.attrs
  const [srcVal, setSrcVal] = useState(src)

  const handleSrcInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    setSrcVal(e.currentTarget.value)
  }

  const updateSrc = () => {
    if (props.updateAttributes) {
      props.updateAttributes({ ...node.attrs, src: srcVal })
    }
  }

  return (
    <Space>
      <Tooltip title='Image URL'>
        <Input
          size='small'
          placeholder='Image URL'
          value={srcVal}
          onInput={handleSrcInput}
          onPressEnter={updateSrc}
        />
      </Tooltip>
    </Space>
  )
}
