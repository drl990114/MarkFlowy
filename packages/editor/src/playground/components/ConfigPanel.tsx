import React, { FC, useCallback, useEffect, useRef } from 'react'

export type EditorType = 'wysiwyg' | 'sourceCode' | 'preview'

export interface FindState {
  query: string
  replacement: string
  activeIndex: number | null
  total: number
  caseSensitive: boolean
  isOpen: boolean
}

interface ConfigPanelProps {
  isOpen: boolean
  onClose: () => void
  editorType: EditorType
  onEditorTypeChange: (type: EditorType) => void
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  enableDevTools: boolean
  onDevToolsChange: (enabled: boolean) => void
  enableTypewriterScroll: boolean
  onTypewriterScrollChange: (enabled: boolean) => void
  findState: FindState
  onFindStateChange: React.Dispatch<React.SetStateAction<FindState>>
  onFindNext: () => void
  onFindPrev: () => void
  onReplace: () => void
  onReplaceAll: () => void
  onPerformFind: () => void
  onStopFind: () => void
  onMockSetContent: () => void
}

export const ConfigPanel: FC<ConfigPanelProps> = ({
  isOpen,
  onClose,
  editorType,
  onEditorTypeChange,
  theme,
  onThemeChange,
  enableDevTools,
  onDevToolsChange,
  enableTypewriterScroll,
  onTypewriterScrollChange,
  findState,
  onFindStateChange,
  onFindNext,
  onFindPrev,
  onReplace,
  onReplaceAll,
  onPerformFind,
  onStopFind,
  onMockSetContent,
}) => {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFindStateChange({ ...findState, query: e.target.value })
    },
    [findState, onFindStateChange]
  )

  const handleReplacementChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFindStateChange({ ...findState, replacement: e.target.value })
    },
    [findState, onFindStateChange]
  )

  const toggleCaseSensitive = useCallback(() => {
    onFindStateChange({ ...findState, caseSensitive: !findState.caseSensitive })
  }, [findState, onFindStateChange])

  if (!isOpen) return null

  return (
    <div className="config-panel-overlay">
      <div ref={panelRef} className={`config-panel ${isOpen ? 'open' : ''}`}>
        <div className="config-panel-header">
          <span className="config-panel-title">⚙ CONFIG</span>
          <button className="config-panel-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="config-panel-content">
          <section className="config-section">
            <div className="config-section-title">EDITOR</div>
            <div className="config-section-content">
              <div className="config-radio-group">
                {(['wysiwyg', 'sourceCode', 'preview'] as EditorType[]).map((type) => (
                  <label key={type} className="config-radio-item">
                    <input
                      type="radio"
                      name="editorType"
                      checked={editorType === type}
                      onChange={() => onEditorTypeChange(type)}
                    />
                    <span className="config-radio-label">{type.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-title">THEME</div>
            <div className="config-section-content">
              <div className="config-toggle-group">
                <button
                  className={`config-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => onThemeChange('light')}
                >
                  ☀ LIGHT
                </button>
                <button
                  className={`config-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => onThemeChange('dark')}
                >
                  ☾ DARK
                </button>
              </div>
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-title">DEVTOOLS</div>
            <div className="config-section-content">
              <label className="config-switch">
                <input
                  type="checkbox"
                  checked={enableDevTools}
                  onChange={(e) => onDevToolsChange(e.target.checked)}
                />
                <span className="config-switch-slider"></span>
                <span className="config-switch-label">{enableDevTools ? 'ON' : 'OFF'}</span>
              </label>
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-title">TYPEWRITER SCROLL</div>
            <div className="config-section-content">
              <label className="config-switch">
                <input
                  type="checkbox"
                  checked={enableTypewriterScroll}
                  onChange={(e) => onTypewriterScrollChange(e.target.checked)}
                />
                <span className="config-switch-slider"></span>
                <span className="config-switch-label">{enableTypewriterScroll ? 'ON' : 'OFF'}</span>
              </label>
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-title">FIND & REPLACE</div>
            <div className="config-section-content">
              <div className="config-input-group">
                <input
                  type="text"
                  placeholder="Search..."
                  value={findState.query}
                  onChange={handleQueryChange}
                  onKeyDown={(e) => e.key === 'Enter' && onFindNext()}
                  className="config-input"
                />
                <input
                  type="text"
                  placeholder="Replace..."
                  value={findState.replacement}
                  onChange={handleReplacementChange}
                  className="config-input"
                />
              </div>
              <div className="config-find-info">
                {findState.activeIndex !== null
                  ? `${findState.activeIndex + 1}/${findState.total}`
                  : '0/0'}
              </div>
              <div className="config-btn-group">
                <button
                  className="config-btn"
                  onClick={onFindPrev}
                  disabled={!findState.query}
                  title="Previous"
                >
                  ↑
                </button>
                <button
                  className="config-btn"
                  onClick={onFindNext}
                  disabled={!findState.query}
                  title="Next"
                >
                  ↓
                </button>
                <button
                  className={`config-btn ${findState.caseSensitive ? 'active' : ''}`}
                  onClick={toggleCaseSensitive}
                  title="Case Sensitive"
                >
                  Aa
                </button>
                <button className="config-btn" onClick={onPerformFind} disabled={!findState.query}>
                  Find
                </button>
                <button className="config-btn" onClick={onStopFind}>
                  Stop
                </button>
              </div>
              <div className="config-btn-group">
                <button
                  className="config-btn config-btn-primary"
                  onClick={onReplace}
                  disabled={!findState.query}
                >
                  Replace
                </button>
                <button
                  className="config-btn config-btn-primary"
                  onClick={onReplaceAll}
                  disabled={!findState.query}
                >
                  Replace All
                </button>
              </div>
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-title">ACTIONS</div>
            <div className="config-section-content">
              <button className="config-btn config-btn-full" onClick={onMockSetContent}>
                ⚡ Mock setContent
              </button>
            </div>
          </section>
        </div>

        <div className="config-panel-footer">
          <span className="config-version">React {React.version}</span>
        </div>
      </div>
    </div>
  )
}
