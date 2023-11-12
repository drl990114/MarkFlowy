import { FC } from 'react'

import { WysiwygEditor as Editor } from '@markflowy/editor'
import { BaseStyle, darkTheme } from '@markflowy/theme'
import { ThemeProvider, StyleSheetManager } from 'styled-components'
import { contentMap } from '../content'
import useContent from '../hooks/use-content'
import useDevTools from '../hooks/use-devtools'
import isPropValid from '@emotion/is-prop-valid'
import 'remixicon/fonts/remixicon.css'
import useChangeCodeMirrorTheme from '../hooks/useChangeCodeMirrorTheme'
import './App.css'

const DebugButton: FC<{ enableDevTools: boolean; toggleEnableDevTools: () => void }> = ({
  enableDevTools,
  toggleEnableDevTools,
}) => {
  return (
    <button
      className={
        enableDevTools ? 'playground-debug-button-enable' : 'playground-debug-button-disable'
      }
      onClick={() => toggleEnableDevTools()}
      data-testid='playground_debug_button'
    >
      Debug
    </button>
  )
}

/** focus this element to hide the cursor in the editor */
const BlurHelper: FC = () => {
  return (
    <button
      className='blur-helper'
      style={{
        position: 'absolute',
        bottom: '64px',
        right: '64px',
        opacity: 0,
      }}
    ></button>
  )
}

const DebugConsole: FC<{
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
    <div
      style={{
        paddingTop: '32px',
        paddingBottom: '64px',
        paddingLeft: 'max(32px, calc(50% - 400px))',
        paddingRight: 'max(32px, calc(50% - 400px))',
        fontSize: '16px',
        lineHeight: '1.5',
      }}
      data-testid='playground_debug_console'
    >
      <p>
        <strong>hasUnsavedChanges: </strong>
        {JSON.stringify(hasUnsavedChanges)}
      </p>
      <p>
        <strong>content:</strong>
      </p>
      <select id='contentType' value={contentId} onChange={(e) => setContentId(e.target.value)}>
        {options}
      </select>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          marginBottom: '16px',
          fontSize: '85%',
          borderRadius: '3px',
          padding: '16px',
          overflowWrap: 'break-word',
          overflow: 'hidden',
        }}
      >
        {content}
      </pre>
    </div>
  )
}

const App: FC = () => {
  const { contentId, content, hasUnsavedChanges, setContentId } = useContent()
  const { enableDevTools, setEnableDevTools } = useDevTools()

  const editor = (
    <div className='playground-self-scroll'>
      <Editor
        key={contentId}
        content={content}
        offset={{ top: 10, left: 16 }}
        hooks={[useChangeCodeMirrorTheme]}
        isTesting
      />
    </div>
  )

  const debugConsole = enableDevTools ? (
    <div className='playground-self-scroll'>
      <DebugConsole
        hasUnsavedChanges={hasUnsavedChanges}
        contentId={contentId}
        content={content}
        setContentId={setContentId}
      />
    </div>
  ) : null

  return (
    <div className='markdown-body' style={{ width: '100%' }}>
      <StyleSheetManager shouldForwardProp={isPropValid}>
        <ThemeProvider theme={darkTheme?.styledContants || {}}>
          <BaseStyle theme={darkTheme.styledContants} />
          <DebugButton
            enableDevTools={enableDevTools}
            toggleEnableDevTools={() => setEnableDevTools(!enableDevTools)}
          />
          <div className='playground-box'>
            {editor}
            {debugConsole}
          </div>
          <BlurHelper />
        </ThemeProvider>
      </StyleSheetManager>
    </div>
  )
}

export default App
