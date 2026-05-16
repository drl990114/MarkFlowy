import { FC } from 'react'
import { contentMap } from '../content'

export const DebugConsole: FC<{
  hasUnsavedChanges: boolean
  contentId: string
  content: string
  setContentId: (contentId: string) => void
}> = ({ hasUnsavedChanges, contentId, content, setContentId }) => {
  const options = Object.keys(contentMap).map((k) => (
    <option key={k} value={k}>
      {k}
    </option>
  ))

  return (
    <div className="debug-console" data-testid="playground_debug_console">
      <div className="debug-console-header">
        <span className="debug-console-title">DEBUG CONSOLE</span>
      </div>
      <div className="debug-console-content">
        <div className="debug-item">
          <span className="debug-label">hasUnsavedChanges:</span>
          <span className="debug-value">{JSON.stringify(hasUnsavedChanges)}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">content:</span>
        </div>
        <select
          className="debug-select"
          id="contentType"
          value={contentId}
          onChange={(e) => setContentId(e.target.value)}
        >
          {options}
        </select>
        <pre className="debug-content">{content}</pre>
      </div>
    </div>
  )
}
