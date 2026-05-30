import React from 'react'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'

interface FillFlexParentProps {
  children: (dimens: { width: number; height: number }) => React.ReactNode
  className?: string
}

export const FillFlexParent: FC<FillFlexParentProps> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateDimensions = () => {
      const { width, height } = element.getBoundingClientRect()
      setDimensions({ width, height })
    }

    updateDimensions()

    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div ref={ref} className={className} style={{ flex: 1, width: '100%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
    </div>
  )
}
