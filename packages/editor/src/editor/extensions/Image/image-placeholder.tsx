import { t } from '@markflowy/i18n'
import type { CSSProperties, FC } from 'react'
import styled, { css } from 'styled-components'

type ImagePlaceholderVariant = 'empty' | 'error'

interface ImagePlaceholderProps {
  errorUrl?: string
  style?: CSSProperties
  variant: ImagePlaceholderVariant
}

export function getImageSourceLabel(source?: string): string | null {
  if (!source || source.startsWith('data:')) return null

  try {
    return new URL(source).hostname
  } catch {
    const normalizedSource = source.replace(/\\/g, '/')
    return normalizedSource.split('/').filter(Boolean).at(-1) || null
  }
}

const Surface = styled.div<{ $variant: ImagePlaceholderVariant }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${(props) => props.theme.spaceSm};
  box-sizing: border-box;
  width: 220px;
  max-width: 100%;
  height: 112px;
  padding: ${(props) => props.theme.spaceSm};
  overflow: hidden;
  border: 1px dashed ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  background-color: ${(props) => props.theme.tipsBgColor};
  color: ${(props) => props.theme.labelFontColor};
  cursor: pointer;
  line-height: 1.35;
  text-align: left;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;

  ${(props) =>
    props.$variant === 'error' &&
    css`
      border-style: solid;
    `}

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-color: ${(props) => props.theme.accentColor};
      background-color: ${(props) => props.theme.bgColor};
    }
  }
`

const IconBox = styled.span<{ $variant: ImagePlaceholderVariant }>`
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  background-color: ${(props) => props.theme.bgColor};
  color: ${(props) =>
    props.$variant === 'error' ? props.theme.dangerColor : props.theme.labelFontColor};
  box-shadow: 0 1px 2px ${(props) => props.theme.boxShadowColor};

  svg {
    width: 19px;
    height: 19px;
  }
`

const ErrorBadge = styled.span`
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border: 2px solid ${(props) => props.theme.tipsBgColor};
  border-radius: 50%;
  background-color: ${(props) => props.theme.dangerColor};
  color: ${(props) => props.theme.bgColor};
  font-size: 10px;
  font-weight: 700;
`

const Copy = styled.span`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
`

const Title = styled.span`
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 600;
`

const Description = styled.span`
  color: ${(props) => props.theme.labelFontColor};
  font-size: ${(props) => props.theme.fontXs};
`

const Source = styled.span`
  max-width: 132px;
  overflow: hidden;
  color: ${(props) => props.theme.labelFontColor};
  font-family: ${(props) => props.theme.codemirrorFontFamily};
  font-size: ${(props) => props.theme.fontXs};
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ImagePlaceholder: FC<ImagePlaceholderProps> = ({ errorUrl, style, variant }) => {
  const isError = variant === 'error'
  const title = t(isError ? 'image.errorTitle' : 'image.emptyTitle')
  const description = t(isError ? 'image.errorDescription' : 'image.emptyDescription')
  const sourceLabel = isError ? getImageSourceLabel(errorUrl) : null

  return (
    <Surface $variant={variant} contentEditable={false} style={style}>
      <IconBox $variant={variant} aria-hidden='true'>
        <svg fill='none' stroke='currentColor' strokeWidth='1.6' viewBox='0 0 24 24'>
          <rect height='16' rx='2.5' width='18' x='3' y='4' />
          <circle cx='8.5' cy='9' r='1.5' />
          <path d='m5.5 17 4.2-4.2 3.1 3 2.2-2.2 3.5 3.4' />
        </svg>
        {isError ? <ErrorBadge>!</ErrorBadge> : null}
      </IconBox>
      <Copy>
        <Title>{title}</Title>
        <Description>{description}</Description>
        {sourceLabel ? <Source>{sourceLabel}</Source> : null}
      </Copy>
    </Surface>
  )
}
