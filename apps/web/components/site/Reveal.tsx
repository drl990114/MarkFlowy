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
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`mf-reveal ${className}`}
      data-visible={visible}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
