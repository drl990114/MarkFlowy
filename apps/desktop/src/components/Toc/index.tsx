export * from './Toc'

import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '../SideBar'
import type { TocRef } from './Toc'
import { Toc } from './Toc'
import { useCommandStore } from '@/stores'
import { useEffect, useRef } from 'react'

const TocView = () => {
  const { addCommand } = useCommandStore()
  const tocRef = useRef<TocRef>(null)

  useEffect(() => {
    addCommand({
      id: 'app:toc_refresh',
      handler: () => {
        tocRef.current?.refresh({
          newContainer: document.querySelector('.editor-active') as HTMLElement,
          newScroll: document.querySelector('.editor-active') as HTMLElement,
        })
      }
    })
  } , [addCommand])

  const containerEl = document.querySelector('.editor-active') as HTMLElement
  const scrollEl = document.querySelector('.editor-active') as HTMLElement

  return (
    <Toc
      ref={tocRef}
      containerEl={containerEl}
      scrollEl={scrollEl}
    />
  )
}

export const TableOfContent = {
  title: RIGHTBARITEMKEYS.TableOfContent,
  key: RIGHTBARITEMKEYS.TableOfContent,
  icon: <i className='ri-list-unordered' />,
  components: <TocView />,
} as RightBarItem
