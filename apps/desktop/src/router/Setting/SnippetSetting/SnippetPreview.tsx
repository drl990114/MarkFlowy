import { useContext, useEffect, useRef, useState } from 'react'
import { ThemeContext } from 'styled-components'
import {
  loadCapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import type { CapricornSnippet } from '@/features/snippets/types'
import { i18n, useTranslation } from '@/i18n'
import useThemeStore from '@/stores/useThemeStore'

export default function SnippetPreview({ snippet }: { snippet: CapricornSnippet }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<CapricornRuntimeSession | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(true)
  const colorScheme = useThemeStore((state) => state.curTheme.mode)
  const theme = useContext(ThemeContext)
  const themeRef = useRef({ colorScheme, theme })
  themeRef.current = { colorScheme, theme }

  useEffect(() => {
    let disposed = false
    let session: CapricornRuntimeSession | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const render = async () => {
      try {
        const createRuntime = await loadCapricornRuntimeFactory()
        if (disposed || !host.current) return
        session = createRuntime(host.current, {
          markdown: '',
          mode: 'edit',
          autoFocus: false,
          snippets: false,
          copilot: false,
          colorScheme: themeRef.current.colorScheme,
          localization: {
            getLocale: () => i18n.resolvedLanguage || i18n.language,
            getDirection: () => (i18n.dir() === 'rtl' ? 'rtl' : 'ltr'),
            subscribe: (listener) => {
              i18n.on('languageChanged', listener)
              return () => i18n.off('languageChanged', listener)
            },
            translate: ({ key, defaultValue, values }) =>
              i18n.t(`capricorn.${key}`, { defaultValue, ...values }),
          },
          style: {
            fontFamily: themeRef.current.theme?.fontFamily,
            '--cap-font-mono': themeRef.current.theme?.codemirrorFontFamily,
          } as React.CSSProperties,
          virtualize: { enable: false },
          onError: (reason) => {
            if (!disposed) setError(String(reason))
          },
        })
        sessionRef.current = session
        if (snippet.kind === 'code') {
          if (!session.commands.insertCodeBlock)
            throw new Error('Snippet preview requires a runtime with code insertion support.')
          session.commands.insertCodeBlock(snippet.source, { language: snippet.language })
        } else if (snippet.kind === 'math') {
          if (!session.commands.insertMathBlock)
            throw new Error('Snippet preview requires a runtime with math insertion support.')
          session.commands.insertMathBlock(snippet.source)
        } else {
          if (!session.commands.insertMermaidBlock)
            throw new Error('Snippet preview requires a runtime with Mermaid insertion support.')
          session.commands.insertMermaidBlock(snippet.source)
        }
        session.updateSettings({ readOnly: true })
        session.setMode('preview')
        await Promise.race([
          session.waitForResources(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error('Preview timed out.')), 15_000)
          }),
        ])
      } catch (reason) {
        // A failed construction must not leave a writable temporary editor.
        sessionRef.current = null
        session?.destroy()
        session = undefined
        if (!disposed) setError(String(reason))
      } finally {
        clearTimeout(timer)
        if (!disposed) setPending(false)
      }
    }
    void render()
    return () => {
      disposed = true
      clearTimeout(timer)
      sessionRef.current = null
      // The runtime owns another React root; dispose it after the host commit.
      const retired = session
      queueMicrotask(() => retired?.destroy())
    }
  }, [snippet])

  useEffect(() => {
    let canceled = false
    queueMicrotask(() => {
      if (!canceled) sessionRef.current?.updateSettings({ colorScheme })
    })
    return () => {
      canceled = true
    }
  }, [colorScheme])
  return (
    <section className='rounded-md border border-border p-2.5' aria-label={t('snippets.preview')}>
      {pending ? (
        <p role='status' className='text-ui-control text-muted-foreground'>
          {t('common.fetching')}
        </p>
      ) : null}
      {error ? (
        <p role='alert' className='whitespace-pre-wrap text-ui-control text-destructive'>
          {t('snippets.previewError')}: {error}
        </p>
      ) : null}
      <div
        ref={host}
        className={pending ? 'invisible h-0 overflow-hidden' : 'max-h-80 overflow-auto'}
        data-slot='snippet-preview'
      />
    </section>
  )
}
