import type { RightBarItem } from '@/components/SideBar'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RIGHTBARITEMKEYS } from '@/constants'
import { resolveFileExcludePatterns } from '@/helper/file-exclude'
import { getFileObjectByPath } from '@/helper/files'
import { logger } from '@/helper/logger'
import { useEditorStore } from '@/stores'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import {
  getCapricornEditor,
  subscribeCapricornEditors,
} from '@/components/EditorArea/capricornEditorRegistry'
import { closeCompactLeftDockAfterSelection } from '@/stores/useLayoutStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { useVirtualizer } from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import classNames from 'classnames'
import type { LucideIcon } from 'lucide-react'
import {
  CaseSensitiveIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  FileSearchIcon,
  FileTextIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useTranslation } from '@/i18n'
import {
  SearchContainer,
  SearchInfoBox,
  SearchInput,
  SearchList,
  SearchMeta,
  SearchStateBox,
} from './styles'
import type { SearchInfo } from './useSearchStore'
import useSearchStore from './useSearchStore'

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type MatchPosition = {
  end: number
  start: number
}

type NormalizedSearchMatch = SearchInfo['matches'][number] & {
  matchCount: number
  positions: MatchPosition[]
}

type NormalizedSearchInfo = Omit<SearchInfo, 'matches'> & {
  matchCount: number
  matches: NormalizedSearchMatch[]
}

type SearchNavigationKey = 'ArrowDown' | 'ArrowUp' | 'End' | 'Home'

export function getNextSearchRowIndex(
  currentIndex: number,
  rowCount: number,
  key: SearchNavigationKey,
): number | null {
  if (rowCount <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return rowCount - 1
  if (key === 'ArrowDown') return Math.min(currentIndex + 1, rowCount - 1)
  return Math.max(currentIndex - 1, 0)
}

interface SearchActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  pressed?: boolean
  spinning?: boolean
}

export function SearchActionButton(props: SearchActionButtonProps) {
  const { icon: Icon, label, onClick, pressed, spinning = false } = props

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-busy={spinning || undefined}
          aria-pressed={pressed === undefined ? undefined : pressed}
          className='search-input__action'
          onClick={onClick}
          size='icon-chrome'
          variant='chrome'
        >
          <Icon
            aria-hidden='true'
            className={spinning ? 'search-icon--spin' : undefined}
            size={14}
            strokeWidth={1.75}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const createSearchRegex = (keyword: string, caseSensitive: boolean) => {
  if (!keyword) return undefined
  return new RegExp(escapeRegExp(keyword), caseSensitive ? 'g' : 'gi')
}

const getMatchPositions = (
  content: string,
  keyword: string,
  caseSensitive: boolean,
): MatchPosition[] => {
  const regex = createSearchRegex(keyword, caseSensitive)
  if (!regex) return []

  const positions: MatchPosition[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    positions.push({ start: match.index, end: regex.lastIndex })
  }

  return positions
}

const normalizeSearchResults = (
  resultList: SearchInfo[],
  keyword: string,
  caseSensitive: boolean,
): NormalizedSearchInfo[] => {
  if (!keyword) {
    return resultList.map((searchInfo) => ({
      ...searchInfo,
      matchCount: 0,
      matches: searchInfo.matches.map((match) => ({
        ...match,
        matchCount: 0,
        positions: [],
      })),
    }))
  }

  return resultList.map((searchInfo) => {
    let fileMatchCount = 0
    const matches = searchInfo.matches.map((match) => {
      const positions = getMatchPositions(match.content, keyword, caseSensitive)
      fileMatchCount += positions.length

      return {
        ...match,
        matchCount: positions.length,
        positions,
      }
    })

    return {
      ...searchInfo,
      matchCount: fileMatchCount,
      matches,
    }
  })
}

interface SearchMatchSnippetProps {
  content: string
  matchIndexInLine: number
  positions: MatchPosition[]
}

const SearchMatchSnippet = memo(
  ({ content, matchIndexInLine, positions }: SearchMatchSnippetProps) => {
    const prefixWindow = 10 // 前置字符减少，确保在窄屏下 active 项靠左显示
    const suffixWindow = 50 // 后置字符可以多一些

    const currentMatch = positions[matchIndexInLine]

    if (!currentMatch) return <span className='snippet-text'>{content}</span>

    const start = Math.max(0, currentMatch.start - prefixWindow)
    const end = Math.min(content.length, currentMatch.end + suffixWindow)

    const renderSnippet = () => {
      const result: React.ReactNode[] = []
      let lastIndex = start

      positions.forEach((position) => {
        if (position.start < start || position.end > end) {
          return
        }

        result.push(content.slice(lastIndex, position.start))

        const isCurrentMatch = position.start === currentMatch.start
        result.push(
          <mark
            key={`${position.start}-${position.end}`}
            className={isCurrentMatch ? 'active' : ''}
          >
            {content.slice(position.start, position.end)}
          </mark>,
        )
        lastIndex = position.end
      })

      result.push(content.slice(lastIndex, end))
      return result
    }

    return (
      <span className='snippet-text'>
        {start > 0 && '...'}
        {renderSnippet()}
        {end < content.length && '...'}
      </span>
    )
  },
)

const SearchView = memo(() => {
  const resultList = useSearchStore((state) => state.resultList)
  const addSearchResult = useSearchStore((state) => state.addSearchResult)
  const searchKeyword = useSearchStore((state) => state.searchKeyword)
  const caseSensitive = useSearchStore((state) => state.caseSensitive)
  const activeIndex = useSearchStore((state) => state.activeIndex)
  const setSearchState = useSearchStore((state) => state.setSearchState)
  const addOpenedFile = useEditorStore((state) => state.addOpenedFile)
  const setActiveId = useEditorStore((state) => state.setActiveId)
  const folderData = useEditorStore((state) => state.folderData)
  const editorCtxMap = useEditorStore((state) => state.editorCtxMap)
  const activeId = useEditorStore((state) => state.activeId)
  const getCapricornSnapshot = useCallback(
    () => (activeId ? getCapricornEditor(activeId) : undefined),
    [activeId],
  )
  const capricornEditor = useSyncExternalStore(
    subscribeCapricornEditors,
    getCapricornSnapshot,
    getCapricornSnapshot,
  )
  const fileExcludePatterns = useAppSettingStore((state) =>
    resolveFileExcludePatterns(state.settingData),
  )
  const [expandIdMap, setExpandIdMap] = useState<Record<string, boolean>>({})
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [focusedRowIndex, setFocusedRowIndex] = useState(0)
  const { t } = useTranslation()
  const parentRef = useRef<HTMLDivElement>(null)
  const focusRequestFrameRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)

  const normalizedResultList = useMemo(
    () => normalizeSearchResults(resultList, searchKeyword, caseSensitive),
    [caseSensitive, resultList, searchKeyword],
  )

  const flattenedData = useMemo(() => {
    const data: (
      | { type: 'header'; searchInfo: NormalizedSearchInfo; id: string }
      | {
          type: 'match'
          searchInfo: NormalizedSearchInfo
          match: NormalizedSearchMatch
          matchIndexInLine: number
          globalIndex: number
          isActive: boolean
          id: string
        }
    )[] = []

    normalizedResultList.forEach((searchInfo) => {
      data.push({
        type: 'header',
        searchInfo,
        id: `header-${searchInfo.id}`,
      })

      if (expandIdMap[searchInfo.id]) {
        const isCurrentFileActive = getFileObjectByPath(searchInfo.path)?.id === activeId
        let fileIndexRef = 0
        searchInfo.matches.forEach((match) => {
          for (let i = 0; i < match.matchCount; i++) {
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
          fileIndexRef += match.matchCount
        })
      }
    })

    return data
  }, [normalizedResultList, expandIdMap, activeId, activeIndex])

  const rowVirtualizer = useVirtualizer({
    count: flattenedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index: number) => (flattenedData[index].type === 'header' ? 24 : 32),
    overscan: 10,
  })

  useEffect(() => {
    if (flattenedData.length === 0) {
      setFocusedRowIndex(0)
      return
    }

    setFocusedRowIndex((currentIndex) => Math.min(currentIndex, flattenedData.length - 1))
  }, [flattenedData.length])

  useEffect(() => {
    return () => {
      if (focusRequestFrameRef.current !== null) {
        window.cancelAnimationFrame(focusRequestFrameRef.current)
      }
    }
  }, [])

  const focusSearchRow = useCallback(
    (rowIndex: number) => {
      setFocusedRowIndex(rowIndex)
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' })

      if (focusRequestFrameRef.current !== null) {
        window.cancelAnimationFrame(focusRequestFrameRef.current)
      }

      const focusMountedRow = (remainingAttempts: number) => {
        const target = parentRef.current?.querySelector<HTMLButtonElement>(
          `[data-search-row-index="${rowIndex}"]`,
        )
        if (target) {
          target.focus({ preventScroll: true })
          focusRequestFrameRef.current = null
          return
        }

        if (remainingAttempts > 0) {
          focusRequestFrameRef.current = window.requestAnimationFrame(() => {
            focusMountedRow(remainingAttempts - 1)
          })
        } else {
          focusRequestFrameRef.current = null
        }
      }

      focusRequestFrameRef.current = window.requestAnimationFrame(() => focusMountedRow(1))
    },
    [rowVirtualizer],
  )

  const handleSearchRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, rowIndex: number) => {
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End'
      ) {
        return
      }

      const nextIndex = getNextSearchRowIndex(rowIndex, flattenedData.length, event.key)
      if (nextIndex === null) return

      event.preventDefault()
      focusSearchRow(nextIndex)
    },
    [flattenedData.length, focusSearchRow],
  )

  const isAllExpand = resultList.length > 0 && resultList.every((item) => expandIdMap[item.id])
  const trimmedKeyword = searchKeyword.trim()
  const resultFileCount = resultList.length
  const resultMatchCount = useMemo(
    () => normalizedResultList.reduce((total, searchInfo) => total + searchInfo.matchCount, 0),
    [normalizedResultList],
  )

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

  const stopActiveFind = useCallback(() => {
    if (!activeId) return
    editorCtxMap.get(activeId)?.commands?.stopFind?.()
    capricornEditor?.find.close()
  }, [activeId, capricornEditor, editorCtxMap])

  useEffect(() => {
    return stopActiveFind
  }, [stopActiveFind])

  useEffect(() => {
    if (activeId && resultList.length > 0 && searchKeyword) {
      const ctx = editorCtxMap.get(activeId)
      const searchParams = {
        query: searchKeyword,
        caseSensitive,
        activeIndex: activeIndex,
      }

      if (capricornEditor) {
        capricornEditor.find.open()
        capricornEditor.find.search(searchParams)
      } else {
        // findRanges twice to make sure the legacy Source editor scrolls to activeIndex.
        ctx?.helpers.findRanges?.(searchParams)
        ctx?.helpers.findRanges?.(searchParams)
      }
    }
  }, [
    activeIndex,
    caseSensitive,
    activeId,
    capricornEditor,
    searchKeyword,
    editorCtxMap,
    resultList,
  ])

  const handleSearch = useCallback(async () => {
    if (!folderData?.[0]) return
    const queryText = searchKeyword.trim()

    if (!queryText) {
      searchRequestIdRef.current += 1
      setHasSearched(false)
      setIsSearching(false)
      setSearchError('')
      setSearchState({ resultList: [] })
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    setHasSearched(true)
    setIsSearching(true)
    setSearchError('')

    try {
      const res = await invoke<{ data: SearchInfo[] }>('search_files_async', {
        query: {
          dir: folderData[0].path,
          name_text: '.md',
          contents_text: queryText,
        },
        options: {
          content_case_sensitive: caseSensitive,
          file_exclude_patterns: fileExcludePatterns,
        },
      })

      if (searchRequestIdRef.current !== requestId) return

      logger.info('res', res)
      addSearchResult(res.data)

      const newExpandIdMap: Record<string, boolean> = {}

      res.data.forEach((searchInfo) => {
        newExpandIdMap[searchInfo.id] = true
      })

      setExpandIdMap(newExpandIdMap)
    } catch (error) {
      if (searchRequestIdRef.current !== requestId) return
      logger.error('search failed', error)
      setSearchError(error instanceof Error ? error.message : String(error))
      addSearchResult([])
      setExpandIdMap({})
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setIsSearching(false)
      }
    }
  }, [
    folderData,
    searchKeyword,
    caseSensitive,
    fileExcludePatterns,
    setSearchState,
    addSearchResult,
  ])

  const toggleCaseSensitive = useCallback(() => {
    searchRequestIdRef.current += 1
    setHasSearched(false)
    setIsSearching(false)
    setSearchError('')
    setExpandIdMap({})
    setSearchState({ caseSensitive: !caseSensitive, resultList: [], activeIndex: 0 })

    stopActiveFind()
  }, [caseSensitive, setSearchState, stopActiveFind])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') void handleSearch()
    },
    [handleSearch],
  )

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

        const targetCapricornEditor = getCapricornEditor(curFile.id)
        if (targetCapricornEditor) {
          targetCapricornEditor.find.open()
          targetCapricornEditor.find.search(searchParams)
        } else {
          editorCtxMap.get(curFile.id)?.helpers.findRanges?.(searchParams)
        }

        setSearchState({
          activeIndex: index,
        })
        if (closeCompactLeftDockAfterSelection()) scheduleActiveEditorFocus()
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
      const nextKeyword = e.target.value

      searchRequestIdRef.current += 1
      setHasSearched(false)
      setIsSearching(false)
      setSearchError('')
      setExpandIdMap({})
      setSearchState({ searchKeyword: nextKeyword, resultList: [], activeIndex: 0 })

      stopActiveFind()
    },
    [setSearchState, stopActiveFind],
  )

  const handleClearSearch = useCallback(() => {
    searchRequestIdRef.current += 1
    setHasSearched(false)
    setIsSearching(false)
    setSearchError('')
    setExpandIdMap({})
    setSearchState({ searchKeyword: '', resultList: [], activeIndex: 0 })
    stopActiveFind()
  }, [setSearchState, stopActiveFind])

  const renderSearchState = useCallback(() => {
    if (isSearching && resultList.length === 0) {
      return (
        <SearchStateBox aria-live='polite' role='status'>
          <div className='search-state__icon'>
            <LoaderCircleIcon
              aria-hidden='true'
              className='search-icon--spin'
              size={18}
              strokeWidth={1.5}
            />
          </div>
          <div className='search-state__title'>{t('search.searching')}</div>
          <div className='search-state__desc'>{t('search.searchingDesc')}</div>
        </SearchStateBox>
      )
    }

    if (searchError) {
      return (
        <SearchStateBox aria-live='assertive' role='alert'>
          <div className='search-state__icon'>
            <CircleAlertIcon aria-hidden='true' size={18} strokeWidth={1.5} />
          </div>
          <div className='search-state__title'>{t('search.search_failed')}</div>
          <div className='search-state__desc'>{searchError}</div>
          <Button onClick={() => void handleSearch()} size='sm' variant='outline'>
            {t('common.retry')}
          </Button>
        </SearchStateBox>
      )
    }

    if (!folderData?.[0]) {
      return (
        <Empty role='status'>
          <EmptyHeader>
            <EmptyMedia>
              <FolderOpenIcon aria-hidden='true' size={18} strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle>{t('workspace.none')}</EmptyTitle>
            <EmptyDescription>{t('search.readyDesc')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    if (!trimmedKeyword) {
      return (
        <Empty role='status'>
          <EmptyHeader>
            <EmptyMedia>
              <SearchIcon aria-hidden='true' size={18} strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle>{t('search.ready')}</EmptyTitle>
            <EmptyDescription>{t('search.readyDesc')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    if (hasSearched && resultList.length === 0) {
      return (
        <Empty role='status'>
          <EmptyHeader>
            <EmptyMedia>
              <FileSearchIcon aria-hidden='true' size={18} strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle>{t('search.search_empty')}</EmptyTitle>
            <EmptyDescription>{t('search.emptyDesc')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    return null
  }, [
    folderData,
    handleSearch,
    hasSearched,
    isSearching,
    resultList.length,
    searchError,
    t,
    trimmedKeyword,
  ])
  const virtualItems = rowVirtualizer.getVirtualItems()
  const tabbableRowIndex = virtualItems.some((item) => item.index === focusedRowIndex)
    ? focusedRowIndex
    : (virtualItems[0]?.index ?? 0)

  return (
    <SearchContainer>
      <SearchInput>
        <Input
          aria-label={t('search.text')}
          className='search-input h-6'
          inputSize='sm'
          onKeyDown={handleKeyDown}
          value={searchKeyword}
          placeholder={t('search.text')}
          onChange={handleSearchTextChange}
        />
        {searchKeyword ? (
          <SearchActionButton icon={XIcon} label={t('common.close')} onClick={handleClearSearch} />
        ) : null}
        <SearchActionButton
          icon={CaseSensitiveIcon}
          label={t('search.caseSensitive')}
          onClick={toggleCaseSensitive}
          pressed={caseSensitive}
        />
        <SearchActionButton
          icon={isAllExpand ? ChevronsDownUpIcon : ChevronsUpDownIcon}
          label={t('search.toggleExpandAll')}
          onClick={toggleAllExpand}
          pressed={isAllExpand}
        />
        <SearchActionButton
          icon={isSearching ? LoaderCircleIcon : SearchIcon}
          label={t('search.text')}
          onClick={() => void handleSearch()}
          spinning={isSearching}
        />
        {isSearching ? <div className='search-input__progress' /> : null}
      </SearchInput>
      {hasSearched && !searchError ? (
        <SearchMeta>
          <div className='search-meta__content'>
            {isSearching
              ? t('search.searchingWithKeyword', { keyword: trimmedKeyword })
              : t('search.resultSummary', {
                  files: resultFileCount,
                  matches: resultMatchCount,
                  keyword: trimmedKeyword,
                })}
          </div>
        </SearchMeta>
      ) : null}
      <SearchList ref={parentRef}>
        {renderSearchState() ?? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = flattenedData[virtualItem.index]

              if (item.type === 'header') {
                const isExpand = expandIdMap[item.searchInfo.id]

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
                    <button
                      aria-expanded={Boolean(isExpand)}
                      className='search-info__path'
                      data-search-row-index={virtualItem.index}
                      onClick={() => toggleSearchInfoExpand(item.searchInfo.id)}
                      onFocus={() => setFocusedRowIndex(virtualItem.index)}
                      onKeyDown={(event) => handleSearchRowKeyDown(event, virtualItem.index)}
                      tabIndex={virtualItem.index === tabbableRowIndex ? 0 : -1}
                      title={item.searchInfo.path}
                      type='button'
                    >
                      <ChevronRightIcon
                        aria-hidden='true'
                        className={classNames('search-info__icon', {
                          'search-info__icon--expanded': isExpand,
                        })}
                        size={14}
                        strokeWidth={1.75}
                      />
                      <FileTextIcon
                        aria-hidden='true'
                        className='search-info__file-icon'
                        size={14}
                        strokeWidth={1.75}
                      />
                      <span className='search-info__path-text'>
                        {item.searchInfo.relative_path}
                      </span>
                      <span className='search-info__badge'>{item.searchInfo.matches.length}</span>
                    </button>
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
                  <button
                    aria-current={item.isActive ? 'true' : undefined}
                    className={classNames('search-info', { active: item.isActive })}
                    data-search-row-index={virtualItem.index}
                    onClick={() => handleFileInfoClick(item.searchInfo.path, item.globalIndex)}
                    onFocus={() => setFocusedRowIndex(virtualItem.index)}
                    onKeyDown={(event) => handleSearchRowKeyDown(event, virtualItem.index)}
                    tabIndex={virtualItem.index === tabbableRowIndex ? 0 : -1}
                    type='button'
                  >
                    <div className='search-info__linenumber'>line {item.match.line}:</div>
                    <div className='search-info__content'>
                      <SearchMatchSnippet
                        content={item.match.content}
                        matchIndexInLine={item.matchIndexInLine}
                        positions={item.match.positions}
                      />
                    </div>
                  </button>
                </SearchInfoBox>
              )
            })}
          </div>
        )}
      </SearchList>
    </SearchContainer>
  )
})

export const Search = {
  title: RIGHTBARITEMKEYS.Search,
  key: RIGHTBARITEMKEYS.Search,
  icon: <SearchIcon aria-hidden='true' size={14} strokeWidth={1.75} />,
  components: <SearchView />,
} as RightBarItem
