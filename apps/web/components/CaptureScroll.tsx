import React from 'react'; // eslint-disable-line

let isMobile: boolean;
let lastWheelTimestamp: number;

if (typeof window !== 'undefined' && window.matchMedia) {
  isMobile = window.matchMedia(`(max-width: ${1000 / 16}em)`).matches;

  if (!isMobile) {
    window.addEventListener('wheel', ({ timeStamp }) => {
      lastWheelTimestamp = timeStamp;
    });
  }
}

export default function captureScroll<T extends React.ComponentType>(Component: T) {
  if (isMobile) {
    return Component;
  }

  return function CaptureScroll(props: React.ComponentProps<T>) {
    const ref = React.useRef<HTMLElement>(null);

    const handleScroll = React.useCallback((evt: Event & { deltaY: number }) => {
      if (!ref.current) return;

      // Don't access window wheel listener
      evt.stopImmediatePropagation();

      const { timeStamp, deltaY } = evt;
      const { offsetHeight, scrollHeight, scrollTop } = ref.current;

      // If the window is being scrolled, don't scroll the captured scroll area
      if (timeStamp - lastWheelTimestamp <= 400) {
        lastWheelTimestamp = timeStamp;

        evt.preventDefault();
        window.scrollBy(0, deltaY);
        return;
      }

      const maxScrollTop = scrollHeight - offsetHeight;

      // Has the scroll area reached it's beginning/end
      const hasReachedTop = deltaY < 0 && scrollTop === 0;
      const hasReachedBottom = deltaY > 0 && scrollTop >= maxScrollTop;

      // Is the trajectory overshooting the scroll area
      const isReachingTop = scrollTop + deltaY <= 0;
      const isReachingBottom = scrollTop + deltaY >= maxScrollTop;

      if (hasReachedTop || hasReachedBottom || isReachingTop || isReachingBottom) {
        evt.preventDefault();
      }

      // If we're overshooting, we need to set the maximum available position
      if (isReachingTop || isReachingBottom) {
        ref.current!.scrollTop = isReachingTop ? 0 : maxScrollTop;
      }
    }, []);

    const handleResize = React.useCallback(() => {
      isMobile = window.matchMedia(`(max-width: ${1000 / 16}em)`).matches;

      if (isMobile) {
        ref.current?.removeEventListener('wheel', handleScroll);
      } else {
        ref.current?.addEventListener('wheel', handleScroll);
      }

      return () => ref.current?.removeEventListener('wheel', handleScroll);
    }, []);

    React.useEffect(() => {
      ref.current?.addEventListener('wheel', handleScroll);
      window.addEventListener('resize', handleResize);

      return () => {
        ref.current?.removeEventListener('wheel', handleScroll);
        window.removeEventListener('resize', handleResize);
      };
    }, []);

    // @ts-expect-error don't think there's a way to infer the proper ref type ahead of time
    return <Component {...props} ref={ref} />;
  };
}
