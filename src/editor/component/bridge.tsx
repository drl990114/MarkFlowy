import { useHelpers } from '@remirror/react'
import { DataCenter } from '@utils'

function Bridge() {
  const { getMarkdown } = useHelpers()
  DataCenter.setData('markdownContent', getMarkdown())

  return <></>
}

export default Bridge
