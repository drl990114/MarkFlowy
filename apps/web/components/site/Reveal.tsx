import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Content is visible in SSR and with JS disabled; enhancement never gates reading. */
export default function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) return
    // Already-visible content must not flash back to the start of an entrance
    // after hydration, anchor navigation, or a slow JavaScript load.
    if (
      ref.current.getBoundingClientRect().top < window.innerHeight ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true)
      return
    }
    setAnimate(true)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px 64px 0px', threshold: 0 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`mf-reveal ${className}`}
      data-visible={visible}
      data-animate={animate}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
