import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sameKeyMap, formatKeyMap } from '@/commands/keybindingKeys'
import { useGlobalKeyboard } from '@/hooks'
import { ListFilter, LockKeyhole, Pencil, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { RecordKeysModal, type RecordKeysModalRef } from './RecordKeysModal'
import { ShortcutKeys } from './ShortcutKeys'

export function KeyboardTable() {
  const { keyboardInfos, loadError, reload } = useGlobalKeyboard()
  const recordKeysModalRef = useRef<RecordKeysModalRef>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const editTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [query, setQuery] = useState('')
  const [modifiedOnly, setModifiedOnly] = useState(false)
  const { t } = useTranslation()
  const normalizedQuery = query.trim().toLowerCase()
  const rows = keyboardInfos.filter((row) => {
    const modified = !sameKeyMap(row.keys, row.defaultKeys)
    const search = [
      row.command,
      row.id,
      t(`command.id_descriptions.${row.command}`),
      formatKeyMap(row.keys),
      row.keys.join('+'),
    ]
      .join(' ')
      .toLowerCase()
    return (!modifiedOnly || modified) && search.includes(normalizedQuery)
  })
  return (
    <div className='@container/shortcuts space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-40 flex-1'>
          <Search
            aria-hidden='true'
            className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground'
          />
          <Input
            ref={searchRef}
            className='pl-8 shadow-none'
            inputSize='sm'
            type='search'
            autoComplete='off'
            spellCheck={false}
            aria-label={t('settings.keyboard.search')}
            placeholder={t('settings.keyboard.search')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground aria-pressed:bg-control-selected aria-pressed:text-foreground'
          aria-pressed={modifiedOnly}
          onClick={() => setModifiedOnly((value) => !value)}
        >
          <ListFilter aria-hidden='true' className='size-3.5' />
          {t('settings.keyboard.modified_only')}
        </Button>
      </div>
      {loadError && (
        <div role='alert' className='flex items-center gap-2 text-ui-control text-destructive'>
          {loadError}
          <Button variant='outline' size='sm' onClick={() => void reload()}>
            {t('settings.keyboard.retry')}
          </Button>
        </div>
      )}
      <div>
        <table
          className='w-full table-fixed border-collapse text-ui-control'
          aria-label={t('settings.keyboard.table_label')}
        >
          <thead className='border-b border-border text-ui-caption text-muted-foreground'>
            <tr>
              <th className='px-2 py-2 text-left font-normal' scope='col'>
                {t('settings.keyboard.command')}
              </th>
              <th
                className='w-[45%] px-2 py-2 text-left font-normal @min-[36rem]/shortcuts:w-[38%]'
                scope='col'
              >
                {t('settings.keyboard.keybinding')}
              </th>
              <th
                className='hidden w-24 px-2 py-2 text-left font-normal @min-[36rem]/shortcuts:table-cell'
                scope='col'
              >
                {t('settings.keyboard.scope')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const command = t(`command.id_descriptions.${row.command}`)
              const scope = t(
                row.when === 'always'
                  ? 'settings.keyboard.scope_app'
                  : 'settings.keyboard.scope_editor',
              )
              const modified = !sameKeyMap(row.keys, row.defaultKeys)

              return (
                <tr
                  key={row.id}
                  className='group/shortcut hover:bg-control-ghost-hover focus-within:bg-control-ghost-hover'
                  onDoubleClick={(event) => {
                    if (!row.configurable) return
                    // The facade restores focus to this button after the recorder closes.
                    editTriggerRef.current = event.currentTarget.querySelector('button')
                    editTriggerRef.current?.focus()
                    recordKeysModalRef.current?.open(row)
                  }}
                >
                  <td className='px-2 py-1.5'>
                    <div className='flex items-center gap-2'>
                      <span className='min-w-0 break-words' title={`${command} · ${scope}`}>
                        {command}
                      </span>
                      {modified && (
                        <span
                          title={t('settings.keyboard.modified')}
                          className='size-1.5 shrink-0 rounded-full bg-primary'
                        >
                          <span className='sr-only'>{t('settings.keyboard.modified')}</span>
                        </span>
                      )}
                    </div>
                    <span className='sr-only @min-[36rem]/shortcuts:hidden'>{scope}</span>
                  </td>
                  <td className='px-0.5 py-0.5'>
                    {row.configurable ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-auto min-h-7 max-w-full justify-start gap-2 rounded-sm px-1.5 py-1 font-normal active:scale-100'
                        aria-label={`${t('settings.keyboard.edit')} ${command}: ${formatKeyMap(row.keys) || t('settings.keyboard.unbound')}`}
                        onClick={(event) => {
                          editTriggerRef.current = event.currentTarget
                          event.currentTarget.focus()
                          recordKeysModalRef.current?.open(row)
                        }}
                      >
                        <ShortcutKeys keys={row.keys} />
                        <Pencil
                          aria-hidden='true'
                          className='size-3 shrink-0 text-muted-foreground opacity-0 group-hover/shortcut:opacity-100 group-focus-within/shortcut:opacity-100 [@media(hover:none)]:opacity-100'
                        />
                      </Button>
                    ) : (
                      <span
                        className='inline-flex min-h-7 items-center gap-2 px-1.5 py-1'
                        title={t('settings.keyboard.system_binding')}
                      >
                        <ShortcutKeys keys={row.keys} />
                        <LockKeyhole
                          aria-hidden='true'
                          className='size-3 shrink-0 text-muted-foreground'
                        />
                        <span className='sr-only'>{t('settings.keyboard.system_binding')}</span>
                      </span>
                    )}
                  </td>
                  <td className='hidden px-2 py-1.5 text-ui-caption text-muted-foreground @min-[36rem]/shortcuts:table-cell'>
                    {scope}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p
            role='status'
            className='m-0 px-2 py-8 text-center text-ui-control text-muted-foreground'
          >
            {t('settings.keyboard.no_results')}
          </p>
        )}
      </div>
      <RecordKeysModal
        ref={recordKeysModalRef}
        onCloseAutoFocus={(event) => {
          // Restoring a default can remove the edited row from the modified-only results.
          if (editTriggerRef.current && !editTriggerRef.current.isConnected) {
            event.preventDefault()
            searchRef.current?.focus()
          }
          editTriggerRef.current = null
        }}
      />
    </div>
  )
}
