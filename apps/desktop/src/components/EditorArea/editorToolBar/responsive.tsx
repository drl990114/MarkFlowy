import { FC, HTMLAttributes, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'

// Priority: Higher number means more important (hides later)
export interface SectionConfig {
  id: string
  priority: number
}

interface UsePriorityHiddenProps {
  items: SectionConfig[]
  gap?: number // Gap between items in pixels
}

export function usePriorityHidden({ items, gap = 8 }: UsePriorityHiddenProps) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    setContainerEl(el)
  }, [])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const itemWidthsRef = useRef<Map<string, number>>(new Map())
  const [widthUpdateTick, setWidthUpdateTick] = useState(0)
  
  // We need to force a re-calculation when items change or window resizes
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerEl) return
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    
    setContainerWidth(containerEl.getBoundingClientRect().width)
    observer.observe(containerEl)
    return () => observer.disconnect()
  }, [containerEl])

  useEffect(() => {
    const currentIds = new Set(items.map(i => i.id))
    let changed = false
    for (const key of itemWidthsRef.current.keys()) {
      if (!currentIds.has(key)) {
        itemWidthsRef.current.delete(key)
        changed = true
      }
    }
    if (changed) setWidthUpdateTick(t => t + 1)
    setHiddenIds(prev => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of prev) {
        if (currentIds.has(id)) next.add(id)
      }
      if (next.size === prev.size) return prev
      return next
    })
  }, [items])

  // Function to register item width
  const registerItemWidth = useCallback((id: string, width: number) => {
    if (width > 0) {
        const oldWidth = itemWidthsRef.current.get(id)
        if (oldWidth !== width) {
            itemWidthsRef.current.set(id, width)
            setWidthUpdateTick(t => t + 1)
        }
    }
  }, [])

  useLayoutEffect(() => {
    if (!containerWidth) return
    // Wait until we have measurements for all items to avoid premature "show all"
    if (!items.every(item => itemWidthsRef.current.has(item.id))) return

    // Calculate which items to hide
    const sortedItems = [...items].sort((a, b) => a.priority - b.priority) // Low priority first
    
    let currentTotalWidth = 0
    let visibleCount = items.length
    // Calculate full width needed
    items.forEach(item => {
        currentTotalWidth += (itemWidthsRef.current.get(item.id) || 0)
    })
    // Add gaps (items.length - 1 * gap) roughly
    currentTotalWidth += Math.max(0, visibleCount - 1) * gap

    const newHiddenIds = new Set<string>()

    // If we fit, show all
    if (currentTotalWidth <= containerWidth) {
        // Only update if changed to avoid loops
        if (hiddenIds.size > 0) {
            setHiddenIds(newHiddenIds)
        }
        return
    }

    // Try hiding from lowest priority
    for (const item of sortedItems) {
        const itemWidth = itemWidthsRef.current.get(item.id) || 0
        // Check if hiding this one is enough? 
        // Logic: we subtract width from total. If total <= container, we stop hiding.
        // Wait, the logic below was:
        // if (currentTotalWidth <= containerWidth) break
        // This check should be BEFORE hiding the current one? 
        // No, currentTotalWidth includes the current item.
        // If it fits already, we break.
        if (currentTotalWidth <= containerWidth) break
        
        newHiddenIds.add(item.id)
        currentTotalWidth -= itemWidth // Remove item width
        visibleCount -= 1
        if (visibleCount <= 0) break
        currentTotalWidth -= gap // Remove one gap
    }

    // Compare newHiddenIds with hiddenIds to avoid unnecessary updates
    let changed = newHiddenIds.size !== hiddenIds.size
    if (!changed) {
        for (const id of newHiddenIds) {
            if (!hiddenIds.has(id)) {
                changed = true
                break
            }
        }
    }

    if (changed) {
        setHiddenIds(newHiddenIds)
    }
  }, [containerWidth, items, gap, widthUpdateTick]) // Removed hiddenIds from dependency to avoid loop, handled inside

  return { containerRef, hiddenIds, registerItemWidth }
}

const SectionWrapper = styled.div<{ $hidden?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px; // Internal gap for buttons
  flex-shrink: 0; // Prevent shrinking, ensuring we measure full width
  ${props => props.$hidden && `
    display: none !important;
  `}
`

interface ToolbarSectionProps extends HTMLAttributes<HTMLDivElement> {
  id: string
  registerWidth: (id: string, width: number) => void
  hidden: boolean
  children: ReactNode
}

export const ToolbarSection: FC<ToolbarSectionProps> = ({ id, registerWidth, hidden, children, ...props }) => {
  const ref = useRef<HTMLDivElement>(null)
  
  useLayoutEffect(() => {
    if (ref.current && !hidden) {
        // Measure offsetWidth including margins if any? 
        // For now offsetWidth is good enough as we handle gap in parent calculation
        registerWidth(id, ref.current.offsetWidth)
    }
  }, [registerWidth, id, hidden])

  return (
    <SectionWrapper ref={ref} $hidden={hidden} {...props} data-section-id={id}>
      {children}
    </SectionWrapper>
  )
}
