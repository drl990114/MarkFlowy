import { openUrl } from '@tauri-apps/plugin-opener'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { logger } from '@/helper/logger'
import { cn } from '@/lib/cn'

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
    <div className='flex min-w-0 flex-col gap-3 text-content-primary'>
      <div
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
          releaseNotes && 'border-b border-border pb-3',
        )}
        data-slot='update-release-meta'
      >
        <p className='min-w-0 break-words text-ui-control font-medium'>MarkFlowy {version}</p>
        {formattedReleaseDate ? (
          <p className='flex flex-wrap items-baseline gap-x-1.5 text-ui-caption text-content-muted'>
            <span>{releaseDateLabel}</span>
            <time dateTime={releaseDate}>{formattedReleaseDate}</time>
          </p>
        ) : null}
      </div>

      {releaseNotes ? (
        <div
          className={cn(
            'min-w-0 overflow-x-auto text-ui-control leading-relaxed text-content-primary [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            '[&_a]:outline-none [&_a]:focus-visible:underline [&_a]:focus-visible:underline-offset-2 [&_p]:my-2 [&_strong]:font-medium',
            '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-ui-title [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-ui-body [&_h2]:font-semibold',
            '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-ui-control [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-ui-control [&_h4]:font-medium',
            '[&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-ui-control [&_h5]:font-medium [&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-ui-control [&_h6]:font-medium',
            '[&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-5 [&_li>p]:my-1 [&_li>ol]:my-1 [&_li>ul]:my-1 [&_input]:me-2 [&_input]:align-middle',
            '[&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-content-secondary [&_hr]:my-3 [&_hr]:border-t [&_hr]:border-border',
            '[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]',
            '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-ui-caption [&_pre_code]:bg-transparent [&_pre_code]:p-0',
            '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-start [&_th]:font-medium',
            '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-sm',
          )}
          data-slot='update-release-notes'
        >
          <Markdown components={updateMarkdownComponents} remarkPlugins={[remarkGfm]}>
            {releaseNotes}
          </Markdown>
        </div>
      ) : null}
    </div>
  )
}
