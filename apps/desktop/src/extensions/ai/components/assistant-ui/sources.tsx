import type { SourceMessagePartComponent } from '@assistant-ui/react'
import { FileTextIcon, GlobeIcon } from 'lucide-react'
import { memo, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { useAssistantLink } from './link-context'

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export type SourceProps = Omit<BadgeProps, 'asChild'> & ComponentProps<'a'>

export function Source({ className, href, onClick, onKeyDown, ...props }: SourceProps) {
  const openLink = useAssistantLink()
  const activate = () => {
    if (href) void openLink?.(href)
  }

  return (
    <Badge
      asChild
      className={cn(
        'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <a
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
    </Badge>
  )
}

export function SourceTitle({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('max-w-40 truncate', className)} {...props} />
}

const SourcesImpl: SourceMessagePartComponent = (part) => {
  if (part.sourceType === 'url' && part.url) {
    const title = part.title || extractDomain(part.url)
    return (
      <Source href={part.url} title={title}>
        <GlobeIcon aria-hidden='true' />
        <SourceTitle>{title}</SourceTitle>
      </Source>
    )
  }

  if (part.sourceType === 'document') {
    return (
      <Badge variant='secondary'>
        <FileTextIcon aria-hidden='true' />
        <SourceTitle>{part.title}</SourceTitle>
      </Badge>
    )
  }

  return null
}

export const Sources = memo(SourcesImpl) as unknown as SourceMessagePartComponent
