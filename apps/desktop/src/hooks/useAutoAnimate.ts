import autoAnimate from '@formkit/auto-animate'
import { useEffect, useRef } from 'react'


export function useAutoAnimate<T extends HTMLElement> () {
  const htmlRef = useRef<T>(null)

  useEffect(() => {
    if (htmlRef.current) {
      autoAnimate(htmlRef.current)
    }
  }, [])

  return {
    htmlRef
  }
}
