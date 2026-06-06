import { useRemirrorContext } from '@rme-sdk/react-core'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import type { LinkClickHandler } from '../../extensions/LinkClick'
import { editorZIndex } from '../../theme/z-index'
import { isBrowser } from '../../utils/common'

interface LinkHoverIconProps {
  handleLinkClick?: LinkClickHandler
}

const defaultLinkClickHandler: LinkClickHandler = (href: string, event: MouseEvent) => {
  if (isBrowser()) {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  return true
}

export const LinkHoverIcon = memo((props: LinkHoverIconProps) => {
  const { handleLinkClick } = props
  const { view } = useRemirrorContext({ autoUpdate: false })
  const [linkInfo, setLinkInfo] = useState<{
    href: string
    rect: DOMRect
    element: HTMLAnchorElement
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<number | null>(null)

  const handleMouseOver = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const linkElement = target.closest('a')

      if (!linkElement) {
        return
      }

      const href = linkElement.getAttribute('href')
      if (!href) {
        return
      }

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      const rect = linkElement.getBoundingClientRect()
      setLinkInfo({ href, rect, element: linkElement })
    },
    [],
  )

  const handleMouseOut = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement
    const relatedTarget = event.relatedTarget as HTMLElement | null

    if (linkInfo && containerRef.current) {
      if (
        containerRef.current.contains(relatedTarget) ||
        linkInfo.element.contains(relatedTarget)
      ) {
        return
      }
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    hideTimeoutRef.current = window.setTimeout(() => {
      setLinkInfo(null)
    }, 100)
  }, [])

  const handleIconClick = useCallback(
    (event: React.MouseEvent) => {
      if (!linkInfo) return

      event.preventDefault()
      event.stopPropagation()

      const handler = handleLinkClick || defaultLinkClickHandler
      handler(linkInfo.href, event.nativeEvent)

      setLinkInfo(null)
    },
    [linkInfo, handleLinkClick],
  )

  const handleIconMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const handleIconMouseLeave = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    hideTimeoutRef.current = window.setTimeout(() => {
      setLinkInfo(null)
    }, 100)
  }, [])

  useEffect(() => {
    if (!view?.dom) return

    const editorDom = view.dom

    editorDom.addEventListener('mouseover', handleMouseOver)
    editorDom.addEventListener('mouseout', handleMouseOut)

    return () => {
      editorDom.removeEventListener('mouseover', handleMouseOver)
      editorDom.removeEventListener('mouseout', handleMouseOut)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [view?.dom, handleMouseOver, handleMouseOut])

  if (!linkInfo) {
    return null
  }

  return (
    <Container
      ref={containerRef}
      onClick={handleIconClick}
      onMouseEnter={handleIconMouseEnter}
      onMouseLeave={handleIconMouseLeave}
      style={{
        position: 'fixed',
        left: linkInfo.rect.right + 4,
        top: linkInfo.rect.top - 4,
      }}
    >
      <IconWrapper>
        <i className="ri-external-link-line" />
      </IconWrapper>
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background-color: ${(props) => props.theme.bgColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  cursor: pointer;
  z-index: ${editorZIndex.dropdown};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: ${(props) => props.theme.contextMenuBgColorHover};
  }
`

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${(props) => props.theme.textColor};
`
