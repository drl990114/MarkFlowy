import { useComponentThemeStyle } from '../Theme/components-theme'

export interface ErrorTipProps {
  errortip: string
  height?: number
  width?: number
  errorUrl?: string
}
export const ErrorTip = (props: ErrorTipProps) => {
  const { errortip, width = 100, height = 70, errorUrl } = props
  const style = useComponentThemeStyle({ width, height })

  return (
    <div
      data-mf-component=''
      data-slot='image-error'
      className='mfc:flex mfc:flex-col mfc:justify-center mfc:items-center mfc:text-destructive mfc:overflow-hidden mfc:max-w-full'
      style={style}
    >
      <div className='mfc:size-10 mfc:shrink-0'>
        <svg
          fill='none'
          stroke='currentColor'
          strokeWidth='4'
          viewBox='0 0 48 48'
          aria-hidden='true'
          focusable='false'
          className='mfc:size-full'
        >
          <path d='M41 26V9a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v30a2 2 0 0 0 2 2h17' />
          <path d='m24 33 9-8.5V27s-2 1-3.5 2.5C27.841 31.159 27 33 27 33h-3Zm0 0-3.5-4.5L17 33h7Z' />
          <path
            fill='currentColor'
            stroke='none'
            d='M20.5 28.5 17 33h7l-3.5-4.5ZM33 24.5 24 33h3s.841-1.841 2.5-3.5C31 28 33 27 33 27v-2.5Z'
          />
          <path
            fill='currentColor'
            fillRule='evenodd'
            stroke='none'
            d='M46 38a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-4.95-4.782 1.74 1.74-3.045 3.046 3.046 3.046-1.74 1.74-3.047-3.045-3.046 3.046-1.74-1.74 3.046-3.047-3.046-3.046 1.74-1.74 3.046 3.046 3.046-3.046Z'
            clipRule='evenodd'
          />
          <path d='M17 15h-2v2h2v-2Z' />
        </svg>
      </div>

      <span className='mfc:text-xs mfc:leading-relaxed mfc:text-center mfc:px-4 mfc:py-2 mfc:max-w-full mfc:box-border'>
        {errortip}
      </span>
      {errorUrl ? (
        <span
          className='mfc:max-w-full mfc:text-xs mfc:leading-normal mfc:text-muted-foreground mfc:px-3 mfc:break-all mfc:text-center mfc:line-clamp-2 mfc:box-border'
          title={errorUrl}
        >
          {errorUrl}
        </span>
      ) : null}
    </div>
  )
}
export default ErrorTip
