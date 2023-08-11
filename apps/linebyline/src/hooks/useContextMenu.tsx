import { useState, useEffect } from 'react'
import { createGlobalStore } from 'hox'

const useContextMenu = () => {
  const [open, setOpen] = useState(false)
  const [points, setPoints] = useState({
    x: 0,
    y: 0,
  })

  useEffect(() => {
    const handleClick = () => setOpen(false)
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [])

  return {
    open,
    setOpen,
    points,
    setPoints,
  }
}

const [useFileTreeContextMenu] = createGlobalStore(useContextMenu)
export default useFileTreeContextMenu
