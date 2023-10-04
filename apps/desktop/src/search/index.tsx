import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '@/components/SideBar'
import { Input } from '@/components/UI/Input'
import { listen } from '@tauri-apps/api/event'
import { memo, useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import type { SearchInfo } from './useSearchStore'
import useSearchStore from './useSearchStore'
import { SearchContainer, SearchInfoBox, SearchInput } from './styles'
import { MfIconButton } from '@/components/UI/Button'
import { useEditorStore } from '@/stores'
import { getFileObjectByPath } from '@/helper/files'
import { nanoid } from 'nanoid'
import Keywords from 'react-keywords'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

const SearchView = memo(() => {
  const { resultList, addSearchResult, searchKeyword, caseSensitive, activeIndex, setSearchState } =
    useSearchStore()
  const { addOpenedFile, setActiveId, folderData, editorCtxMap, activeId } = useEditorStore()
  const [expandIdMap, setExpandIdMap] = useState<Record<string, boolean>>({})
  const { t } = useTranslation()
  let indexRef = 0

  const isAllExpand = Object.values(expandIdMap).every((v) => v)

  const toggleAllExpand = useCallback(() => {
    setExpandIdMap((prev) => {
      return Object.keys(prev).reduce(
        (acc, cur) => {
          acc[cur] = !isAllExpand
          return acc
        },
        {} as Record<string, boolean>,
      )
    })
  }, [isAllExpand])

  useEffect(() => {
    return () => {
      if (activeId) {
        editorCtxMap.get(activeId)?.commands?.stopFind?.()
      }
    }
  }, [activeId, editorCtxMap])

  useEffect(() => {
    if (activeId && resultList.length > 0) {
      const ctx = editorCtxMap.get(activeId)
      const searchParams = {
        query: searchKeyword,
        caseSensitive,
        activeIndex: activeIndex,
      }

      // findRanges twice to make sure scroll to activeIndex
      ctx?.helpers.findRanges(searchParams)
      ctx?.helpers.findRanges(searchParams)
    }
  }, [activeIndex, caseSensitive, activeId, searchKeyword, editorCtxMap, resultList])

  useEffect(() => {
    const unlisten = listen<{ data: SearchInfo[] }>('search_channel_final', ({ payload }) => {
      addSearchResult(payload.data)

      const newExpandIdMap: Record<string, boolean> = {}

      payload.data.forEach((searchInfo) => {
        newExpandIdMap[searchInfo.id] = true
      })

      setExpandIdMap(newExpandIdMap)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [addSearchResult])

  const highlightKeyWord = (text: string, keyword: string) => {
    const prev = indexRef

    const regex = new RegExp(keyword, caseSensitive ? 'g' : 'gi')

    const component = text
      .split(regex)
      .flatMap((str) => {
        const key = nanoid()
        indexRef++
        return [<mark key={key}>{keyword}</mark>, str]
      })
      .slice(1)

    indexRef--

    return {
      indexScope: [prev, indexRef],
      component,
    }
  }

  const highlight = (txt: string) => <mark>{txt}</mark>

  const handleSearch = useCallback(() => {
    if (!folderData?.[0]) return
    if (!searchKeyword) {
      setSearchState({ resultList: [] })
      return
    }

    invoke('search_files', {
      query: {
        dir: folderData[0].path,
        name_text: '.md',
        contents_text: searchKeyword,
      },
      options: {
        content_case_sensitive: caseSensitive,
      },
    })
  }, [folderData, searchKeyword, caseSensitive, setSearchState])

  const toggleCaseSensitive = useCallback(() => {
    setSearchState({ caseSensitive: !caseSensitive })
  }, [caseSensitive, setSearchState])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
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

        editorCtxMap.get(curFile.id)?.helpers.findRanges(searchParams)

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
      setSearchState({ searchKeyword: e.target.value })
    },
    [setSearchState],
  )

  return (
    <SearchContainer>
      <SearchInput>
        <Input
          className='search-input'
          onKeyDown={handleKeyDown}
          value={searchKeyword}
          placeholder={t('search.text')}
          onChange={handleSearchTextChange}
        />
        <MfIconButton
          onClick={toggleCaseSensitive}
          active={caseSensitive}
          icon='ri-font-size'
          tooltipProps={{
            title: t('search.caseSensitive'),
          }}
        />
        <MfIconButton
          onClick={toggleAllExpand}
          icon={isAllExpand ? 'ri-contract-up-down-line' : 'ri-expand-up-down-line'}
          tooltipProps={{
            title: t('search.toggleExpandAll'),
          }}
        />
      </SearchInput>
      {resultList.map((searchInfo) => {
        indexRef = 0

        const isExpand = expandIdMap[searchInfo.id]

        const iconCls = classNames('search-info__icon', {
          'ri-arrow-drop-down-line': isExpand,
          'ri-arrow-drop-right-line': !isExpand,
        })

        return (
          <SearchInfoBox key={searchInfo.id}>
            <div
              className='search-info__path'
              onClick={() => toggleSearchInfoExpand(searchInfo.id)}
            >
              <i className={iconCls} />
              {searchInfo.relative_path}
            </div>
            {isExpand
              ? searchInfo.matches.map((match) => {
                  const { indexScope } = highlightKeyWord(match.content, searchKeyword)
                  return (
                    <div
                      className='search-info'
                      key={match.id}
                      onClick={() => handleFileInfoClick(searchInfo.path, indexScope[0])}
                    >
                      <div className='search-info__linenumber'>{match.line}:</div>
                      <div className='search-info__content'>
                        <Keywords
                          value={searchKeyword}
                          caseIgnored={!caseSensitive}
                          render={highlight}
                        >
                          {match.content}
                        </Keywords>
                      </div>
                    </div>
                  )
                })
              : null}
          </SearchInfoBox>
        )
      })}
    </SearchContainer>
  )
})

export const Search = {
  title: RIGHTBARITEMKEYS.Search,
  key: RIGHTBARITEMKEYS.Search,
  icon: <i className='ri-search-2-line' />,
  components: <SearchView />,
} as RightBarItem
