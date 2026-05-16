import { type Node } from '@rme-sdk/pm/model'
import { useEffect, useState } from 'react'
import { Icon } from 'zens'
import { WysiwygThemeWrapper } from '../../theme'
import { rmeProsemirrorNodeToHtml } from '../../utils/prosemirrorNodeToHtml'
import { EditorProps } from '../Editor'
import { createWysiwygDelegate } from '../WysiwygEditor'

interface PreviewProps {
  doc: Node | string
  delegateOptions?: EditorProps['delegateOptions']
  onError?: (e: Error) => void
}

export type HTMLAstNode = {
  attrs: Record<string, any>
  name: string
  type: string
  children?: HTMLAstNode[]
  content?: string
}

export const Preview: React.FC<PreviewProps> = (props) => {
  const { doc, delegateOptions } = props
  const [processedHtml, setProcessedHtml] = useState('')
  let targetDoc: PreviewProps['doc'] = doc

  if (typeof targetDoc === 'string') {
    targetDoc = createWysiwygDelegate(delegateOptions).stringToDoc(targetDoc)
  }

  useEffect(() => {
    rmeProsemirrorNodeToHtml(targetDoc, delegateOptions)
      .then((html) => {
        setProcessedHtml(html)
      })
      .catch((e) => {
        props.onError?.(e)
        console.error(e)
      })
  }, [props.onError])

  if (!processedHtml) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '60px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon.Loading3QuartersOutlined spin size={40} />
      </div>
    )
  }

  return <WysiwygThemeWrapper dangerouslySetInnerHTML={{ __html: processedHtml }} />
}
