import '@assistant-ui/react-markdown/styles/dot.css'

import {
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
  type CodeHeaderProps,
} from '@assistant-ui/react-markdown'
import { CheckIcon, CopyIcon } from 'lucide-react'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FC,
  type PropsWithChildren,
} from 'react'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'
import { TooltipIconButton } from './tooltip-icon-button'
import { useAssistantLink } from './link-context'

const COPY_RESET_MS = 2_000

type MarkdownTextLabels = {
  copyCode: string
  copiedCode: string
}

const MarkdownTextLabelsContext = createContext<MarkdownTextLabels>({
  copyCode: 'Copy',
  copiedCode: 'Copied',
})

export type MarkdownTextProviderProps = PropsWithChildren<Partial<MarkdownTextLabels>>

export function MarkdownTextProvider({
  children,
  copyCode,
  copiedCode,
}: MarkdownTextProviderProps) {
  const labels = useMemo(
    () => ({ copyCode: copyCode ?? 'Copy', copiedCode: copiedCode ?? 'Copied' }),
    [copiedCode, copyCode],
  )
  return (
    <MarkdownTextLabelsContext.Provider value={labels}>
      {children}
    </MarkdownTextLabelsContext.Provider>
  )
}

function MarkdownAnchor({ className, href, onClick, onKeyDown, ...props }: ComponentProps<'a'>) {
  const openLink = useAssistantLink()
  const activate = () => {
    if (href) void openLink?.(href)
  }

  return (
    <a
      className={cn('text-primary underline underline-offset-2 hover:opacity-80', className)}
      data-href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || !href) return
        event.preventDefault()
        activate()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        activate()
      }}
      {...props}
      rel='noopener noreferrer'
      role='link'
      tabIndex={0}
    />
  )
}

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    [],
  )

  const copy = useCallback(async (value: string) => {
    if (!value || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      setCopied(false)
    }
  }, [])

  return { copied, copy }
}

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { copied, copy } = useCopyToClipboard()
  const labels = useContext(MarkdownTextLabelsContext)

  return (
    <div className='mt-2 flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-muted px-2.5 py-1 text-xs'>
      <span className='font-medium lowercase text-muted-foreground'>{language}</span>
      <TooltipIconButton
        className='size-5'
        onClick={() => void copy(code ?? '')}
        tooltip={copied ? labels.copiedCode : labels.copyCode}
      >
        {copied ? <CheckIcon className='size-3.5' /> : <CopyIcon className='size-3.5' />}
      </TooltipIconButton>
    </div>
  )
}

const markdownComponents = memoizeMarkdownComponents({
  a: MarkdownAnchor,
  h1: ({ className, ...props }) => (
    <h1 className={cn('mb-1.5 mt-4 text-xl font-semibold first:mt-0', className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn('mb-1.5 mt-4 text-lg font-semibold first:mt-0', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('mb-1 mt-3 text-base font-semibold first:mt-0', className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn('my-2 leading-relaxed first:mt-0 last:mb-0', className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn('my-2 border-s-2 border-border ps-3 text-muted-foreground', className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn('my-2 ms-4 list-disc marker:text-muted-foreground [&>li]:mt-0.5', className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn('my-2 ms-4 list-decimal marker:text-muted-foreground [&>li]:mt-0.5', className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className='my-2 overflow-x-auto'>
      <table className={cn('w-full border-separate border-spacing-0', className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th className={cn('bg-muted px-2 py-1 text-start font-medium', className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        'border-b border-s border-border px-2 py-1 text-start last:border-e',
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        'overflow-x-auto rounded-b-lg rounded-t-none border border-t-0 border-border bg-muted p-2.5 text-xs leading-relaxed',
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isBlock = useIsMarkdownCodeBlock()
    return (
      <code
        className={cn(
          !isBlock && 'rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]',
          className,
        )}
        {...props}
      />
    )
  },
  CodeHeader,
})

function MarkdownTextImpl() {
  return (
    <MarkdownTextPrimitive
      className='aui-md text-ui-body'
      components={markdownComponents}
      defer
      remarkPlugins={[remarkGfm]}
    />
  )
}

export const MarkdownText = memo(MarkdownTextImpl)
