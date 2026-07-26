import { useTranslation } from 'next-i18next'
import styled, { css } from 'styled-components'
import { mobile } from '../utils/media'
import type { DocsTableOfContentsItem } from '../utils/docsTableOfContents'

interface DocsTableOfContentsProps {
  items: DocsTableOfContentsItem[]
}

const DocsTableOfContents = ({ items }: DocsTableOfContentsProps) => {
  const { t } = useTranslation()

  if (items.length === 0) {
    return null
  }

  const label = t('docs.tableOfContents')

  return (
    <TableOfContents aria-label={label}>
      <TableOfContentsTitle>{label}</TableOfContentsTitle>
      <TableOfContentsList>
        {items.map((item) => (
          <TableOfContentsListItem key={item.id}>
            <TableOfContentsLink href={`#${item.id}`} $isNested={item.level === 3}>
              {item.title}
            </TableOfContentsLink>
          </TableOfContentsListItem>
        ))}
      </TableOfContentsList>
    </TableOfContents>
  )
}

export default DocsTableOfContents

const TableOfContents = styled.aside`
  position: fixed;
  top: 4rem;
  right: 1.5rem;
  width: 13rem;
  max-height: calc(100vh - 5.5rem);
  padding: 0.25rem 0 1.5rem;
  box-sizing: border-box;
  overflow-y: auto;
  color: var(--ink-mute);
  font-family: var(--body);
  scrollbar-color: var(--line) transparent;
  scrollbar-width: thin;

  ${mobile(css`
    display: none;
  `)}

  @media (max-width: 75.999rem) {
    display: none;
  }
`

const TableOfContentsTitle = styled.p`
  margin: 0 0 0.75rem;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25rem;
`

const TableOfContentsList = styled.ul`
  display: grid;
  gap: 0.125rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const TableOfContentsListItem = styled.li`
  min-width: 0;
`

const TableOfContentsLink = styled.a<{ $isNested: boolean }>`
  display: block;
  min-height: 1.75rem;
  padding: 0.25rem 0.25rem 0.25rem ${({ $isNested }) => ($isNested ? '1rem' : '0')};
  border-radius: 0.375rem;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  color: var(--ink-mute);
  font-size: 0.8125rem;
  line-height: 1.25rem;
  text-decoration: none;
  touch-action: manipulation;
  transition:
    background-color 150ms ease,
    color 150ms ease;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: color-mix(in srgb, var(--ink) 5%, transparent);
      color: var(--ink);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`
