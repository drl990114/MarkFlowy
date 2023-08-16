import { useState } from 'react'
import { createGlobalStore } from 'hox'
import type { IFile } from '@/helper/filesys'

const useContextMenuNode = () => {
  const [contextMenuNode, setContextMenuNode] = useState<undefined | IFile>()

  return {
    contextMenuNode,
    setContextMenuNode
  }
}

const [useFileTreeContextMenuNode] = createGlobalStore(useContextMenuNode)
export default useFileTreeContextMenuNode

