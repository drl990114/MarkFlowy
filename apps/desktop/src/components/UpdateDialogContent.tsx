import { openUrl } from '@tauri-apps/plugin-opener'
import { CalendarDaysIcon, SparklesIcon } from 'lucide-react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { logger } from '@/helper/logger'

const DISCLOSURE_TAG_PATTERN = /<\/?(?:details|summary)(?:\s[^>]*)?>/gi
const EXTERNAL_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export interface UpdateDialogContentProps {
  body?: string
  locale?: string
  releaseDate?: string
  releaseDateLabel: string
  version: string
}

function normalizeReleaseNotes(body?: string) {
  return body?.replace(DISCLOSURE_TAG_PATTERN, '\n').trim() ?? ''
}

function formatReleaseDate(releaseDate?: string, locale?: string) {
  if (!releaseDate) return undefined

  const date = new Date(releaseDate)
  if (Number.isNaN(date.getTime())) {
    return releaseDate.split('.')[0].replace('T', ' ')
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

function isExternalLink(href?: string): href is string {
  if (!href) return false

  try {
    return EXTERNAL_LINK_PROTOCOLS.has(new URL(href).protocol)
  } catch {
    return false
  }
}

const updateMarkdownComponents: Components = {
  a: (props) => {
    const href = isExternalLink(props.href) ? props.href : undefined

    return (
      <a
        className='font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary'
        href={href}
        onClick={(event) => {
          event.preventDefault()
          if (!href) return

          void openUrl(href).catch((error) => {
            logger.error('Open update release link error:', error)
          })
        }}
        rel='noopener noreferrer'
        title={props.title}
      >
        {props.children}
      </a>
    )
  },
}

export function UpdateDialogContent({
  body,
  locale,
  releaseDate,
  releaseDateLabel,
  version,
}: UpdateDialogContentProps) {
  const formattedReleaseDate = formatReleaseDate(releaseDate, locale)
  const releaseNotes = normalizeReleaseNotes(body)

  return (
    <div className='flex flex-col gap-4 text-foreground'>
      <div className='flex items-center gap-3 rounded-lg border border-border bg-primary-soft px-3.5 py-3'>
        <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm'>
          <SparklesIcon className='size-4.5' aria-hidden='true' />
        </span>

        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold'>MarkFlowy {version}</p>
          {formattedReleaseDate ? (
            <p className='mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground'>
              <CalendarDaysIcon className='size-3.5 shrink-0' aria-hidden='true' />
              <span>{releaseDateLabel}</span>
              <time dateTime={releaseDate}>{formattedReleaseDate}</time>
            </p>
          ) : null}
        </div>
      </div>

      {releaseNotes ? (
        <div className='overflow-x-auto rounded-lg border border-border bg-background px-4 py-3.5 text-sm leading-relaxed text-foreground-secondary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring [&_a]:focus-visible:ring-offset-1 [&_a]:focus-visible:ring-offset-background [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/50 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:font-semibold [&_h4]:text-foreground [&_hr]:my-4 [&_hr]:border-t [&_hr]:border-border [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_input]:me-2 [&_input]:align-middle [&_li]:my-1 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-2.5 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:my-3 [&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_td]:border-b [&_td]:border-s [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5 [&_td:last-child]:border-e [&_th]:border-b [&_th]:border-s [&_th]:border-t [&_th]:border-border [&_th]:bg-muted [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-start [&_th]:font-semibold [&_th]:text-foreground [&_th:last-child]:border-e [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:ps-5'>
          <Markdown components={updateMarkdownComponents} remarkPlugins={[remarkGfm]}>
            {releaseNotes}
          </Markdown>
        </div>
      ) : null}
    </div>
  )
}
