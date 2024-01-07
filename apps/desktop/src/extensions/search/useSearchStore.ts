import { create } from 'zustand'

const useSearchStore = create<SearchStore>((set) => ({
  searchKeyword: '',
  caseSensitive: false,
  activeIndex: 0,
  resultList: [],

  setSearchState: (state) => {
    set((prev) => ({
      ...prev,
      ...state,
    }))
  },

  addSearchResult: (result) => {
    set((prev) => ({
      ...prev,
      resultList: result,
    }))
  },

  clearSearchResult: () => {
    set((prev) => ({
      ...prev,
      resultList: [],
    }))
  },
}))

type SearchInfoMatch = {
  id: string
  content: string
  line: number
}
export interface SearchInfo {
  id: string
  ext: string
  is_folder: boolean
  matches: SearchInfoMatch[]
  name: string
  path: string
  relative_path: string
}

interface SearchStore {
  searchKeyword: string,
  caseSensitive: boolean,
  activeIndex: number,
  setSearchState: (state: Partial<SearchStore>) => void
  resultList: SearchInfo[]
  addSearchResult: (result: SearchInfo[]) => void
  clearSearchResult: () => void
}

export default useSearchStore
