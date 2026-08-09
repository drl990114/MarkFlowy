import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { t } from '@markflowy/i18n'
import { useId, useMemo, useRef, useState, type FC } from 'react'
import styled from 'styled-components'
import { Button, Input } from 'zens'
import { editorZIndex } from '../../theme/z-index'
import type { ImageNodeViewProps } from './image-nodeview'

interface ImageToolTipsProps {
  node: NodeViewComponentProps['node']
  referInfo?: {
    label?: string
    href?: string
  }
  updateAttributes?: NodeViewComponentProps['updateAttributes']
  imageHostingHandler?: ImageNodeViewProps['imageHostingHandler']
  onRequestClose?: () => void
}

export interface EmbeddedImageSourceInfo {
  byteLength: number
  mediaType: string
}

export function getEmbeddedImageSourceInfo(src: string): EmbeddedImageSourceInfo | null {
  if (!src.startsWith('data:')) return null
  const separatorIndex = src.indexOf(',')
  if (separatorIndex < 0) return null

  const metadata = src.slice(5, separatorIndex)
  const parts = metadata.split(';')
  const mediaType = parts[0] || 'text/plain'
  const payloadLength = src.length - separatorIndex - 1
  const isBase64 = parts.includes('base64')

  if (!isBase64) {
    return { byteLength: payloadLength, mediaType }
  }

  const padding = src.endsWith('==') ? 2 : src.endsWith('=') ? 1 : 0
  return {
    byteLength: Math.max(0, Math.floor((payloadLength * 3) / 4) - padding),
    mediaType,
  }
}

export function formatImageByteLength(byteLength: number): string {
  if (byteLength < 1024) return `${byteLength} B`
  const units = ['KB', 'MB', 'GB']
  let value = byteLength / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spaceSm};
  box-sizing: border-box;
  width: min(360px, calc(100vw - 32px));
  padding: ${(props) => props.theme.spaceSm};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontBase};
  line-height: 1.4;
  z-index: ${editorZIndex.imageToolTips};
`

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spaceXs};
`

const Label = styled.label`
  margin: 0;
  color: ${(props) => props.theme.labelFontColor};
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 600;
`

const StyledInput = styled(Input)`
  width: 100%;
  font-family: ${(props) => props.theme.codemirrorFontFamily};
  font-size: ${(props) => props.theme.fontSm};
`

const EmbeddedSource = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(props) => props.theme.spaceSm};
  min-height: 44px;
  padding: ${(props) => props.theme.spaceXs} ${(props) => props.theme.spaceSm};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  background-color: ${(props) => props.theme.tipsBgColor};
`

const EmbeddedSourceText = styled.div`
  min-width: 0;
`

const EmbeddedSourceTitle = styled.div`
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
`

const EmbeddedSourceMeta = styled.div`
  overflow: hidden;
  color: ${(props) => props.theme.labelFontColor};
  font-family: ${(props) => props.theme.codemirrorFontFamily};
  font-size: ${(props) => props.theme.fontXs};
  text-overflow: ellipsis;
  white-space: nowrap;
`

const FooterBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${(props) => props.theme.spaceXs};
  padding-top: ${(props) => props.theme.spaceXs};
  border-top: 1px solid ${(props) => props.theme.borderColor};
`

const ActionButton = styled(Button)`
  min-width: 68px;
`

const ErrorMessage = styled.p`
  margin: 0;
  color: ${(props) => props.theme.dangerColor};
  font-size: ${(props) => props.theme.fontXs};
`

export const ImageToolTips: FC<ImageToolTipsProps> = (props) => {
  const { node, referInfo, imageHostingHandler, onRequestClose } = props
  const src = (node.attrs.src as string | null | undefined) || ''
  const alt = (node.attrs.alt as string | null | undefined) || ''
  const referLabel =
    referInfo?.label || ((node.attrs['data-refer-label'] as string | null | undefined) ?? '')
  const embeddedSource = useMemo(() => getEmbeddedImageSourceInfo(src), [src])
  const [showSourceInput, setShowSourceInput] = useState(!embeddedSource)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const sourceInputRef = useRef<HTMLInputElement>(null)
  const altInputRef = useRef<HTMLInputElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const sourceInputId = useId()
  const altInputId = useId()
  const labelInputId = useId()

  const isReferImage = !!node.attrs['data-refer-label']

  const handleUpdate = async () => {
    if (!props.updateAttributes || saveStatus === 'saving') return
    const nextAlt = altInputRef.current?.value.trim() ?? alt.trim()

    if (isReferImage) {
      props.updateAttributes({
        'data-refer-label': labelInputRef.current?.value.trim() ?? referLabel.trim(),
        alt: nextAlt,
      })
      onRequestClose?.()
      return
    }

    const sourceInputValue = sourceInputRef.current?.value.trim()
    const nextSrc = embeddedSource && !sourceInputValue ? src : (sourceInputValue ?? src)

    try {
      setSaveStatus('saving')
      const resolvedSrc =
        imageHostingHandler && nextSrc !== src ? await imageHostingHandler(nextSrc) : nextSrc
      props.updateAttributes({
        alt: nextAlt,
        src: resolvedSrc,
      })
      setSaveStatus('idle')
      onRequestClose?.()
    } catch {
      setSaveStatus('error')
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.stopPropagation()
      void handleUpdate()
    }
  }

  const handleContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onRequestClose?.()
    }
  }

  return (
    <Container contentEditable={false} onKeyDownCapture={handleContainerKeyDown}>
      {isReferImage ? (
        <InputGroup>
          <Label htmlFor={labelInputId}>{t('image.referenceLabel')}</Label>
          <StyledInput
            id={labelInputId}
            inputRef={labelInputRef}
            defaultValue={referLabel}
            placeholder={t('image.referenceLabelPlaceholder')}
            onKeyDown={handleKeyDown}
          />
        </InputGroup>
      ) : embeddedSource && !showSourceInput ? (
        <InputGroup>
          <Label as='span'>{t('image.source')}</Label>
          <EmbeddedSource>
            <EmbeddedSourceText>
              <EmbeddedSourceTitle>{t('image.embeddedSource')}</EmbeddedSourceTitle>
              <EmbeddedSourceMeta>
                {embeddedSource.mediaType} · {formatImageByteLength(embeddedSource.byteLength)}
              </EmbeddedSourceMeta>
            </EmbeddedSourceText>
            <Button
              btnType='default'
              size='small'
              type='button'
              onClick={() => setShowSourceInput(true)}
            >
              {t('image.replaceSource')}
            </Button>
          </EmbeddedSource>
        </InputGroup>
      ) : (
        <InputGroup>
          <Label htmlFor={sourceInputId}>{t('image.source')}</Label>
          <StyledInput
            id={sourceInputId}
            inputRef={sourceInputRef}
            defaultValue={embeddedSource ? '' : src}
            placeholder={
              embeddedSource ? t('image.replaceSourcePlaceholder') : t('image.sourcePlaceholder')
            }
            onKeyDown={handleKeyDown}
          />
        </InputGroup>
      )}

      <InputGroup>
        <Label htmlFor={altInputId}>{t('image.alt')}</Label>
        <StyledInput
          id={altInputId}
          inputRef={altInputRef}
          defaultValue={alt}
          placeholder={t('image.altPlaceholder')}
          onKeyDown={handleKeyDown}
        />
      </InputGroup>

      {saveStatus === 'error' ? (
        <ErrorMessage role='alert'>{t('image.updateError')}</ErrorMessage>
      ) : null}

      <FooterBar>
        <ActionButton
          btnType='default'
          disabled={saveStatus === 'saving'}
          size='small'
          type='button'
          onClick={onRequestClose}
        >
          {t('image.cancel')}
        </ActionButton>
        <ActionButton
          btnType='primary'
          disabled={saveStatus === 'saving'}
          size='small'
          type='button'
          onClick={() => void handleUpdate()}
        >
          {saveStatus === 'saving' ? t('image.saving') : t('image.apply')}
        </ActionButton>
      </FooterBar>
    </Container>
  )
}
