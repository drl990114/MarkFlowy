import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '../SideBar'
import type { TocRef } from 'zens'
import { Toc } from 'zens'
import { useCommandStore, useEditorStore } from '@/stores'
import { useEffect, useRef } from 'react'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { extractMatches } from 'rme'
import { IHeadingData } from 'zens/lib/TableOfContent/HeadingTree'
import { getHeadingValue } from '@/helper/string'
import { Container, RightBarHeader } from './styles'
import { useTranslation } from 'react-i18next'
import { sourceCodeCodemirrorViewMap } from '../EditorArea/Editor'

const TocView = () => {
  const tocRef = useRef<TocRef>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const addCommand = useCommandStore.getState().addCommand
    addCommand({
      id: 'app:toc_refresh',
      handler: () => {
        const activeId = useEditorStore.getState().activeId
        const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap

        if (!activeId) return

        if (editorViewTypeMap.get(activeId) === 'sourceCode') {
          const codemirrorView = sourceCodeCodemirrorViewMap.get(activeId)
          if (!codemirrorView) {
            return
          }

          const matches = extractMatches(codemirrorView.cm)

          const headings: IHeadingData[] = matches.map((match) => {
            const depth = match.type.split('ATXHeading')?.[1]
            const value = getHeadingValue(match.value)

            return {
              depth,
              value,
              id: match.value,
              htmlNode: null,
              onClick: () => {
                codemirrorView.cm.dispatch({
                  selection: {
                    anchor: match.to,
                    head: match.to,
                  },
                  scrollIntoView: true,
                })
                codemirrorView.cm.focus()
              },
            }
          })
          tocRef.current?.refreshByHeadings({ newHeadings: headings })
          return
        }
        tocRef.current?.refresh({
          newContainer: document.querySelector('.editor-active') as HTMLElement,
          newScroll: document.querySelector('.editor-active') as HTMLElement,
        })
      },
    })
  }, [])

  const containerEl = document.querySelector('.editor-active') as HTMLElement
  const scrollEl = document.querySelector('.editor-active') as HTMLElement

  return (
    <Container>
      <RightBarHeader>
        <small className='sidebar-header__name'>{t('sidebar.table_of_contents')}</small>
      </RightBarHeader>
      <Toc ref={tocRef} containerEl={containerEl} scrollEl={scrollEl} />
    </Container>
  )
}

export const TableOfContent = {
  title: RIGHTBARITEMKEYS.TableOfContent,
  key: RIGHTBARITEMKEYS.TableOfContent,
  icon: <i className='ri-list-unordered' />,
  components: <TocView />,
} as RightBarItem
