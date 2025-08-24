import { useEffect, useRef, useState } from 'react'
import { Editor } from 'rme'
import styled from 'styled-components'
import { navbarHeight } from 'utils/sizes'

const PlaygroundContainer = styled.div`
  margin-top: ${navbarHeight}px;
  background-color: ${props => props.theme.bgColor};
  color: ${props => props.theme.primaryFontColor};
  font-family: ${props => props.theme.fontFamily};
`

const Header = styled.header`
  border-bottom: 1px solid ${props => props.theme.borderColor};
  background-color: ${props => props.theme.navBackground};
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Title = styled.h1`
  margin: 0;
  font-size: ${props => props.theme.fontH2};
  color: ${props => props.theme.primaryFontColor};
`

const EditorContainer = styled.div`
  height: ${`calc(100vh - ${navbarHeight}px)`};
  padding: 1rem;
  overflow: auto;
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: ${props => props.theme.labelFontColor};
`

const PlaygroundContent = () => {
  const [rmeHooks, setRmeHooks] = useState<any>(null)
  const [viewType, setViewType] = useState<string>('wysiwyg')
  const editorRef = useRef<any>(null)

  useEffect(() => {
    // 动态加载RME hooks
    import('rme').then((mod) => {
      setRmeHooks({
        EditorViewType: mod.EditorViewType,
        createWysiwygDelegate: mod.createWysiwygDelegate,
        createSourceCodeDelegate: mod.createSourceCodeDelegate,
      })
      setViewType(mod.EditorViewType.WYSIWYG)
    })
  }, [])

  const initialContent = `# Welcome to Markflowy Playground

This is a **playground** page where you can experiment with the RME editor.

## Features

- ✨ **Real-time editing**
- 🎨 **Syntax highlighting**
- 📝 **Markdown support**
- 🔧 **Customizable**

## Try it out

Start typing below to see the editor in action!

\`\`\`javascript
function hello() {
  console.log("Hello, Markflowy!");
}
\`\`\`

> This is a blockquote example.

- List item 1
- List item 2
- List item 3

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

## Next Steps

This playground demonstrates the full RME editor functionality with:

1. **WYSIWYG Mode**: Visual editing with real-time preview
2. **Source Code Mode**: Direct markdown editing
3. **Real-time Updates**: See changes as you type
4. **Theme Integration**: Consistent with the site's design

Enjoy experimenting with the editor!
`

  const handleViewTypeChange = (newViewType: string) => {
    setViewType(newViewType)
  }

  const handleEditorChange = (params: any) => {
    // Content changes are handled by the editor internally
    console.log('Editor content changed')
  }

  if (!rmeHooks) {
    return (
      <PlaygroundContainer>
        <Header>
          <Title>Markflowy Playground</Title>
        </Header>
        <EditorContainer>
          <LoadingContainer>Loading Editor...</LoadingContainer>
        </EditorContainer>
      </PlaygroundContainer>
    )
  }

  return (
    <PlaygroundContainer>
      <Header>
      
      </Header>
      
      <EditorContainer>
        <Editor
          ref={editorRef}
          content={initialContent}
          initialType={viewType as any}
          onChange={handleEditorChange}
          delegate={
            viewType === rmeHooks.EditorViewType.WYSIWYG
              ? rmeHooks.createWysiwygDelegate()
              : rmeHooks.createSourceCodeDelegate()
          }
        />
      </EditorContainer>
    </PlaygroundContainer>
  )
}


export default PlaygroundContent
