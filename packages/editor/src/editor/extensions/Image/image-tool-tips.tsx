import type { NodeViewComponentProps } from '@rme-sdk/react'
import { t } from '@markflowy/i18n'
import { useState, type FC } from 'react'
import styled from 'styled-components'
import { Button, Input } from 'zens'
import { Shortcut } from '../../toolbar/SlashMenu/SlashMenuRoot'
import { ImageNodeViewProps } from './image-nodeview'

interface ImageToolTipsProps {
  node: NodeViewComponentProps['node']
  referInfo?: {
    label?: string
    href?: string
  }
  updateAttributes?: NodeViewComponentProps['updateAttributes']
  imageHostingHandler?: ImageNodeViewProps['imageHostingHandler']
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spaceSm};
  padding: ${(props) => props.theme.spaceSm};
  min-width: 320px;
  background-color: ${(props) => props.theme.tipsBgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  box-shadow: 0 4px 12px ${(props) => props.theme.boxShadowColor};
  font-size: ${(props) => props.theme.fontBase};
  line-height: normal;
  z-index: 100;
`

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spaceXs};
`

const FooterBar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${(props) => props.theme.spaceXs};
`

const Label = styled.label`
  font-size: ${(props) => props.theme.fontXs};
  font-weight: 600;
  color: ${(props) => props.theme.labelFontColor};
  margin: 0;
`

const StyledInput = styled(Input)`
  width: 100%;
  font-size: ${(props) => props.theme.fontSm};

  & input {
    padding: ${(props) => props.theme.spaceXs} ${(props) => props.theme.spaceSm};
    border: 1px solid ${(props) => props.theme.borderColor};
    border-radius: ${(props) => props.theme.smallBorderRadius};
    background-color: ${(props) => props.theme.bgColor};
    color: ${(props) => props.theme.primaryFontColor};

    &:focus {
      border-color: ${(props) => props.theme.accentColor};
      outline: none;
      box-shadow: 0 0 0 2px ${(props) => props.theme.accentColor}33;
    }

    &::placeholder {
      color: ${(props) => props.theme.placeholderFontColor};
    }
  }
`

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${(props) => props.theme.spaceXs};
  margin-top: ${(props) => props.theme.spaceXs};
`

const ActionButton = styled(Button)`
  padding: ${(props) => props.theme.spaceXs} ${(props) => props.theme.spaceSm};
  font-size: ${(props) => props.theme.fontXs};
  border-radius: ${(props) => props.theme.smallBorderRadius};

  &.primary {
    background-color: ${(props) => props.theme.accentColor};
    border-color: ${(props) => props.theme.accentColor};
    color: white;

    &:hover {
      background-color: ${(props) => props.theme.accentColor}dd;
      border-color: ${(props) => props.theme.accentColor}dd;
    }
  }

  &.secondary {
    background-color: transparent;
    border-color: ${(props) => props.theme.borderColor};
    color: ${(props) => props.theme.primaryFontColor};

    &:hover {
      background-color: ${(props) => props.theme.hoverColor};
    }
  }
`

export const ImageToolTips: FC<ImageToolTipsProps> = (props) => {
  const { node, referInfo, imageHostingHandler } = props
  const { src, alt } = node.attrs
  const [srcVal, setSrcVal] = useState(src || '')
  const [altVal, setAltVal] = useState(alt || '')
  const [labelVal, setLabelVal] = useState(referInfo?.label || '')
  const [hasChanges, setHasChanges] = useState(false)

  const isReferImage = !!referInfo

  const handleSrcInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    const newValue = e.currentTarget.value
    setSrcVal(newValue)
    setHasChanges(newValue !== src || altVal !== alt || labelVal !== referInfo?.label)
  }

  const handleAltInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    const newValue = e.currentTarget.value
    setAltVal(newValue)
    setHasChanges(srcVal !== src || newValue !== alt || labelVal !== referInfo?.label)
  }

  const handleLabelInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    const newValue = e.currentTarget.value
    setLabelVal(newValue)
    setHasChanges(srcVal !== src || altVal !== alt || newValue !== referInfo?.label)
  }

  const handleUpdate = () => {
    if (props.updateAttributes) {
      if (isReferImage) {
        // 对于引用图片，只更新 label 和 alt
        props.updateAttributes({
          ...node.attrs,
          alt: altVal.trim(),
          referInfo: {
            ...node.attrs.referInfo,
            label: labelVal.trim(),
          },
        })
      } else {
        // 对于普通图片，更新 src 和 alt
        const currentSrc = node.attrs.src
        if (currentSrc && currentSrc !== srcVal && imageHostingHandler) {
          imageHostingHandler(currentSrc).then((newSrc) => {
            if (newSrc !== currentSrc) {
              props.updateAttributes?.({
                ...node.attrs,
                src: newSrc,
                alt: altVal.trim(),
              })
            }
          })
        } else {
          props.updateAttributes({
            ...node.attrs,
            src: srcVal.trim(),
            alt: altVal.trim(),
          })
        }
      }
      setHasChanges(false)
    }
  }

  const handleReset = () => {
    setSrcVal(src || '')
    setAltVal(alt || '')
    setLabelVal(referInfo?.label || '')
    setHasChanges(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleUpdate()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleReset()
    }
  }

  return (
    <Container>
      {isReferImage ? (
        <InputGroup>
          <Label>Refer Label</Label>
          <StyledInput
            placeholder="Enter reference label..."
            value={labelVal}
            onInput={handleLabelInput}
            onKeyDown={handleKeyPress}
          />
        </InputGroup>
      ) : (
        <InputGroup>
          <Label>URL</Label>
          <StyledInput
            placeholder="Enter image URL..."
            value={srcVal}
            onInput={handleSrcInput}
            onKeyDown={handleKeyPress}
          />
        </InputGroup>
      )}

      <InputGroup>
        <Label>Alt</Label>
        <StyledInput
          placeholder="Enter alternative text for accessibility..."
          value={altVal}
          onInput={handleAltInput}
          onKeyDown={handleKeyPress}
        />
      </InputGroup>
      <FooterBar>
        <Shortcut>
          <kbd aria-label="Esc">Esc</kbd>
          {t('slashMenu.toCancel')}
        </Shortcut>
        <Shortcut>
          <kbd aria-label="Enter">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 10 4 15 9 20"></polyline>
              <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
            </svg>
          </kbd>
          {t('slashMenu.toSelect')}
        </Shortcut>
      </FooterBar>
    </Container>
  )
}
