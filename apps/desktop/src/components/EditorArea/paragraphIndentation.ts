import type { CSSProperties } from 'react'
import './paragraphIndentation.css'

/** A presentation preference; never insert whitespace into the Markdown. */
export function paragraphIndentationStyle(enabled: boolean): CSSProperties & {
  '--mf-paragraph-first-line-indent': string
} {
  return { '--mf-paragraph-first-line-indent': enabled ? '2em' : '0' }
}
