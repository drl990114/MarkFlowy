import { languages } from '@codemirror/language-data'
import { computePosition } from '@floating-ui/dom'
import type { EditorView, FindProsemirrorNodeResult } from '@rme-sdk/core'
import { Selection } from '@rme-sdk/pm/state'
import Fuse from 'fuse.js'
import { t } from '@markflowy/i18n'
import { isBrowser } from '../../utils/common'
import { fakeIndentedLanguage } from './codemirror-extension'

interface CodeMirrorMenuDecorations {
  create: (view: EditorView, getPos: () => number | undefined) => HTMLElement
  destroy: () => void
}

const createLanguagesList = (currentLanguage: string): HTMLUListElement | null => {
  if (!isBrowser()) return null
  const languagesList = document.createElement('ul')
  languagesList.classList.add('code-block__languages')
  languages.forEach((language) => {
    const languageItem = document.createElement('li')
    languageItem.classList.add('code-block__language')
    languageItem.classList.toggle('code-block__language--active', language.name === currentLanguage)
    languageItem.innerText = language.name
    languagesList.append(languageItem)
  })

  return languagesList
}

const updateLanguagesList = ({
  keyword,
  languagesList,
  currentLanguage,
  highlightedIndex,
}: {
  keyword?: string
  languagesList: HTMLUListElement
  currentLanguage: string
  highlightedIndex: number
}) => {
  let filteredLanguages = languages

  if (keyword) {
    filteredLanguages = new Fuse(languages, {
      keys: ['name'],
    })
      .search(keyword)
      .map((result) => result.item)
  }

  languagesList.innerHTML = ''
  if (filteredLanguages.length === 0) {
    const emptyItem = document.createElement('li')
    emptyItem.classList.add('code-block__language', 'code-block__language--empty')
    emptyItem.innerText = 'No results'
    languagesList.append(emptyItem)
    return filteredLanguages
  }

  filteredLanguages.forEach((language, index) => {
    const languageItem = document.createElement('li')
    languageItem.classList.add('code-block__language')
    languageItem.classList.toggle('code-block__language--active', language.name === currentLanguage)
    languageItem.classList.toggle('code-block__language--highlight', index === highlightedIndex)
    languageItem.dataset.value = language.name
    languageItem.dataset.index = String(index)
    languageItem.innerText = language.name
    languagesList.append(languageItem)
  })
  return filteredLanguages
}

const createCodeMirrorMenuDecorations = (
  found: FindProsemirrorNodeResult,
): CodeMirrorMenuDecorations => {
  const destoryCallbacks: Function[] = []

  const handleBlurClick = (e: MouseEvent) => {
    const targetNode = e.target as HTMLElement
    if (!targetNode.classList.contains('code-block__languages__input')) {
      destroy()
    }
  }

  const create = (view: EditorView, getPos: () => number | undefined): HTMLElement => {
    let currentLanguage = found.node.attrs.language || ''
    if (currentLanguage === fakeIndentedLanguage) {
      currentLanguage = ''
    }

    const languagesList = createLanguagesList(currentLanguage)
    let filteredLanguages = languages
    let highlightedIndex = -1
    let menuOpen = false

    const setLanguage = (language: string) => {
      const pos = getPos()
      if (pos !== undefined) {
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { language }))
      }
    }

    const moveSelection = (dir: 1 | -1) => {
      const pos = getPos()
      if (pos === undefined) {
        return
      }
      const targetPos = dir < 0 ? pos : pos + found.node.nodeSize
      const selection = Selection.near(view.state.doc.resolve(targetPos), dir)
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView())
      view.focus()
    }
    const focusCodeEditor = (dir: 1 | -1) => {
      const pos = getPos()
      if (pos === undefined) {
        return
      }
      const targetPos = dir < 0 ? pos + found.node.nodeSize - 1 : pos + 1
      const selection = Selection.near(view.state.doc.resolve(targetPos), dir)
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView())
      view.focus()
    }

    const openMenu = () => {
      if (menuOpen || !languagesList) {
        return
      }
      menuOpen = true
      destoryCallbacks.push(() => {
        if (menuOpen && languagesList) {
          reference.removeChild(languagesList)
          menuOpen = false
        }
      })
      reference.appendChild(languagesList)
      computePosition(reference, languagesList, { placement: 'bottom-start' }).then(({ x, y }) => {
        Object.assign(languagesList.style, {
          left: `${x}px`,
          top: `${y}px`,
        })
      })
    }

    if (!isBrowser() || !languagesList) {
      return document.createElement('div')
    }

    const reference = document.createElement('div')
    const langInput = document.createElement('input')
    reference.classList.add('code-block__reference', 'code-block__reference--active')
    langInput.classList.add('code-block__languages__input')

    langInput.placeholder = t('codemirror.searchInputPlaceholder')

    reference.appendChild(langInput)
    langInput.value = currentLanguage

    langInput.addEventListener('focus', () => {
      const matchedIndex = filteredLanguages.findIndex((language) => language.name === currentLanguage)
      highlightedIndex = matchedIndex >= 0 ? matchedIndex : filteredLanguages.length > 0 ? 0 : -1
      filteredLanguages = updateLanguagesList({
        keyword: langInput.value,
        currentLanguage,
        languagesList,
        highlightedIndex,
      })
    })

    document.addEventListener('click', handleBlurClick, true)

    langInput.addEventListener('input', (e) => {
      if (e.target) {
        if (!menuOpen) {
          openMenu()
        }
        const value = (e.target as HTMLInputElement).value
        highlightedIndex = -1
        filteredLanguages = updateLanguagesList({
          keyword: value,
          currentLanguage,
          languagesList,
          highlightedIndex,
        })
        setLanguage(value)
      }
    })

    languagesList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const value = target.dataset.value
      if (!value) {
        return
      }
      currentLanguage = value
      setLanguage(currentLanguage)
      langInput.value = currentLanguage
      highlightedIndex = filteredLanguages.findIndex((language) => language.name === currentLanguage)
      filteredLanguages = updateLanguagesList({
        keyword: langInput.value,
        currentLanguage,
        languagesList,
        highlightedIndex,
      })
    })

    languagesList?.addEventListener('mousemove', (e) => {
      const target = e.target as HTMLElement
      const index = target.dataset.index
      if (index === undefined) {
        return
      }
      highlightedIndex = Number(index)
      filteredLanguages = updateLanguagesList({
        keyword: langInput.value,
        currentLanguage,
        languagesList,
        highlightedIndex,
      })
    })

    langInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        if (!menuOpen) {
          e.preventDefault()
          focusCodeEditor(1)
          return
        }
        if (filteredLanguages.length === 0) return
        e.preventDefault()
        highlightedIndex = (highlightedIndex + 1) % filteredLanguages.length
      } else if (e.key === 'ArrowUp') {
        if (!menuOpen) {
          e.preventDefault()
          moveSelection(-1)
          return
        }
        if (filteredLanguages.length === 0) return
        e.preventDefault()
        highlightedIndex =
          (highlightedIndex - 1 + filteredLanguages.length) % filteredLanguages.length
      } else if (e.key === 'Enter') {
        if (!menuOpen) {
          return
        }
        if (filteredLanguages.length > 0 && highlightedIndex >= 0) {
          e.preventDefault()
          const selected = filteredLanguages[highlightedIndex]
          currentLanguage = selected.name
          setLanguage(currentLanguage)
          langInput.value = currentLanguage
        }
      } else if (e.key === 'Escape') {
        destroy()
        return
      } else {
        return
      }
      if (menuOpen) {
        filteredLanguages = updateLanguagesList({
          keyword: langInput.value,
          currentLanguage,
          languagesList,
          highlightedIndex,
        })
        const activeEl = languagesList.querySelector(
          `[data-index="${highlightedIndex}"]`,
        ) as HTMLElement | null
        activeEl?.scrollIntoView({ block: 'nearest' })
      }
    })

    filteredLanguages = updateLanguagesList({
      keyword: currentLanguage,
      currentLanguage,
      languagesList,
      highlightedIndex,
    })

    const container = document.createElement('div')
    container.classList.add('code-block__menu')
    container.dataset.pos = String(found.pos)
    container.appendChild(reference)

    return container
  }

  const destroy = () => {
    destoryCallbacks.forEach((callback) => callback())
    destoryCallbacks.length = 0

    if (isBrowser()) {
      document.removeEventListener('click', handleBlurClick)
    }
  }

  return {
    create,
    destroy,
  }
}

export default createCodeMirrorMenuDecorations
