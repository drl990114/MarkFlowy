import type { RightBarItem } from '@/components/SideBar'
import { MfIconButton } from '@/components/ui-v2/Button'
import { RIGHTBARITEMKEYS } from '@/constants'
import { getFileObjectByPath } from '@/helper/files'
import { useEditorStore } from '@/stores'
import { useVirtualizer } from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import classNames from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from 'zens'
import { SearchContainer, SearchInfoBox, SearchInput, SearchList } from './styles'
import type { SearchInfo } from './useSearchStore'
import useSearchStore from './useSearchStore'

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface SearchMatchSnippetProps {
  content: string
  keyword: string
  matchIndexInLine: number
  caseSensitive: boolean
}

const SearchMatchSnippet = memo(
  ({ content, keyword, matchIndexInLine, caseSensitive }: SearchMatchSnippetProps) => {
    const prefixWindow = 10 // 前置字符减少，确保在窄屏下 active 项靠左显示
    const suffixWindow = 50 // 后置字符可以多一些

    const getMatchPositions = (text: string, query: string) => {
      if (!query) return []
      const regex = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi')
      const positions: { start: number; end: number }[] = []
      let match
      while ((match = regex.exec(text)) !== null) {
        positions.push({ start: match.index, end: regex.lastIndex })
      }
      return positions
    }

    const positions = getMatchPositions(content, keyword)
    const currentMatch = positions[matchIndexInLine]

    if (!currentMatch) return <span className="snippet-text">{content}</span>

    const start = Math.max(0, currentMatch.start - prefixWindow)
    const end = Math.min(content.length, currentMatch.end + suffixWindow)

    const snippet = content.slice(start, end)

    const renderSnippet = () => {
      const regex = new RegExp(escapeRegExp(keyword), caseSensitive ? 'g' : 'gi')
      const result = []
      let lastIndex = 0
      let match

      while ((match = regex.exec(snippet)) !== null) {
        result.push(snippet.slice(lastIndex, match.index))

        const isCurrentMatch = match.index + start === currentMatch.start
        result.push(
          <mark key={match.index} className={isCurrentMatch ? 'active' : ''}>
            {match[0]}
          </mark>,
        )
        lastIndex = regex.lastIndex
      }
      result.push(snippet.slice(lastIndex))
      return result
    }

    return (
      <span className="snippet-text">
        {start > 0 && '...'}
        {renderSnippet()}
        {end < content.length && '...'}
      </span>
    )
  },
)

const SearchView = memo(() => {
  const { resultList, addSearchResult, searchKeyword, caseSensitive, activeIndex, setSearchState } =
    useSearchStore()
  const { addOpenedFile, setActiveId, folderData, editorCtxMap, activeId } = useEditorStore()
  const [expandIdMap, setExpandIdMap] = useState<Record<string, boolean>>({})
  const { t } = useTranslation()
  const parentRef = useRef<HTMLDivElement>(null)

  const getMatchCount = useCallback(
    (text: string, keyword: string) => {
      if (!keyword) return 0
      const regex = new RegExp(escapeRegExp(keyword), caseSensitive ? 'g' : 'gi')
      const matches = text.match(regex)
      return matches ? matches.length : 0
    },
    [caseSensitive],
  )

  const flattenedData = useMemo(() => {
    const data: Array<
      | { type: 'header'; searchInfo: SearchInfo; id: string }
      | {
          type: 'match'
          searchInfo: SearchInfo
          match: any
          matchIndexInLine: number
          globalIndex: number
          isActive: boolean
          id: string
        }
    > = []

    resultList.forEach((searchInfo) => {
      data.push({
        type: 'header',
        searchInfo,
        id: `header-${searchInfo.id}`,
      })

      if (expandIdMap[searchInfo.id]) {
        const isCurrentFileActive = getFileObjectByPath(searchInfo.path)?.id === activeId
        let fileIndexRef = 0
        searchInfo.matches.forEach((match) => {
          const count = getMatchCount(match.content, searchKeyword)
          for (let i = 0; i < count; i++) {
            const currentIndex = fileIndexRef + i
            data.push({
              type: 'match',
              searchInfo,
              match,
              matchIndexInLine: i,
              globalIndex: currentIndex,
              isActive: isCurrentFileActive && currentIndex === activeIndex,
              id: `match-${match.id}-${i}`,
            })
          }
          fileIndexRef += count
        })
      }
    })

    return data
  }, [resultList, expandIdMap, activeId, activeIndex, searchKeyword, getMatchCount])

  const rowVirtualizer = useVirtualizer({
    count: flattenedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index: number) => (flattenedData[index].type === 'header' ? 32 : 44),
    overscan: 10,
  })

  const isAllExpand = resultList.length > 0 && resultList.every((item) => expandIdMap[item.id])

  const toggleAllExpand = useCallback(() => {
    const nextValue = !isAllExpand
    setExpandIdMap(
      resultList.reduce(
        (acc, cur) => {
          acc[cur.id] = nextValue
          return acc
        },
        {} as Record<string, boolean>,
      ),
    )
  }, [isAllExpand, resultList])

  useEffect(() => {
    return () => {
      if (activeId) {
        editorCtxMap.get(activeId)?.commands?.stopFind?.()
      }
    }
  }, [activeId, editorCtxMap])

  useEffect(() => {
    if (activeId && resultList.length > 0 && searchKeyword) {
      const ctx = editorCtxMap.get(activeId)
      const searchParams = {
        query: searchKeyword,
        caseSensitive,
        activeIndex: activeIndex,
      }

      // findRanges twice to make sure scroll to activeIndex
      ctx?.helpers.findRanges?.(searchParams)
      ctx?.helpers.findRanges?.(searchParams)
    }
  }, [activeIndex, caseSensitive, activeId, searchKeyword, editorCtxMap, resultList])

  const handleSearch = useCallback(async () => {
    if (!folderData?.[0]) return
    if (!searchKeyword) {
      setSearchState({ resultList: [] })
      return
    }

    const res = await invoke<{ data: SearchInfo[] }>('search_files_async', {
      query: {
        dir: folderData[0].path,
        name_text: '.md',
        contents_text: searchKeyword,
      },
      options: {
        content_case_sensitive: caseSensitive,
      },
    })

    console.log('res', res)
    addSearchResult(res.data)

    const newExpandIdMap: Record<string, boolean> = {}

    res.data.forEach((searchInfo) => {
      newExpandIdMap[searchInfo.id] = true
    })

    setExpandIdMap(newExpandIdMap)
  }, [folderData, searchKeyword, caseSensitive, setSearchState, addSearchResult])

  const toggleCaseSensitive = useCallback(() => {
    setSearchState({ caseSensitive: !caseSensitive })
  }, [caseSensitive, setSearchState])

  const handleKeyDown = useCallback(() => {
    handleSearch()
  }, [handleSearch])

  const handleFileInfoClick = useCallback(
    (p: string, index: number) => {
      const curFile = getFileObjectByPath(p)

      if (curFile) {
        addOpenedFile(curFile.id)
        setActiveId(curFile.id)
        const searchParams = {
          query: searchKeyword,
          caseSensitive,
          activeIndex: index,
        }

        editorCtxMap.get(curFile.id)?.helpers.findRanges?.(searchParams)

        setSearchState({
          activeIndex: index,
        })
      }
    },
    [addOpenedFile, setActiveId, caseSensitive, searchKeyword, setSearchState, editorCtxMap],
  )

  const toggleSearchInfoExpand = useCallback(
    (id: string) => setExpandIdMap((prev) => ({ ...prev, [id]: prev[id] ? false : true })),
    [],
  )

  const handleSearchTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) {
        setSearchState({ resultList: [] })
        if (activeId) {
          editorCtxMap.get(activeId)?.commands?.stopFind?.()
        }
      }
      setSearchState({ searchKeyword: e.target.value })
    },
    [setSearchState],
  )

  return (
    <SearchContainer>
      <SearchInput>
        <Input
          size='small'
          className='search-input'
          onPressEnter={handleKeyDown}
          value={searchKeyword}
          placeholder={t('search.text')}
          onChange={handleSearchTextChange}
        />
        <MfIconButton
          onClick={toggleCaseSensitive}
          active={caseSensitive}
          icon='ri-font-size'
          size='small'
          rounded='smooth'
          tooltipProps={{
            title: t('search.caseSensitive'),
          }}
        />
        <MfIconButton
          size='small'
          rounded='smooth'
          onClick={toggleAllExpand}
          icon={isAllExpand ? 'ri-contract-up-down-line' : 'ri-expand-up-down-line'}
          tooltipProps={{
            title: t('search.toggleExpandAll'),
          }}
        />
      </SearchInput>
      <SearchList ref={parentRef}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = flattenedData[virtualItem.index]

            if (item.type === 'header') {
              const isExpand = expandIdMap[item.searchInfo.id]
              const iconCls = classNames('search-info__icon', {
                'ri-arrow-down-s-line': isExpand,
                'ri-arrow-right-s-line': !isExpand,
              })

              return (
                <SearchInfoBox
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div
                    className='search-info__path'
                    onClick={() => toggleSearchInfoExpand(item.searchInfo.id)}
                    title={item.searchInfo.path}
                  >
                    <i className={iconCls} />
                    <i className='ri-file-list-2-line' style={{ marginRight: 4, opacity: 0.7 }} />
                    {item.searchInfo.relative_path}
                  </div>
                </SearchInfoBox>
              )
            }

            return (
              <SearchInfoBox
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={classNames('search-info', { active: item.isActive })}
                  onClick={() => handleFileInfoClick(item.searchInfo.path, item.globalIndex)}
                >
                  <div className='search-info__linenumber'>line {item.match.line}:</div>
                  <div className='search-info__content'>
                    <SearchMatchSnippet
                      content={item.match.content}
                      keyword={searchKeyword}
                      matchIndexInLine={item.matchIndexInLine}
                      caseSensitive={caseSensitive}
                    />
                  </div>
                </div>
              </SearchInfoBox>
            )
          })}
        </div>
      </SearchList>
    </SearchContainer>
  )
})

export const Search = {
  title: RIGHTBARITEMKEYS.Search,
  key: RIGHTBARITEMKEYS.Search,
  icon: <i className='ri-search-2-line' />,
  components: <SearchView />,
} as RightBarItem
