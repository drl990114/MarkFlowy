import styled from 'styled-components'
import rem from '../utils/rem'
import { navbarHeight } from '../utils/sizes'
import type { DocsTableOfContentsItem } from '../utils/docsTableOfContents'
import DocsTableOfContents from './DocsTableOfContents'

type DocsContentProps = {
  html: string
  tableOfContents?: DocsTableOfContentsItem[]
}

const DocsContent = ({ html, tableOfContents = [] }: DocsContentProps) => {
  return (
    <>
      <DocsArticle dangerouslySetInnerHTML={{ __html: html }} />
      <DocsTableOfContents items={tableOfContents} />
    </>
  )
}

export default DocsContent

const DocsArticle = styled.article`
  width: 100%;
  margin: 0;
  padding-bottom: ${rem(72)};
  color: var(--ink-soft);
  font-family: var(--body);
  font-size: 1rem;
  line-height: 1.5rem;
  overflow-wrap: anywhere;

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: var(--ink);
    font-family: var(--sans);
    font-weight: 500;
    text-wrap: balance;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    letter-spacing: -0.025em;
    line-height: 2rem;
  }

  h2 {
    margin: 2.5rem 0 1rem;
    font-size: 1.25rem;
    letter-spacing: -0.02em;
    line-height: 1.75rem;
  }

  h3 {
    margin: 2rem 0 0.75rem;
    font-size: 1rem;
    line-height: 1.5rem;
  }

  h4,
  h5,
  h6 {
    margin: 1.5rem 0 0.5rem;
    font-size: 0.9375rem;
    line-height: 1.375rem;
  }

  :is(h1, h2, h3, h4, h5, h6)[id] {
    scroll-margin-top: calc(${rem(navbarHeight)} + ${rem(24)});
  }

  p,
  ul,
  ol,
  blockquote,
  pre,
  table {
    margin: 1rem 0;
  }

  ul,
  ol {
    padding-left: ${rem(24)};
  }

  li {
    margin: 0.25rem 0;
  }

  li::marker {
    color: var(--ink-mute);
  }

  a {
    color: var(--seal-soft);
    font-weight: 500;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--seal) 48%, transparent);
    text-decoration-thickness: 1px;
    text-underline-offset: ${rem(3)};
    transition:
      color 150ms ease,
      text-decoration-color 150ms ease;

    &:focus-visible {
      border-radius: ${rem(3)};
      outline: 2px solid var(--seal);
      outline-offset: 2px;
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--ink);
        text-decoration-color: var(--seal);
      }
    }
  }

  strong {
    color: var(--ink);
  }

  code,
  kbd {
    border: 1px solid var(--line-soft);
    border-radius: ${rem(6)};
    background: var(--paper-dark);
    color: var(--ink);
    font-family: var(--mono);
    font-size: 0.88em;
  }

  :not(pre) > code {
    padding: ${rem(2)} ${rem(6)};
  }

  pre {
    max-width: 100%;
    overflow-x: auto;
    padding: 1rem;
    border: 1px solid var(--line-soft);
    border-radius: 0.75rem;
    background: var(--paper-deep);
    overscroll-behavior-x: contain;
  }

  pre code {
    padding: 0;
    border: 0;
    background: transparent;
    line-height: 1.65;
    overflow-wrap: normal;
    white-space: pre;
  }

  blockquote {
    padding: 0.125rem 0 0.125rem 1rem;
    border-left: ${rem(2)} solid var(--line);
    color: var(--ink-mute);
  }

  blockquote > :first-child {
    margin-top: 0;
  }

  blockquote > :last-child {
    margin-bottom: 0;
  }

  table {
    display: block;
    width: max-content;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    overscroll-behavior-x: contain;
  }

  th,
  td {
    padding: ${rem(10)} ${rem(14)};
    border: 1px solid var(--line-soft);
    text-align: left;
  }

  th {
    background: var(--paper-warm);
    color: var(--ink);
    font-family: var(--sans);
    font-weight: 500;
  }

  tr:nth-child(even) td {
    background: color-mix(in srgb, var(--paper-warm) 52%, transparent);
  }

  img {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--line-soft);
    border-radius: 0.75rem;
  }

  hr {
    margin: ${rem(44)} 0;
    border: 0;
    border-top: 1px solid var(--line-soft);
  }

  @media (prefers-reduced-motion: reduce) {
    a {
      transition-duration: 0ms;
    }
  }
`
