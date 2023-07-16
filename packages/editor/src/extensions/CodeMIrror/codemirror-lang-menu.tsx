import { languages } from '@codemirror/language-data'
import type { EditorView, FindProsemirrorNodeResult } from 'remirror'
import Drop from 'tether-drop'
import { fakeIndentedLanguage } from './codemirror-extension'
import Fuse from 'fuse.js'

interface CodeMirrorMenuDecorations {
  create: (view: EditorView, getPos: () => number | undefined) => HTMLElement
  destroy: () => void
}

const createLanguagesList = (currentLanguage: string): HTMLUListElement => {
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
}: {
  keyword?: string
  languagesList: HTMLUListElement
  currentLanguage: string
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
  filteredLanguages.forEach((language) => {
    const languageItem = document.createElement('li')
    languageItem.classList.add('code-block__language')
    languageItem.classList.toggle('code-block__language--active', language.name === currentLanguage)
    languageItem.innerText = language.name
    languagesList.append(languageItem)
  })
}

const createCodeMirrorMenuDecorations = (
  found: FindProsemirrorNodeResult,
): CodeMirrorMenuDecorations => {
  let dropInstance: Drop | undefined

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

    const setLanguage = (language: string) => {
      const pos = getPos()
      if (pos) {
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { language }))
      }
    }

    const reference = document.createElement('div')
    const langInput = document.createElement('input')
    reference.classList.add('code-block__reference', 'code-block__reference--active')
    langInput.classList.add('code-block__languages__input')

    reference.appendChild(langInput)
    langInput.value = currentLanguage

    langInput.addEventListener('focus', () => {
      dropInstance = new Drop({
        target: langInput,
        content: languagesList,
        position: 'bottom left',
      })
    })

    document.addEventListener('click', handleBlurClick, true)

    langInput.addEventListener('input', (e) => {
      if (e.target) {
        const value = (e.target as HTMLInputElement).value
        updateLanguagesList({ keyword: value, currentLanguage, languagesList })
        setLanguage(value)
      }
    })

    languagesList?.addEventListener('click', (e) => {
      currentLanguage = (e.target as HTMLElement).innerText
      setLanguage(currentLanguage)
      langInput.value = currentLanguage
    })

    updateLanguagesList({ keyword: currentLanguage, currentLanguage, languagesList })
    return reference
  }

  const destroy = () => {
    dropInstance?.destroy()
    dropInstance = undefined
    document.removeEventListener('click', handleBlurClick)
  }

  return {
    create,
    destroy,
  }
}

export default createCodeMirrorMenuDecorations
