import type { ComponentProps } from 'react'

export type DocumentArticleProps = ComponentProps<'article'>

/** Shared reading surface for pre-rendered docs and Markdown release notes. */
export default function DocumentArticle({ className, ...props }: DocumentArticleProps) {
  return <article {...props} className={['mf-document', className].filter(Boolean).join(' ')} />
}
