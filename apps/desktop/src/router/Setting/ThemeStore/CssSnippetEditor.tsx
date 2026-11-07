import { useContext, useDeferredValue, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenuItemPrimitive as MenuItem } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import useThemeStore from '@/stores/useThemeStore'
import { SemanticThemeContext } from '@/themes/context'
import { cssSnippetTemplates, snippetPreviewStyles } from '@/themes/cssSnippetTemplates'
import type { CssSnippet } from '@/themes/library'
import { getThemeTokens, themeLabel } from '@/themes/runtime'
import { ThemeMenu } from './ThemeListItem'
import { ThemePreview } from './ThemePreview'
import { useThemeLabels } from './labels'

export interface CssSnippetEditorProps {
  snippet: CssSnippet
  snippets: readonly CssSnippet[]
  pending: boolean
  onChange: (snippet: CssSnippet) => void
  onSave: () => void
  onCancel: () => void
  onOpenReference: () => void
}

const ignoreInspect = () => undefined

export function CssSnippetEditor({
  snippet,
  snippets,
  pending,
  onChange,
  onSave,
  onCancel,
  onOpenReference,
}: CssSnippetEditorProps) {
  const labels = useThemeLabels()
  const currentTheme = useThemeStore((state) => state.curTheme)
  // The app context already includes the user's accent and typography preferences.
  const appTokens = useContext(SemanticThemeContext)
  const theme = useMemo(
    () => ({
      id: currentTheme.name,
      name: themeLabel(currentTheme),
      mode: currentTheme.mode,
      tokens: appTokens ?? getThemeTokens(currentTheme),
      css: currentTheme.globalStyleText ?? '',
    }),
    [currentTheme, appTokens],
  )
  const draft = useDeferredValue(snippet)
  const previewStyles = useMemo(() => snippetPreviewStyles(snippets, draft), [snippets, draft])

  return (
    <fieldset
      disabled={pending}
      inert={pending}
      className='@container/css-editor m-0 min-w-0 space-y-3 border-0 border-t border-solid border-border pt-3 pr-0 pb-0 pl-0'
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          inputSize='sm'
          className='min-w-40 flex-1'
          aria-label={labels.name}
          value={snippet.name}
          onChange={(event) => onChange({ ...snippet, name: event.target.value })}
        />
        <ThemeMenu
          label={labels.insertCssTemplate}
          trigger={labels.insertCssTemplate}
          disabled={pending}
        >
          {cssSnippetTemplates.map((template) => (
            <MenuItem
              key={template.id}
              onSelect={() =>
                onChange({
                  ...snippet,
                  name:
                    !snippet.css.trim() &&
                    (!snippet.name.trim() || snippet.name === labels.untitledCss)
                      ? labels[template.label]
                      : snippet.name,
                  css: snippet.css.trim()
                    ? `${snippet.css.trimEnd()}\n\n${template.css}\n`
                    : `${template.css}\n`,
                })
              }
            >
              {labels[template.label]}
            </MenuItem>
          ))}
        </ThemeMenu>
        <Button size='sm' variant='ghost' onClick={onOpenReference}>
          {labels.cssSelectorReference}
        </Button>
      </div>
      <p className='m-0 text-ui-caption text-muted-foreground'>{labels.cssPreviewHint}</p>
      <div className='grid items-start gap-3 @min-[48rem]/css-editor:grid-cols-2'>
        <Textarea
          aria-label='CSS'
          className='h-64 font-mono text-ui-control @min-[48rem]/css-editor:h-[clamp(30rem,calc(100dvh-20rem),44rem)]'
          spellCheck={false}
          value={snippet.css}
          onChange={(event) => onChange({ ...snippet, css: event.target.value })}
        />
        <div className='min-w-0'>
          <ThemePreview
            theme={theme}
            snippets={previewStyles}
            inspect={false}
            onInspect={ignoreInspect}
          />
        </div>
      </div>
      <label className='flex cursor-default select-none items-center gap-2'>
        <Checkbox
          checked={snippet.enabled}
          onCheckedChange={(enabled) => onChange({ ...snippet, enabled: enabled === true })}
        />
        {labels.enableCssAfterSave}
      </label>
      <div className='flex items-center gap-2'>
        <Button size='sm' onClick={onSave}>
          {labels.saveCss}
        </Button>
        <Button size='sm' variant='ghost' onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </fieldset>
  )
}
