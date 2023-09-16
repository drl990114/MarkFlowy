import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '@/components/SideBar'
import { Input } from '@/components/UI/Input'
import { listen } from '@tauri-apps/api/event'
import { memo, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api'
import type { SearchInfo } from './useSearchStore'
import useSearchStore from './useSearchStore'
import { SearchContainer, SearchInfoBox, SearchInput } from './styles'
import { MfIconButton } from '@/components/UI/Button'
import { useEditorStore } from '@/stores'
import { getFileObjectByPath } from '@/helper/files'
import { nanoid } from 'nanoid'

const SearchView = memo(() => {
  const { resultList, addSearchResult, searchKeyword, caseSensitive, activeIndex, setSearchState } =
    useSearchStore()
  const { addOpenedFile, setActiveId, folderData, editorCtxMap, activeId } = useEditorStore()
  let indexRef = 0

  useEffect(() => {
    return () => {
      if (activeId) {
        editorCtxMap.get(activeId)?.commands.stopFind()
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
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [addSearchResult])

  const highlightKeyWord = (text: string, keyword: string) => {
    const prev = indexRef

    const component = text
      .split(keyword)
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

  const handleSearch = useCallback(() => {
    if (!folderData?.[0] || !searchKeyword) return

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
  }, [folderData, searchKeyword, caseSensitive])

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
          placeholder='Search'
          onChange={handleSearchTextChange}
        />
        <MfIconButton
          onClick={toggleCaseSensitive}
          active={caseSensitive}
          icon='ri-font-size'
          tooltipProps={{
            title: 'Case Sensitive',
          }}
        />
      </SearchInput>
      {resultList.map((searchInfo) => {
        indexRef = 0

        return (
          <SearchInfoBox key={searchInfo.id}>
            <div className='search-info__path'>{searchInfo.relative_path}</div>
            {searchInfo.matches.map((match) => {
              const { indexScope, component } = highlightKeyWord(match.content, searchKeyword)
              return (
                <div
                  className='search-info'
                  key={match.id}
                  onClick={() => handleFileInfoClick(searchInfo.path, indexScope[0])}
                >
                  <div className='search-info__linenumber'>{match.line}:</div>
                  <div className='search-info__content'>{component}</div>
                </div>
              )
            })}
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
