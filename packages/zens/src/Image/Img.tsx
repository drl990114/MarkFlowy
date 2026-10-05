import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from 'react'
import { useComponentThemeStyle } from '../Theme/components-theme'
import { cn } from '../lib/cn'

import { ImageEmpty } from './ImageEmpty'
import imagePromiseFactory from './imagePromiseFactory'
import useImage, { type useImageProps } from './use-image'

export type ImgProps = Omit<
  React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>,
  'src'
> &
  Omit<useImageProps, 'srcList'> & {
    src: useImageProps['srcList'] // same types, different name
    loader?: ReactElement | null
    unloader?: ReactElement | null
    loaderStyle?: React.CSSProperties
    unloaderStyle?: React.CSSProperties
    emptyStyle?: React.CSSProperties
    placeholderStyle?: React.CSSProperties
    decode?: boolean
    crossorigin?: string
    container?: (children: ReactNode) => ReactNode
    loaderContainer?: (children: ReactNode) => ReactNode
    unloaderContainer?: (children: ReactNode) => ReactNode
    lazy?: boolean
    lazyRoot?: Element | null
    lazyRootMargin?: string
    lazyThreshold?: number | number[]
    lazyPlaceholder?: ReactElement | null
    emptyImage?: ReactElement | null
    emptyTip?: string
  }

const passthroughContainer = (children: ReactNode) => children
const containerClassName =
  'mfc:inline-flex mfc:items-center mfc:justify-center mfc:border mfc:border-border mfc:rounded-sm mfc:bg-muted mfc:text-muted-foreground mfc:box-border'

const useContainerStyle = (baseStyle: React.CSSProperties, customStyle?: React.CSSProperties) =>
  useComponentThemeStyle({ ...baseStyle, ...customStyle })

function Img({
  decode = true,
  src: srcList = [],
  loader = null,
  unloader = null,
  loaderStyle,
  unloaderStyle,
  emptyStyle,
  placeholderStyle,
  container = passthroughContainer,
  loaderContainer = passthroughContainer,
  unloaderContainer = passthroughContainer,
  imgPromise,
  crossorigin,
  useSuspense = false,
  emptyImage = null,
  emptyTip,
  lazy = false,
  lazyRoot = null,
  lazyRootMargin = '0px',
  lazyThreshold = 0,
  lazyPlaceholder = null,
  ref,
  ...imgProps
}: ImgProps): ReactNode {
  const resolvedImgPromise = imgPromise || imagePromiseFactory({ decode, crossOrigin: crossorigin })
  const [isInView, setIsInView] = useState(!lazy)
  const [failedRenderedSrc, setFailedRenderedSrc] = useState<string | null>(null)
  const lazyRef = useRef<HTMLSpanElement | null>(null)
  const shouldLoad = !lazy || isInView
  const resolvedSrcList = shouldLoad ? srcList : []

  const isSourceEmpty = useMemo(() => {
    if (!srcList) return true
    if (Array.isArray(srcList)) return srcList.length === 0
    return srcList.length === 0
  }, [srcList])

  const baseSizeStyle = useMemo(
    () => ({
      width: imgProps.width,
      height: imgProps.height,
    }),
    [imgProps.height, imgProps.width],
  )

  const placeholderContainerStyle = useContainerStyle(baseSizeStyle, {
    ...imgProps.style,
    ...placeholderStyle,
  })

  const loaderContainerStyle = useContainerStyle(baseSizeStyle, loaderStyle)

  const unloaderContainerStyle = useContainerStyle(baseSizeStyle, unloaderStyle)

  const emptyContainerStyle = useContainerStyle(baseSizeStyle, emptyStyle)

  const emptyNode = useMemo(
    () => emptyImage || <ImageEmpty emptyTip={emptyTip} style={emptyContainerStyle} />,
    [emptyImage, emptyTip, emptyContainerStyle],
  )

  const errorUrl = useMemo(() => {
    if (!srcList) return undefined
    if (Array.isArray(srcList)) return srcList[0]
    return srcList
  }, [srcList])

  const imageStyle = useComponentThemeStyle(imgProps.style)
  const resolvedImgProps = {
    ...imgProps,
    style: imageStyle,
    loading: imgProps.loading ?? (lazy ? 'lazy' : imgProps.loading),
  }

  const { src, isLoading } = useImage({
    srcList: resolvedSrcList,
    imgPromise: resolvedImgPromise,
    useSuspense,
  })

  useEffect(() => {
    if (!lazy || isInView || !lazyRef.current) return

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting || entry?.intersectionRatio > 0) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        root: lazyRoot || null,
        rootMargin: lazyRootMargin,
        threshold: lazyThreshold,
      },
    )

    observer.observe(lazyRef.current)
    return () => observer.disconnect()
  }, [isInView, lazy, lazyRoot, lazyRootMargin, lazyThreshold])

  if (lazy && !isInView) {
    if (isSourceEmpty) return container(emptyNode)

    const resolvedPlaceholder = lazyPlaceholder ?? loader
    const placeholderNode = (
      <span
        data-mf-component=''
        className={containerClassName}
        ref={lazyRef}
        style={placeholderContainerStyle}
      >
        {resolvedPlaceholder ? loaderContainer(resolvedPlaceholder) : null}
      </span>
    )
    return container(placeholderNode)
  }

  if (isSourceEmpty && !isLoading) {
    return container(emptyNode)
  }

  if (src && failedRenderedSrc !== src) {
    const { onError, ...imageProps } = resolvedImgProps
    return container(
      <img
        {...imageProps}
        ref={ref}
        src={src}
        onError={(event) => {
          setFailedRenderedSrc(src)
          onError?.(event)
        }}
      />,
    )
  }

  if (!useSuspense && isLoading) {
    const loaderNode = loader ? (
      <span data-mf-component='' className={containerClassName} style={loaderContainerStyle}>
        {loader}
      </span>
    ) : null
    return loaderContainer(loaderNode)
  }

  if (!useSuspense && unloader) {
    const resolvedUnloader = React.isValidElement<{ errorUrl?: string }>(unloader)
      ? React.cloneElement(unloader, { errorUrl })
      : unloader
    const unloaderNode = (
      <span
        data-mf-component=''
        className={cn(containerClassName, 'mfc:border-destructive mfc:text-destructive')}
        style={unloaderContainerStyle}
      >
        {resolvedUnloader}
      </span>
    )
    return unloaderContainer(unloaderNode)
  }

  return null
}

export default Img
