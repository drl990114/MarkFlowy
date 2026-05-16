import 'antd/dist/antd.css'
import React, { FC, useCallback, useRef, useState } from 'react'
import 'remixicon/fonts/remixicon.css'
import { ThemeProvider as ZThemeProvider } from 'zens'
import './App.css'
import {
  Editor,
  EditorRef,
  EditorViewType,
  ThemeProvider,
  createSourceCodeDelegate,
  createWysiwygDelegate,
  extractMatches,
} from './editor'
import { ConfigPanel, EditorType, FindState } from './playground/components/ConfigPanel'
import { ConfigTrigger } from './playground/components/ConfigTrigger'
import { DebugButton } from './playground/components/DebugButton'
import { DebugConsole } from './playground/components/DebugConsole'
import useContent from './playground/hooks/use-content'
import useDevTools from './playground/hooks/use-devtools'

let themeEl: undefined | HTMLStyleElement
const THEME_ID = 'mf-markdown-theme'

export function loadThemeCss(url: string) {
  if (themeEl) themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

const debounce = (fn: (...args: any) => void, delay: number) => {
  let timer: number
  return (...args: any) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), delay)
  }
}

const sleep = (time = 1000) => new Promise((res) => setTimeout(res, time))

const createAppWysiwygDelegate = () =>
  createWysiwygDelegate({
    disableAllBuildInShortcuts: true,
    codemirrorOptions: {
      lineWrapping: true,
    },
    overrideShortcutMap: {
      copy: 'mod-0',
      cut: 'mod-x',
      paste: 'mod-Shift-1',
      redo: 'mod-Shift-z',
      toggleCodeText: 'mod-e',
      toggleDelete: 'mod-Shift-s',
      toggleEmphasis: 'mod-i',
      toggleH1: 'mod-1',
      toggleH2: 'mod-2',
      toggleH3: 'mod-3',
      toggleH4: 'mod-4',
      toggleH5: 'mod-5',
      toggleH6: 'mod-6',
      toggleStrong: 'mod-b',
      undo: 'mod-z',
    },
    uploadImageHandler: function (files: any[]): any[] {
      let completed = 0
      const promises: any[] = []

      for (const { file, progress } of files) {
        promises.push(
          () =>
            new Promise<any>((resolve) => {
              const reader = new FileReader()

              reader.addEventListener(
                'load',
                (readerEvent) => {
                  completed += 1
                  progress(completed / files.length)
                  resolve({
                    src: readerEvent.target?.result as string,
                    'data-file-name': file.name,
                  })
                },
                { once: true },
              )

              reader.readAsDataURL(file)
            }),
        )
      }

      return promises
    },
    async imagePasteHandler(src) {
      await sleep()
      console.log('imagePasteHandler', src)
      return src
    },
    async handleViewImgSrcUrl(src) {
      await sleep()
      console.log('handleViewImgSrcUrl', src)
      return src
    },
    ai: {
      defaultSelectProvider: 'deepseek',
      supportProviderInfosMap: {
        openai: {
          models: ['gpt-3.5-turbo', 'gpt-4'],
        },
        deepseek: {
          models: ['deepseek-r1', 'deepseek-r2'],
        },
      },
      generateText: (params) => {
        console.log('params', params)
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              `# JavaScript 介绍 JavaScript 是一种轻量级、解释型或即时编译型的编程语言，最初由 Netscape 的 Brendan Eich 在 1995 年发明。它被广泛用于在网页上添加动态效果，并且已经发展成为一种非常强大的后端编程语言（Node.js）。 ## 基本特点 - **解释性**：JavaScript 是一种解释型语言，代码可以在浏览器或 Node.js 环境中直接执行。 - **跨平台性**：可以在任何支持 JavaScript 的环境运行。 - **动态类型**：变量在声明时不需要指定数据类型，并且可以自由转换。 - **事件驱动**：可以响应用户操作或其他事件触发的函数调用。 ## 基本语法 ### 变量与常量 JavaScript 中，使用 \`var\`、\`let\` 和 \`const\` 来声明变量。其中，\`var\` 是最古老的声明方式，但容易造成作用域问题；\`let\` 用于块级作用域内变量的声明；\`const\` 声明不可变的常量。 \`\`\`javascript // var 例子（不推荐使用） var greeting = "Hello"; greeting = "Hi"; // 可以重新赋值 // let 例子 let number = 10; number = 20; // 可以重新赋值，但改变了变量的值 // const 例子 const PI = 3.14; PI = 3.14159; // 错误：常量不能被改变 \`\`\` ### 函数定义 JavaScript 中通过 \`function\` 关键字来定义函数。 \`\`\`javascript // 声明式函数 function greet(name) { return "Hello, " + name; } console.log(greet("Alice")); // 输出: Hello, Alice // 箭头函数（ES6 新特性） const add = (a, b) => a + b; console.log(add(2, 3)); // 输出: 5 \`\`\` ### 控制流语句 - \`if\`：条件判断。 - \`for\`、\`while\` 和 \`do...while\`：循环结构。 \`\`\`javascript let i = 0; while (i < 10) { console.log(i); i++; } \`\`\` ## DOM 操作 JavaScript 可以操作 HTML 文档，通过 DOM API 来实现。例如改变元素的属性或添加/删除节点等。 \`\`\`javascript // 获取 id 为 'example' 的元素 let element = document.getElementById("example"); // 改变元素内容 element.innerHTML = "New content"; // 添加事件监听器 element.addEventListener("click", function() { console.log("Element clicked!"); }); \`\`\` ## Node.js Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行环境，允许开发者使用 JavaScript 来进行服务器端开发。它支持非阻塞 I/O 操作和事件驱动编程模型。 \`\`\`javascript // 使用 Node.js 的基本示例 const http = require("http"); http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("Hello World\n"); }).listen(3000); console.log('Server running at http://127.0.0.1:3000/'); \`\`\` 以上就是 JavaScript 的一些基本介绍，希望对你有所帮助！`,
            )
          }, 5000)
        })
      },
      copilot: {
        generateText: (params) => {
          console.log('copilot params', params)
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(`一些建议 *请问* \n - qwe`)
            }, 2000)
          })
        },
      },
    },
  })

function App() {
  const editorRef = React.useRef<EditorRef>(null)
  const { contentId, content, hasUnsavedChanges, setContentId, setContent } = useContent()
  const { enableDevTools, setEnableDevTools } = useDevTools()
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [enableTypewriterScroll, setEnableTypewriterScroll] = useState(false)
  const [editorDelegate, setEditorDelegate] = useState(createAppWysiwygDelegate())
  const editorCtxRef = useRef<any>(null)
  const [configPanelOpen, setConfigPanelOpen] = useState(false)
  const [editorType, setEditorType] = useState<EditorType>('wysiwyg')

  const [findState, setFindState] = useState<FindState>({
    query: '',
    replacement: '',
    activeIndex: null,
    total: 0,
    caseSensitive: false,
    isOpen: false,
  })

  const mockContent = `# Mock 内容注入

这是一次 \`setContent\` API 的模拟调用，用于测试动态内容替换功能。

## 功能验证
- 内容替换是否正常
- 编辑器状态是否正确更新
- 撤销/重做是否正常

> 提示：此内容通过 editorRef.current.setContent() 注入
`

  const debounceChange = debounce((params) => {
    setContent(editorDelegate.docToString(params.state.doc) || '')
  }, 300)

  const performFind = useCallback(
    (indexDiff = 0) => {
      if (!editorRef.current || !findState.query) return

      try {
        const helpers = editorCtxRef.current?.helpers

        if (helpers?.findRanges) {
          const result = helpers.findRanges({
            query: findState.query,
            caseSensitive: findState.caseSensitive,
            activeIndex: findState.activeIndex == null ? 0 : findState.activeIndex + indexDiff,
          })
          setFindState((prev) => ({
            ...prev,
            total: result.ranges.length,
            activeIndex: result.activeIndex ?? 0,
          }))
        }
      } catch (e) {
        console.error('Error performing find:', e)
      }
    },
    [findState.query, findState.caseSensitive, findState.activeIndex],
  )

  const findNext = useCallback(() => {
    performFind(1)
  }, [performFind])

  const findPrev = useCallback(() => {
    performFind(-1)
  }, [performFind])

  const stopFind = useCallback(() => {
    setFindState((prev) => ({ ...prev, isOpen: false, query: '', activeIndex: null, total: 0 }))
    try {
      const commands = editorCtxRef.current?.commands
      if (commands?.stopFind) {
        commands.stopFind()
      }
    } catch (e) {
      console.error('Error stopping find:', e)
    }
  }, [])

  const mockSetContent = useCallback(() => {
    setContent(mockContent)
    editorRef.current?.setContent(mockContent)
  }, [mockContent, setContent])

  const replace = useCallback(() => {
    if (!findState.query) return

    try {
      const commands = editorCtxRef.current?.commands
      if (commands?.findAndReplace) {
        commands.findAndReplace({
          query: findState.query,
          replacement: findState.replacement,
          caseSensitive: findState.caseSensitive,
          index: findState.activeIndex ?? undefined,
        })

        const isQuerySubsetOfReplacement = findState.caseSensitive
          ? findState.replacement.includes(findState.query)
          : findState.replacement.toLowerCase().includes(findState.query.toLowerCase())

        if (isQuerySubsetOfReplacement) {
          setTimeout(findNext, 100)
        } else {
          setTimeout(performFind, 100)
        }
      }
    } catch (e) {
      console.error('Error performing replace:', e)
    }
  }, [findState, findNext, performFind])

  const replaceAll = useCallback(() => {
    if (!findState.query) return

    try {
      const commands = editorCtxRef.current?.commands
      if (commands?.findAndReplaceAll) {
        commands.findAndReplaceAll({
          query: findState.query,
          replacement: findState.replacement,
          caseSensitive: findState.caseSensitive,
        })
        setTimeout(stopFind, 100)
      }
    } catch (e) {
      console.error('Error performing replace all:', e)
    }
  }, [findState, stopFind])

  const handleEditorTypeChange = useCallback(
    (type: EditorType) => {
      setEditorType(type)
      if (type === 'wysiwyg') {
        setEditorDelegate(createAppWysiwygDelegate())
        editorRef.current?.toggleType(EditorViewType.WYSIWYG)
      } else if (type === 'sourceCode') {
        setEditorDelegate(
          createSourceCodeDelegate({
            disableAllBuildInShortcuts: true,
            overrideShortcutMap: {
              copy: 'mod-c',
              cut: 'mod-x',
              paste: 'mod-Shift-1',
              redo: 'mod-Shift-z',
              toggleCodeText: 'mod-e',
              toggleDelete: 'mod-Shift-s',
              toggleEmphasis: 'mod-i',
              toggleH1: 'mod-1',
              toggleH2: 'mod-2',
              toggleH3: 'mod-3',
              toggleH4: 'mod-4',
              toggleH5: 'mod-5',
              toggleH6: 'mod-6',
              toggleStrong: 'mod-b',
              undo: 'mod-z',
            },
            onCodemirrorViewLoad: (cmNodeView) => {
              extractMatches(cmNodeView.cm)
              console.log('cmNodeView', cmNodeView)
            },
          }),
        )
        editorRef.current?.toggleType(EditorViewType.SOURCECODE)
      } else {
        editorRef.current?.toggleType(EditorViewType.PREVIEW)
      }
    },
    [setEditorType, setEditorDelegate],
  )

  const handleTypewriterScrollChange = useCallback(
    (enabled: boolean) => {
      setEnableTypewriterScroll(enabled)
      // Use command to dynamically toggle typewriter scroll
      try {
        const commands = editorCtxRef.current?.commands
        if (commands?.toggleTypewriterScroll) {
          commands.toggleTypewriterScroll(enabled)
        }
      } catch (e) {
        console.error('Error toggling typewriter scroll:', e)
      }
    },
    [setEnableTypewriterScroll],
  )

  // Sync typewriter scroll state when editor context is mounted or state changes
  React.useEffect(() => {
    if (editorCtxRef.current?.commands) {
      try {
        const commands = editorCtxRef.current.commands
        if (commands.toggleTypewriterScroll) {
          commands.toggleTypewriterScroll(enableTypewriterScroll)
        }
      } catch (e) {
        console.error('Error syncing typewriter scroll state:', e)
      }
    }
  }, [enableTypewriterScroll, editorCtxRef.current?.commands])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setConfigPanelOpen(true)
        setFindState((prev) => ({ ...prev, isOpen: true }))
      } else if (e.key === 'Escape') {
        setFindState((prev) => ({ ...prev, isOpen: false }))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const editor = (
    <div className="playground-self-scroll">
      <Editor
        initialType={EditorViewType.WYSIWYG}
        key={contentId}
        delegate={editorDelegate}
        ref={editorRef}
        content={content}
        onChange={debounceChange}
        isTesting={false}
        onContextMounted={(context) => {
          editorCtxRef.current = context
        }}
        wysiwygToolBarOptions={{
          enable: true,
        }}
      />
    </div>
  )

  const debugConsole = enableDevTools ? (
    <div className="playground-self-scroll">
      <DebugConsole
        hasUnsavedChanges={hasUnsavedChanges}
        contentId={contentId}
        content={content}
        setContentId={setContentId}
      />
    </div>
  ) : null

  const BlurHelper: FC = () => {
    return (
      <button
        className="blur-helper"
        style={{
          position: 'absolute',
          bottom: '64px',
          right: '64px',
          opacity: 0,
        }}
      ></button>
    )
  }

  const themeData = {
    mode: theme,
  }

  return (
    <main className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
      <ZThemeProvider theme={themeData}>
        <div className="playground-header">
          <div className="playground-header-left">
            <h1 className="playground-title">
              <span className="playground-logo">◈</span>
              MARKFLOWY
            </h1>
            <span className="playground-subtitle">WYSIWYG Markdown Editor</span>
          </div>
          <div className="playground-header-actions">
            <span className={`playground-header-badge ${editorType === 'wysiwyg' ? 'active' : ''}`}>
              {editorType.toUpperCase()}
            </span>
            <span className={`playground-header-badge ${theme === 'dark' ? 'active' : ''}`}>
              {theme === 'dark' ? '☾ DARK' : '☀ LIGHT'}
            </span>
          </div>
        </div>
        <ThemeProvider
          theme={themeData}
          i18n={{
            locales: {
              'zh-CN': {
                translation: {
                  table: {
                    insertColumnAfter: '向后插入列',
                    insertColumnBefore: '向前插入列',
                    insertRowAfter: '向后插入行',
                    insertRowBefore: '向前插入行',
                    deleteColumn: '删除列',
                    deleteRow: '删除行',
                  },
                },
              },
            },
            language: 'zh-CN',
          }}
        >
          <DebugButton
            enableDevTools={enableDevTools}
            toggleEnableDevTools={() => setEnableDevTools(!enableDevTools)}
          />
          <ConfigTrigger isOpen={configPanelOpen} onClick={() => setConfigPanelOpen(!configPanelOpen)} />
          <ConfigPanel
            isOpen={configPanelOpen}
            onClose={() => setConfigPanelOpen(false)}
            editorType={editorType}
            onEditorTypeChange={handleEditorTypeChange}
            theme={theme}
            onThemeChange={setTheme}
            enableDevTools={enableDevTools}
            onDevToolsChange={setEnableDevTools}
            enableTypewriterScroll={enableTypewriterScroll}
            onTypewriterScrollChange={handleTypewriterScrollChange}
            findState={findState}
            onFindStateChange={setFindState}
            onFindNext={findNext}
            onFindPrev={findPrev}
            onReplace={replace}
            onReplaceAll={replaceAll}
            onPerformFind={performFind}
            onStopFind={stopFind}
            onMockSetContent={mockSetContent}
          />
          <div className="playground-box">
            {editor}
            {debugConsole}
          </div>
          <BlurHelper />
        </ThemeProvider>
      </ZThemeProvider>
    </main>
  )
}

export default App
