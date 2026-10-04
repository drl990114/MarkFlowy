import { useTranslation } from 'next-i18next'
import styled from 'styled-components'
import type { DocsTableOfContentsItem } from '../utils/docsTableOfContents'
import { sidebarWidth } from '../utils/sizes'

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
  top: 8rem;
  right: max(1.5rem, calc((100vw - ${sidebarWidth / 16}rem - 69rem) / 2 + 1.5rem));
  width: 13rem;
  max-height: calc(100vh - 9rem);
  padding: 0.25rem 0 1.5rem;
  box-sizing: border-box;
  overflow-y: auto;
  color: var(--ink-mute);
  font-family: var(--body);
  scrollbar-color: var(--line) transparent;
  scrollbar-width: thin;

  @media (max-width: 75.999rem) {
    display: none;
  }
`

const TableOfContentsTitle = styled.p`
  margin: 0 0 0.75rem;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25rem;
`

const TableOfContentsList = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  border-left: 1px solid var(--line-soft);
  list-style: none;
`

const TableOfContentsListItem = styled.li`
  min-width: 0;
`

const TableOfContentsLink = styled.a<{ $isNested: boolean }>`
  display: block;
  min-height: 2rem;
  margin-left: -1px;
  padding: 0.375rem 0.5rem 0.375rem ${({ $isNested }) => ($isNested ? '1.5rem' : '0.875rem')};
  border-left: 2px solid transparent;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  color: var(--ink-mute);
  font-size: 0.8125rem;
  line-height: 1.25rem;
  text-decoration: none;
  touch-action: manipulation;
  transition:
    border-color 150ms ease,
    color 150ms ease;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: -2px;
    color: var(--seal);
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-left-color: var(--seal);
      color: var(--seal);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`
