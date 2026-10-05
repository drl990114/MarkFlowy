import { useTranslation } from 'next-i18next'
import { useEffect, useState } from 'react'
import { useSceneMotion } from './HomeMotion'
import Reveal from './Reveal'

const steps = ['capture', 'refine', 'share'] as const

export default function Workflow() {
  const { t } = useTranslation()
  const { ref, running } = useSceneMotion()
  const [active, setActive] = useState(0)
  const [automatic, setAutomatic] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const playing = running && automatic && !hovered
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => setActive((value) => (value + 1) % steps.length), 4800)
    return () => window.clearTimeout(timer)
  }, [active, playing])
  return (
    <section className='mf-workflow'>
      <div className='mf-container' ref={ref} data-running={playing}>
        <div className='mf-workflow-intro'>
          <Reveal>
            <p className='mf-eyebrow'>{t('site.workflow.eyebrow')}</p>
            <h2 className='mf-section-title'>{t('site.workflow.title')}</h2>
          </Reveal>
          <div
            className='mf-workflow-scene'
            data-stage={active}
            data-keyboard={keyboard}
            aria-hidden='true'
          >
            <div className='mf-workflow-orbit' />
            {steps.map((step, index) => (
              <div className='mf-workflow-document' key={step} data-active={active === index}>
                <div className='mf-document-topline'>
                  <i className={['ri-quill-pen-line', 'ri-list-check-2', 'ri-check-line'][index]} />
                  <span>{t(`site.workflow.${step}.visual`)}</span>
                  <span className='mf-document-dot' />
                </div>
                <div className='mf-document-body'>
                  <strong>{['ideas.md', 'draft.md', 'ready.md'][index]}</strong>
                  <span className='mf-document-line' />
                  <span className='mf-document-line' />
                  <span className='mf-document-line' />
                  <div className='mf-document-tag'>
                    <i className={index === 2 ? 'ri-check-double-line' : 'ri-markdown-line'} />
                    Markdown
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          className='mf-workflow-grid'
          data-keyboard={keyboard}
          onKeyDown={() => setKeyboard(true)}
          onPointerDown={() => setKeyboard(false)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setAutomatic(false)}
        >
          {steps.map((step, index) => (
            <article key={step} data-active={active === index}>
              <span className='mf-step' aria-hidden='true'>
                0{index + 1}
              </span>
              <h3>
                <button
                  type='button'
                  aria-pressed={active === index}
                  onClick={() => {
                    setActive(index)
                    setAutomatic(false)
                  }}
                >
                  {t(`site.workflow.${step}.title`)}
                  <i className='ri-arrow-right-line' aria-hidden='true' />
                </button>
              </h3>
              <p>{t(`site.workflow.${step}.body`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
