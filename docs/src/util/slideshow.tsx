import React, { memo, useCallback, useEffect, useState } from 'react'

const slides = [
  {
    name: 'Dark Mode',
    src: '/img/darkmode.png',
    alt: 'MarkFlowy Dark Mode',
  },
  {
    name: 'Chatgpt',
    src: '/img/chatgpt.png',
    alt: 'MarkFlowy Chatgpt Extension',
  },
  {
    name: 'Table',
    src: '/img/table.png',
    alt: 'MarkFlowy table',
  },
  {
    name: 'Global Search',
    src: '/img/globalsearch.png',
    alt: 'MarkFlowy global search',
  },
  {
    name: 'Source Code',
    src: '/img/sourcecode.png',
    alt: 'MarkFlowy source code mode',
  },
]

const SLIDE_INTERVAL = 2500

export default memo(function Slideshow() {
  const [index, setIndex] = useState(0)
  const [handle, setHandle] = useState<NodeJS.Timeout | undefined>()

  const destroyIntervalTimer = useCallback(() => {
    clearInterval(handle)
    setHandle(undefined)
  }, [handle])

  const createIntervalTimer = useCallback(() => {
    destroyIntervalTimer()
    setHandle(setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL))
  }, [destroyIntervalTimer])

  const handleSlideSelect = (idx) => {
    createIntervalTimer()
    setIndex(idx)
  }

  useEffect(() => {
    createIntervalTimer()
    return destroyIntervalTimer
  }, [])

  return (
    <>
      <div className='slideshow-container'>
        {slides.map((e, i) => (
          <div key={i} className={`slide${index === i ? ' active' : ''}`}>
            <div className='slide-numbertext'>
              {i + 1} / {slides.length}
            </div>

            <img src={e.src} alt={e.alt} />
            <p className='slide-caption'>{e.name}</p>
          </div>
        ))}
      </div>

      <div className='slide-dots'>
        {slides.map((e, i) => (
          <span
            onClick={() => handleSlideSelect(i)}
            key={e.name}
            className={`slide-dot${i === index ? ' active' : ''}`}
          />
        ))}
      </div>
    </>
  )
}
)
