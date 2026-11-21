import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { RadioGroupItem, RadioGroupRoot } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import {
  EDITOR_WIDTH,
  editorWidthModes,
  getEditorWidthMode,
  getFixedEditorWidth,
  isValidEditorWidth,
} from '@/constants/editorWidth'
import { useTranslation } from '@/i18n'
import { writeSettingPatch } from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { throttle } from 'lodash'
import { useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'zens'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const messages = 'settings.editor.style.content_width'
const defaultMark =
  (EDITOR_WIDTH.default - EDITOR_WIDTH.min) / (EDITOR_WIDTH.max - EDITOR_WIDTH.min)
const sliderSaveIntervalMs = 100
type WidthChange = { value: number }

function FixedWidthControls() {
  const { t } = useTranslation()
  const id = useId()
  const saved = useAppSettingStore((state) => getFixedEditorWidth(state.settingData))
  const [pendingWidth, setPendingWidth] = useState<WidthChange | null>(null)
  const [invalidText, setInvalidText] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const width = pendingWidth?.value ?? saved
  const label = t(`${messages}.maximum`)

  const persist = useMemo(
    () =>
      throttle(async (change: WidthChange) => {
        try {
          await writeSettingPatch({ editor_fixed_width: change.value })
        } catch {
          toast.error(t(`${messages}.save_failed`))
        } finally {
          // An earlier save can finish while the thumb is already at a newer position.
          setPendingWidth((latest) => (latest === change ? null : latest))
        }
      }, sliderSaveIntervalMs),
    [t],
  )
  useEffect(
    () => () => {
      persist.flush()
    },
    [persist],
  )

  function changeWidth(value: number) {
    setInvalidText(null)
    setShowError(false)
    if (value === width) return
    const change = { value }
    setPendingWidth(change)
    persist(change)
  }

  function changeText(text: string) {
    const value = Number(text)
    if (isValidEditorWidth(value)) {
      changeWidth(value)
      persist.flush()
    } else {
      setInvalidText(text)
      setShowError(false)
    }
  }

  return (
    <div className='min-w-0'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <label htmlFor={id} className='text-ui-caption text-muted-foreground'>
          {label}
        </label>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='ghost'
            disabled={invalidText === null && width === EDITOR_WIDTH.default}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              changeWidth(EDITOR_WIDTH.default)
              persist.flush()
            }}
          >
            {t(`${messages}.reset`, { value: EDITOR_WIDTH.default })}
          </Button>
          <InputGroup className='h-7 w-24'>
            <InputGroupInput
              id={id}
              inputSize='sm'
              type='number'
              inputMode='numeric'
              min={EDITOR_WIDTH.min}
              max={EDITOR_WIDTH.max}
              step={1}
              className='text-right tabular-nums'
              value={invalidText ?? String(width)}
              aria-invalid={showError || undefined}
              aria-describedby={showError ? `${id}-unit ${id}-error` : `${id}-unit`}
              data-mf-settings-escape-cancel={invalidText !== null ? '' : undefined}
              onChange={(event) => changeText(event.target.value)}
              onBlur={() => setShowError(invalidText !== null)}
              onKeyDown={(event) => {
                if (invalidText === null || event.nativeEvent.isComposing) return
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setInvalidText(null)
                  setShowError(false)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  setShowError(true)
                }
              }}
            />
            <InputGroupAddon align='inline-end' id={`${id}-unit`}>
              px
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
      <Slider
        aria-label={label}
        aria-valuetext={`${width} px`}
        min={EDITOR_WIDTH.min}
        max={EDITOR_WIDTH.max}
        step={1}
        value={width}
        onValueChange={changeWidth}
        onPointerUp={() => persist.flush()}
        onPointerCancel={() => persist.flush()}
      />
      <div
        aria-hidden='true'
        className='relative flex justify-between text-ui-caption text-muted-foreground tabular-nums'
      >
        <span>{EDITOR_WIDTH.min} px</span>
        <span
          className='absolute whitespace-nowrap border-s border-border ps-1'
          style={{ insetInlineStart: `${defaultMark * 100}%` }}
        >
          {t(`${messages}.default`, { value: EDITOR_WIDTH.default })}
        </span>
        <span>{EDITOR_WIDTH.max} px</span>
      </div>
      {showError && (
        <p id={`${id}-error`} role='alert' className='m-0 mt-1 text-ui-caption text-destructive'>
          {t(`${messages}.invalid`, { min: EDITOR_WIDTH.min, max: EDITOR_WIDTH.max })}
        </p>
      )}
    </div>
  )
}

export default function EditorWidthSettingItem({ item }: { item: Setting.BaseSettingItem }) {
  const { t } = useTranslation()
  const id = useId()
  const mode = useAppSettingStore((state) => getEditorWidthMode(state.settingData))

  return (
    <SettingItemContainer $direction='column' $settingKey={item.key} className='@container/width'>
      <div className='flex flex-col items-start gap-2 @min-[32rem]/width:flex-row @min-[32rem]/width:items-center @min-[32rem]/width:justify-between'>
        <SettingLabel item={item} />
        <RadioGroupRoot
          aria-label={t(item.title.i18nKey)}
          orientation='horizontal'
          className='flex flex-wrap gap-x-4 gap-y-2'
          value={mode}
          onValueChange={(value) => {
            void writeSettingPatch({ [item.key]: value }).catch(() => {
              toast.error(t(`${messages}.save_failed`))
            })
          }}
        >
          {editorWidthModes.map((value) => (
            <label key={value} htmlFor={`${id}-${value}`} className='flex items-center gap-1.5'>
              <RadioGroupItem id={`${id}-${value}`} value={value} />
              {t(`${messages}.${value}`)}
            </label>
          ))}
        </RadioGroupRoot>
      </div>
      {mode === 'fixed' && <FixedWidthControls />}
    </SettingItemContainer>
  )
}
