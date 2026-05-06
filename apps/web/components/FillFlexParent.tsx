import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'

interface FillFlexParentProps {
  children: (dimens: { width: number; height: number }) => React.ReactNode
}

/**
 * Component that fills its parent flex container and provides dimensions to children
 * Required by FileTree component from @markflowy/interface
 */
export const FillFlexParent: FC<FillFlexParentProps> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateDimensions = () => {
      const { width, height } = element.getBoundingClientRect()
      setDimensions({ width, height })
    }

    // Initial measurement
    updateDimensions()

    // Use ResizeObserver for efficient resize handling
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
    </div>
  )
}
