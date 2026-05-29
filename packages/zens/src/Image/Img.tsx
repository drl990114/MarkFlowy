// @ts-nocheck
import React, { forwardRef, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeContext } from 'styled-components';

import { ImageEmpty } from './ImageEmpty';
import imagePromiseFactory from './imagePromiseFactory';
import useImage, { useImageProps } from './use-image';

export type ImgProps = Omit<
  React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>,
  'src'
> &
  Omit<useImageProps, 'srcList'> & {
    src: useImageProps['srcList']; // same types, different name
    loader?: JSX.Element | null;
    unloader?: JSX.Element | null;
    loaderStyle?: React.CSSProperties;
    unloaderStyle?: React.CSSProperties;
    emptyStyle?: React.CSSProperties;
    placeholderStyle?: React.CSSProperties;
    decode?: boolean;
    crossorigin?: string;
    container?: (children: React.ReactNode) => JSX.Element;
    loaderContainer?: (children: React.ReactNode) => JSX.Element;
    unloaderContainer?: (children: React.ReactNode) => JSX.Element;
    lazy?: boolean;
    lazyRoot?: Element | null;
    lazyRootMargin?: string;
    lazyThreshold?: number | number[];
    lazyPlaceholder?: JSX.Element | null;
  };

const passthroughContainer = (x) => x;

const useContainerStyle = (
  baseStyle: React.CSSProperties,
  theme: any,
  customStyle?: React.CSSProperties,
) => {
  return useMemo(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme?.tipsBgColor,
    border: `1px solid ${theme?.borderColor}`,
    borderRadius: theme?.smallBorderRadius ?? 6,
    color: theme?.secondaryFontColor,
    boxSizing: 'border-box',
    ...baseStyle,
    ...customStyle,
  }), [baseStyle, theme, customStyle]);
};

function Img(
  {
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
    ...imgProps
  }: ImgProps,
  ref,
): JSX.Element | null {
  const theme = useContext(ThemeContext);
  imgPromise = imgPromise || imagePromiseFactory({ decode, crossOrigin: crossorigin });
  const [isInView, setIsInView] = useState(!lazy);
  const lazyRef = useRef<HTMLSpanElement | null>(null);
  const shouldLoad = !lazy || isInView;
  const resolvedSrcList = shouldLoad ? srcList : [];

  const isSourceEmpty = useMemo(() => {
    if (!srcList) return true;
    if (Array.isArray(srcList)) return srcList.length === 0;
    return srcList.length === 0;
  }, [srcList]);

  const baseSizeStyle = useMemo(
    () => ({
      width: imgProps.width,
      height: imgProps.height,
    }),
    [imgProps.height, imgProps.width],
  );

  const placeholderContainerStyle = useContainerStyle(baseSizeStyle, theme, {
    ...imgProps.style,
    ...placeholderStyle,
  });

  const loaderContainerStyle = useContainerStyle(baseSizeStyle, theme, loaderStyle);

  const unloaderContainerStyle = useContainerStyle(baseSizeStyle, theme, {
    background: theme?.tipsBgColor,
    border: `1px solid ${theme?.dangerColor}`,
    color: theme?.dangerColor,
    ...unloaderStyle,
  });

  const emptyContainerStyle = useContainerStyle(baseSizeStyle, theme, emptyStyle);

  const emptyNode = useMemo(
    () => emptyImage || <ImageEmpty emptyTip={emptyTip} style={emptyContainerStyle} />,
    [emptyImage, emptyTip, emptyContainerStyle],
  );

  const errorUrl = useMemo(() => {
    if (!srcList) return undefined;
    if (Array.isArray(srcList)) return srcList[0];
    return srcList;
  }, [srcList]);

  const resolvedImgProps = {
    ...imgProps,
    loading: imgProps.loading ?? (lazy ? 'lazy' : imgProps.loading),
  };

  const { src, isLoading, error } = useImage({
    srcList: resolvedSrcList,
    imgPromise,
    useSuspense,
  });

  useEffect(() => {
    if (!lazy || isInView || !lazyRef.current) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting || entry?.intersectionRatio > 0) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        root: lazyRoot || null,
        rootMargin: lazyRootMargin,
        threshold: lazyThreshold,
      },
    );

    observer.observe(lazyRef.current);
    return () => observer.disconnect();
  }, [isInView, lazy, lazyRoot, lazyRootMargin, lazyThreshold]);

  if (lazy && !isInView) {
    if (isSourceEmpty) return container(emptyNode);

    const resolvedPlaceholder = lazyPlaceholder ?? loader;
    const placeholderNode = (
      <span ref={lazyRef} style={placeholderContainerStyle}>
        {resolvedPlaceholder ? loaderContainer(resolvedPlaceholder) : null}
      </span>
    );
    return container(placeholderNode);
  }

  if (isSourceEmpty && !isLoading) {
    return container(emptyNode);
  }

  if (src) {
    return container(<img src={src} {...resolvedImgProps} ref={ref} />);
  }

  if (!useSuspense && isLoading) {
    const loaderNode = loader ? <span style={loaderContainerStyle}>{loader}</span> : null;
    return loaderContainer(loaderNode);
  }

  if (!useSuspense && unloader) {
    const resolvedUnloader = React.isValidElement(unloader)
      ? React.cloneElement(unloader, { errorUrl })
      : unloader;
    const unloaderNode = <span style={unloaderContainerStyle}>{resolvedUnloader}</span>;
    return unloaderContainer(unloaderNode);
  }

  return null;
}

export default forwardRef<HTMLImageElement, ImgProps>(Img);
